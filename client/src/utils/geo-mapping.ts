import { logger, LogCategory } from './logger';
/**
 * Utilities for mapping between geographic coordinates and game world coordinates
 */

/**
 * Map configuration interface
 */
export interface GeoMapConfig {
  // Reference point (top-left corner of map)
  originLatitude: number;
  originLongitude: number;

  // Reference point (bottom-right corner of map)
  boundaryLatitude: number;
  boundaryLongitude: number;

  // Game world dimensions
  worldWidth: number;
  worldHeight: number;
}

/**
 * Position interface with both geographic and game coordinates
 */
export interface GeoPosition {
  // Geographic coordinates
  latitude: number;
  longitude: number;

  // Game world coordinates
  x: number;
  y: number;
}

/**
 * GeoMapper class for converting between coordinate systems
 */
export class GeoMapper {
  private config: GeoMapConfig;

  // Calculated scale factors
  private latScale: number;
  private lngScale: number;

  // Cached values for performance
  private latDistance: number;
  private lngDistance: number;

  constructor(config: GeoMapConfig) {
    this.config = config;

    // Calculate the geographic distance
    this.latDistance = Math.abs(
      config.boundaryLatitude - config.originLatitude,
    );
    this.lngDistance = Math.abs(
      config.boundaryLongitude - config.originLongitude,
    );

    // Calculate scale factors (units per degree)
    this.latScale = config.worldHeight / this.latDistance;
    this.lngScale = config.worldWidth / this.lngDistance;

    // Log the scale factors for debugging
    logger.info(LogCategory.MAP, `GeoMapper initialized with scale factors: 
                 latScale=${this.latScale.toFixed(2)} px/degree,
                 lngScale=${this.lngScale.toFixed(2)} px/degree`);
    logger.info(LogCategory.MAP, `Geographic area: ${this.latDistance.toFixed(6)}° latitude × ${this.lngDistance.toFixed(6)}° longitude`);

    // Calculate approximate meters per pixel for reference
    const latMetersPerDegree = this.approximateMetersPerDegree(
      (config.originLatitude + config.boundaryLatitude) / 2,
    );
    const metersPerPixelLat = latMetersPerDegree / this.latScale;
    const metersPerPixelLng =
      this.calculateGeoDistance(
        config.originLatitude,
        config.originLongitude,
        config.originLatitude,
        config.boundaryLongitude,
      ) / config.worldWidth;

    logger.info(LogCategory.MAP, `Approximate resolution: 
                 ${metersPerPixelLat.toFixed(2)} meters/pixel (latitude), 
                 ${metersPerPixelLng.toFixed(2)} meters/pixel (longitude)`);
  }

  /**
   * Convert geographic coordinates to game world coordinates
   */
  geoToGameCoordinates(
    latitude: number,
    longitude: number,
  ): { x: number; y: number } {
    // Calculate x position (longitude)
    const x = (longitude - this.config.originLongitude) * this.lngScale;

    // Calculate y position (latitude) - note that latitude decreases as y increases
    const y = (this.config.originLatitude - latitude) * this.latScale;

    return { x, y };
  }

  /**
   * Convert game world coordinates to geographic coordinates
   */
  gameToGeoCoordinates(
    x: number,
    y: number,
  ): { latitude: number; longitude: number } {
    // Calculate longitude from x
    const longitude = this.config.originLongitude + x / this.lngScale;

    // Calculate latitude from y (inverted)
    const latitude = this.config.originLatitude - y / this.latScale;

    return { latitude, longitude };
  }

  /**
   * Convert a browser GeolocationPosition to our GeoPosition format
   */
  browserPositionToGeoPosition(position: GeolocationPosition): GeoPosition {
    const { latitude, longitude } = position.coords;
    const { x, y } = this.geoToGameCoordinates(latitude, longitude);

    return {
      latitude,
      longitude,
      x,
      y,
    };
  }

  /**
   * Check if geographic coordinates are within the map boundaries
   */
  isWithinBoundaries(latitude: number, longitude: number): boolean {
    const latInRange =
      latitude <= this.config.originLatitude &&
      latitude >= this.config.boundaryLatitude;

    const lngInRange =
      longitude >= this.config.originLongitude &&
      longitude <= this.config.boundaryLongitude;

    return latInRange && lngInRange;
  }

  /**
   * Calculate real-world distance in meters between two game positions
   */
  calculateGameDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    // Convert game positions to geographic coordinates
    const { latitude: lat1, longitude: lon1 } = this.gameToGeoCoordinates(
      x1,
      y1,
    );
    const { latitude: lat2, longitude: lon2 } = this.gameToGeoCoordinates(
      x2,
      y2,
    );

    // Calculate using Haversine formula
    return this.calculateGeoDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * Calculate real-world distance in meters between two geographic positions
   */
  calculateGeoDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    // Haversine formula to calculate distance between two points on Earth
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
  }

  /**
   * Get the grid cell for a geographic position
   * @param latitude The latitude coordinate
   * @param longitude The longitude coordinate
   * @param gridSize Size of grid cells in game units
   * @returns Grid cell identifier string in "x:y" format
   */
  getGridCellFromGeo(
    latitude: number,
    longitude: number,
    gridSize: number,
  ): string {
    // Convert to game coordinates first
    const { x, y } = this.geoToGameCoordinates(latitude, longitude);

    // Calculate grid cell
    const cellX = Math.floor(x / gridSize);
    const cellY = Math.floor(y / gridSize);

    return `${cellX}:${cellY}`;
  }

  /**
   * Calculate the center point of a grid cell in geographic coordinates
   */
  getGeoCenterOfGridCell(
    cellX: number,
    cellY: number,
    gridSize: number,
  ): { latitude: number; longitude: number } {
    // Calculate center point in game coordinates
    const centerX = cellX * gridSize + gridSize / 2;
    const centerY = cellY * gridSize + gridSize / 2;

    // Convert to geographic coordinates
    return this.gameToGeoCoordinates(centerX, centerY);
  }

  /**
   * Update the map configuration
   */
  updateConfig(config: Partial<GeoMapConfig>): void {
    this.config = { ...this.config, ...config };

    // Recalculate geographic distances
    this.latDistance = Math.abs(
      this.config.boundaryLatitude - this.config.originLatitude,
    );
    this.lngDistance = Math.abs(
      this.config.boundaryLongitude - this.config.originLongitude,
    );

    // Recalculate scale factors
    this.latScale = this.config.worldHeight / this.latDistance;
    this.lngScale = this.config.worldWidth / this.lngDistance;

    logger.info(LogCategory.MAP, `GeoMapper updated with scale factors: 
                 latScale=${this.latScale.toFixed(2)} px/degree,
                 lngScale=${this.lngScale.toFixed(2)} px/degree`);
  }

  /**
   * Approximate meters per degree of latitude at a given latitude
   * @param latitude Latitude in degrees
   * @returns Approximate meters per degree
   */
  private approximateMetersPerDegree(latitude: number): number {
    // At the equator, 1 degree is approximately 111,320 meters
    // This value decreases as you move towards the poles
    const latRad = (latitude * Math.PI) / 180;
    return 111320 * Math.cos(latRad);
  }
}

