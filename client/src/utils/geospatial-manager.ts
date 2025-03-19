import { GameConfig } from '../config';
import L from 'leaflet';

/**
 * Class for handling geospatial calculations and conversions
 * between real-world coordinates and game world coordinates
 * Utilizes Leaflet for accurate geographic calculations
 */
export class GeospatialManager {
    // The center point for our game world in real coordinates
    private centerLat: number;
    private centerLng: number;
    
    // The scaling factor (meters per pixel)
    private scale: number;
    
    // Leaflet utilities for calculations
    private leafletUtil: typeof L;
    
    constructor(centerLat: number = GameConfig.map.defaultCenter.lat, 
                centerLng: number = GameConfig.map.defaultCenter.lng, 
                scale: number = GameConfig.map.metersPerPixel) {
        this.centerLat = centerLat;
        this.centerLng = centerLng;
        this.scale = scale; // meters per pixel
        this.leafletUtil = L;
    }
    
    /**
     * Set the center point of the map in real-world coordinates
     */
    public setCenter(lat: number, lng: number): void {
        this.centerLat = lat;
        this.centerLng = lng;
    }
    
    /**
     * Set the scale factor (meters per pixel)
     */
    public setScale(scale: number): void {
        this.scale = scale;
    }
    
    /**
     * Convert real-world coordinates to game world position
     * This is a simplified approximation - for exact pixel coordinates, 
     * use the WorldMap's latLngToPixel method which uses the actual map projection
     */
    public coordsToPosition(lat: number, lng: number): { x: number, y: number } {
        // Calculate center point
        const centerPoint = new L.Point(GameConfig.worldWidth / 2, GameConfig.worldHeight / 2);
        
        // Calculate the distance in meters from the center
        const distanceInMeters = this.getDistance(this.centerLat, this.centerLng, lat, lng);
        
        // Calculate the bearing (direction) from center to the point
        const bearing = this.getBearing(this.centerLat, this.centerLng, lat, lng);
        
        // Convert distance to pixels using scale
        const distanceInPixels = distanceInMeters / this.scale;
        
        // Calculate the pixel offset using the bearing
        const dx = Math.sin(bearing) * distanceInPixels;
        const dy = -Math.cos(bearing) * distanceInPixels; // Negative because y increases downward in screen coordinates
        
        // Apply offset to center point
        return {
            x: centerPoint.x + dx,
            y: centerPoint.y + dy
        };
    }
    
    /**
     * Convert game world position to real-world coordinates
     * This is a simplified approximation - for exact coordinates,
     * use the WorldMap's pixelToLatLng method which uses the actual map projection
     */
    public positionToCoords(x: number, y: number): { lat: number, lng: number } {
        // Calculate center point
        const centerPoint = new L.Point(GameConfig.worldWidth / 2, GameConfig.worldHeight / 2);
        
        // Calculate the offset from center in pixels
        const dx = x - centerPoint.x;
        const dy = y - centerPoint.y;
        
        // Convert to distance in meters
        const distanceInPixels = Math.sqrt(dx * dx + dy * dy);
        const distanceInMeters = distanceInPixels * this.scale;
        
        // Calculate the bearing from center to the point
        // atan2 gives the angle in radians counterclockwise from the x-axis
        // We need to convert to clockwise from north (0 = north, 90 = east)
        let bearing = Math.atan2(dx, -dy); // Negative dy because y increases downward
        if (bearing < 0) {
            bearing += 2 * Math.PI; // Convert to 0-2π range
        }
        
        // Calculate the destination point using Leaflet
        return this.getDestinationPoint(this.centerLat, this.centerLng, bearing * 180 / Math.PI, distanceInMeters);
    }
    
    /**
     * Calculate distance between two points in meters using Leaflet
     */
    public getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const point1 = L.latLng(lat1, lng1);
        const point2 = L.latLng(lat2, lng2);
        return point1.distanceTo(point2);
    }
    
    /**
     * Calculate bearing between two points in radians
     */
    private getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
        // Convert to radians
        const φ1 = this.toRadians(lat1);
        const φ2 = this.toRadians(lat2);
        const Δλ = this.toRadians(lng2 - lng1);
        
        // Calculate bearing
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        
        let bearing = Math.atan2(y, x);
        if (bearing < 0) {
            bearing += 2 * Math.PI; // Convert to 0-2π range
        }
        
        return bearing;
    }
    
    /**
     * Convert degrees to radians
     */
    private toRadians(degrees: number): number {
        return degrees * Math.PI / 180;
    }
    
    /**
     * Check if a point is within a certain distance of another point
     */
    public isWithinDistance(lat1: number, lng1: number, lat2: number, lng2: number, distanceMeters: number): boolean {
        const distance = this.getDistance(lat1, lng1, lat2, lng2);
        return distance <= distanceMeters;
    }
    
    /**
     * Calculate a destination point given a starting point, bearing, and distance
     * Uses Leaflet for accuracy
     */
    public getDestinationPoint(lat: number, lng: number, bearingDegrees: number, distanceMeters: number): { lat: number, lng: number } {
        const point = L.latLng(lat, lng);
        
        // Use Leaflet's offset method
        const destination = point.toBounds(distanceMeters).getCenter();
        
        // However, since Leaflet doesn't have a direct method for this calculation,
        // we'll implement the math for a more accurate bearing calculation
        
        // Convert to radians
        const δ = distanceMeters / 6371000; // Earth radius in meters
        const θ = this.toRadians(bearingDegrees);
        const φ1 = this.toRadians(lat);
        const λ1 = this.toRadians(lng);
        
        // Calculate destination point
        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) +
                             Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
                                   Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
        
        // Convert back to degrees
        const newLat = φ2 * 180 / Math.PI;
        const newLng = λ2 * 180 / Math.PI;
        
        return { lat: newLat, lng: newLng };
    }
} 