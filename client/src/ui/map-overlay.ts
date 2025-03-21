/**
 * Map overlay component for displaying real-world maps
 * Uses Leaflet for map rendering
 */

import { GameConfig } from "../config";
import { GeoPosition } from "../utils/geo-mapping";
import "leaflet/dist/leaflet.css";
import * as L from 'leaflet';
import { PoiService, PointOfInterest, PoiType } from '../services/poi-service';

export interface MapPoint {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: string;
}

export class MapOverlay {
  private container: HTMLDivElement;
  private mapContainer: HTMLDivElement;
  private map: L.Map | null = null;
  private playerMarker: L.Marker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private boundaryCircle: L.Circle | null = null;
  private poiMarkers: Map<string, L.Marker> = new Map();
  private gridLayer: L.LayerGroup | null = null;
  private isVisible = true; // Always visible now
  private lastPosition: GeoPosition | null = null;
  private tileLayerUrl: string;
  private pointsOfInterest: MapPoint[] = [];
  private poiService: PoiService;
  private onRefreshCallback: (() => void) | null = null;
  private boundingBox: L.LatLngBounds | null = null;
  private poiClickListener: ((poi: PointOfInterest) => void) | null = null;
  private readonly BOUNDARY_RADIUS = 300; // Reduced from 600 to 300 meters boundary radius for more focused view
  private readonly MAP_ZOOM_LEVEL = 19; // Increased zoom level from 18 to 19 for closer view
  private fixedBoundaryLocation: [number, number] | null = null; // Fixed location for boundary circle

  constructor() {
    // Create container for the map that fills the entire game area
    this.container = document.createElement("div");
    this.container.className = "map-background";
    this.container.style.position = "absolute";
    this.container.style.left = "0";
    this.container.style.top = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.zIndex = "0"; // Bottom layer
    this.container.style.overflow = "hidden";

    // Create map container within the main container
    this.mapContainer = document.createElement("div");
    this.mapContainer.style.width = "100%";
    this.mapContainer.style.height = "100%";
    this.container.appendChild(this.mapContainer);

    // Set tile layer URL (using OpenStreetMap by default)
    this.tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    // Add points of interest from config
    this.pointsOfInterest = GameConfig.map.pointsOfInterest || [];

    // Add element to DOM
    document.body.appendChild(this.container);

    // Initialize the map immediately
    this.poiService = new PoiService();
    
    // Set fixed boundary in New York
    this.setFixedBoundaryInNewYork();
    
    // Initialize the map and POI service
    this.initializeMap();
    this.initializePoiService();
  }

  /**
   * Sets the boundary circle to a fixed location in New York
   */
  setFixedBoundaryInNewYork(): void {
    const nyc = GameConfig.map.defaultCenter;
    this.fixedBoundaryLocation = [nyc.lat, nyc.lng]; // Set to New York coordinates
  }

  /**
   * Initialize the map immediately
   */
  private initializeMap(): void {
    if (this.map) return;

    // Fix Leaflet icon path issue
    this.fixLeafletIconPath();

    // Create Leaflet map instance with disabled zoom controls and interactions
    this.map = L.map(this.mapContainer, {
      attributionControl: false,
      // zoomControl: false, // Disable zoom controls
      dragging: true, // Keep panning enabled
      touchZoom: true, // Enable touch zoom for better user control
      doubleClickZoom: true, // Enable double click zoom
      scrollWheelZoom: true, // Enable scroll wheel zoom
      // boxZoom: false, // Disable box zoom
      keyboard: false, // Disable keyboard navigation
      zoomSnap: 0.1, // For finer zoom control if we programmatically zoom
      maxBounds: undefined, // Will be set dynamically based on player position
      zoom: this.MAP_ZOOM_LEVEL,
    });

    // Add tile layer
    L.tileLayer(this.tileLayerUrl, {
      maxZoom: 21, // Increased from 19 to 21 to allow deeper zoom levels
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    // Create layer for grid
    this.gridLayer = L.layerGroup().addTo(this.map);

    // Add map attribution in a way that doesn't interfere with our UI
    L.control
      .attribution({
        position: "bottomright",
        prefix: "Map data",
      })
      .addTo(this.map);

    // Initialize with center point if no position yet
    const defaultCenter = GameConfig.map.defaultCenter;
    this.map.setView([defaultCenter.lat, defaultCenter.lng], this.MAP_ZOOM_LEVEL);

    // Create initial boundary circle in New York
    if (this.fixedBoundaryLocation) {
      this.boundaryCircle = L.circle(this.fixedBoundaryLocation, {
        radius: this.BOUNDARY_RADIUS,
        color: '#ff3300',
        fillColor: '#ff3300',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 10'
      }).addTo(this.map);
    }

    // Add points of interest
    this.addPointsOfInterest();

    // Add grid overlay if enabled in config
    if (GameConfig.map.features.showDebugGrid) {
      this.drawGrid();
    }
  }

  /**
   * Fix for Leaflet's icon path issue in bundled environments
   */
  private fixLeafletIconPath(): void {
    // This fixes an issue with Leaflet marker icons in bundled environments
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }

  /**
   * Update player position on the map
   */
  updatePosition(position: GeoPosition): void {
    this.lastPosition = position;
    
    // No need to check visibility since it's always visible
    if (!this.map) return;
    
    // Update map view
    this.updateMapView();
  }

  /**
   * Update the map view based on current position
   */
  private updateMapView(): void {
    if (!this.map || !this.lastPosition) return;
    
    const { latitude, longitude, accuracy } = this.lastPosition;
    
    // Create or update player marker
    if (!this.playerMarker) {
      this.playerMarker = L.marker([latitude, longitude]).addTo(this.map);
    } else {
      this.playerMarker.setLatLng([latitude, longitude]);
    }
    
    // Create or update accuracy circle
    if (accuracy && GameConfig.map.features.showAccuracyRadius) {
      if (!this.accuracyCircle) {
        this.accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.2,
          weight: 1
        }).addTo(this.map);
      } else {
        this.accuracyCircle.setLatLng([latitude, longitude]);
        this.accuracyCircle.setRadius(accuracy);
      }
    }
    
    // Only update boundary circle if not fixed to New York
    if (!this.fixedBoundaryLocation) {
      // Update boundary circle position if it exists, otherwise create it
      if (this.boundaryCircle) {
        this.boundaryCircle.setLatLng([latitude, longitude]);
      } else {
        this.boundaryCircle = L.circle([latitude, longitude], {
          radius: this.BOUNDARY_RADIUS,
          color: '#ff3300',
          fillColor: '#ff3300',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 10'
        }).addTo(this.map);
      }
    } else if (!this.boundaryCircle && this.map) {
      // If we have a fixed location but no boundary circle yet, create it
      this.boundaryCircle = L.circle(this.fixedBoundaryLocation, {
        radius: this.BOUNDARY_RADIUS,
        color: '#ff3300',
        fillColor: '#ff3300',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 10'
      }).addTo(this.map);
    }
    
    // Center map on player with fixed zoom level
    this.map.setView([latitude, longitude], this.MAP_ZOOM_LEVEL, {
      animate: true,
      duration: 0.5
    });
    
    // Allow manual zooming by user instead of forcing fixed zoom
    // Only reset zoom if it drops below our minimum preferred level
    const currentZoom = this.map.getZoom();
    if (currentZoom < this.MAP_ZOOM_LEVEL - 2) {
      this.map.setZoom(this.MAP_ZOOM_LEVEL);
    }
  }

  /**
   * Add points of interest to the map
   */
  private addPointsOfInterest(): void {
    if (!this.map || !GameConfig.map.features.showPointsOfInterest) return;
    
    // Clear existing markers
    this.poiMarkers.forEach(marker => marker.remove());
    this.poiMarkers.clear();
    
    // Add each point of interest
    this.pointsOfInterest.forEach(poi => {
      // Create custom icon based on POI type
      const icon = this.createPoiIcon(poi.type);
      
      // Create marker
      const marker = L.marker([poi.latitude, poi.longitude], { icon }).addTo(this.map!);
      
      // Add popup with info
      marker.bindPopup(`<b>${poi.name}</b><br>Type: ${poi.type}`);
      
      // Add to tracking array
      this.poiMarkers.set(poi.name, marker);
      
      // Add influence radius if specified
      if (poi.radius) {
        L.circle([poi.latitude, poi.longitude], {
          radius: poi.radius,
          color: this.getPoiColor(poi.type),
          fillOpacity: 0.1,
          weight: 1
        }).addTo(this.map!);
      }
    });
  }

  /**
   * Create a custom icon for a POI based on its type
   * Fix for TypeScript type error by explicitly declaring return type
   */
  private createPoiIcon(type: string): L.DivIcon {
    const color = this.getPoiColor(type);
    
    return L.divIcon({
      className: 'custom-poi-icon',
      html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  /**
   * Get color for a POI type
   */
  private getPoiColor(type: string): string {
    switch (type.toLowerCase()) {
      case 'city': return '#ff4444';
      case 'beach': return '#44aaff';
      case 'forest': return '#44ff44';
      case 'mountain': return '#aa7744';
      case 'landmark': return '#ffaa44';
      default: return '#aa44ff';
    }
  }

  /**
   * Draw grid cells on the map
   */
  private drawGrid(): void {
    if (!this.map || !this.gridLayer) return;
    
    // Clear existing grid
    this.gridLayer.clearLayers();
    
    // Get map bounds
    const bounds = this.map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    
    // Calculate cell size in degrees (approximate)
    // For more accuracy, we'd need to account for the Earth's curvature
    const cellSizeMeters = GameConfig.map.cellSizeMeters;
    // 1 degree of latitude is approximately 111km (111,000m)
    const latCellSize = cellSizeMeters / 111000;
    // 1 degree of longitude varies with latitude
    const midLat = (north + south) / 2;
    const lonCellSize = cellSizeMeters / (111000 * Math.cos(midLat * Math.PI / 180));
    
    // Draw latitude lines
    let lat = Math.floor(south / latCellSize) * latCellSize;
    while (lat <= north) {
      L.polyline([[lat, west], [lat, east]], {
        color: '#555555',
        weight: 0.5,
        opacity: 0.5,
        dashArray: '5,5'
      }).addTo(this.gridLayer);
      lat += latCellSize;
    }
    
    // Draw longitude lines
    let lon = Math.floor(west / lonCellSize) * lonCellSize;
    while (lon <= east) {
      L.polyline([[south, lon], [north, lon]], {
        color: '#555555',
        weight: 0.5,
        opacity: 0.5,
        dashArray: '5,5'
      }).addTo(this.gridLayer);
      lon += lonCellSize;
    }
    
    // If we have a player position, highlight their current cell
    if (this.lastPosition) {
      const { latitude, longitude } = this.lastPosition;
      
      // Calculate cell boundaries
      const cellLatBase = Math.floor(latitude / latCellSize) * latCellSize;
      const cellLonBase = Math.floor(longitude / lonCellSize) * lonCellSize;
      
      // Draw current cell with different style
      L.rectangle(
        [[cellLatBase, cellLonBase], [cellLatBase + latCellSize, cellLonBase + lonCellSize]],
        {
          color: '#ff0000',
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0.1,
          fillColor: '#ff0000',
          dashArray: '5,5'
        }
      ).addTo(this.gridLayer);
    }
  }

  /**
   * Add a custom point to the map
   */
  addCustomPoint(name: string, latitude: number, longitude: number, type: string = 'custom'): void {
    if (!this.map) return;
    
    const icon = this.createPoiIcon(type);
    const marker = L.marker([latitude, longitude], { icon }).addTo(this.map);
    marker.bindPopup(`<b>${name}</b>`);
    this.poiMarkers.set(name, marker);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Initialize the POI service and set up event listeners
   */
  private async initializePoiService(): Promise<void> {
    try {
      // Initialize the service and load initial POIs
      await this.poiService.initialize();
      
      // Set up listeners for POI updates
      this.poiService.onPoiUpdated(this.handlePoiUpdated.bind(this));
      this.poiService.onPoisLoaded(this.handlePoisLoaded.bind(this));
    } catch (error) {
      console.error('Failed to initialize POI service:', error);
    }
  }
  
  /**
   * Handle when a single POI is updated
   */
  private handlePoiUpdated(poi: PointOfInterest): void {
    // Update the marker on the map if it exists
    if (this.map && this.isVisible) {
      if (this.poiMarkers.has(poi.name)) {
        // Update existing marker
        const marker = this.poiMarkers.get(poi.name);
        if (marker) {
          // Update marker position
          marker.setLatLng([poi.latitude, poi.longitude]);
          
          // Update popup content
          const popup = marker.getPopup();
          if (popup) {
            popup.setContent(this.createPoiPopupContent(poi));
          } else {
            marker.bindPopup(this.createPoiPopupContent(poi));
          }
          
          // Update icon if POI type changed
          marker.setIcon(this.createPoiIcon(poi.type));
        }
      } else {
        // Add new marker
        this.addPoiMarker(poi);
      }
    }
  }
  
  /**
   * Handle when all POIs are loaded
   */
  private handlePoisLoaded(pois: PointOfInterest[]): void {
    if (this.map && this.isVisible) {
      // Clear existing markers
      this.clearPoiMarkers();
      
      // Add markers for all POIs
      pois.forEach(poi => {
        this.addPoiMarker(poi);
      });
      
      // Fit map to bounds of all POIs
      this.fitMapToPois(pois);
    }
  }
  
  /**
   * Add a marker for a POI
   */
  private addPoiMarker(poi: PointOfInterest): void {
    if (!this.map) return;
    
    const { latitude, longitude, name, type, id } = poi;
    
    // Create icon based on POI type
    const icon = this.createPoiIcon(type);
    
    // Create marker
    const marker = L.marker([latitude, longitude], { icon }).addTo(this.map);
    
    // Create popup content
    const popupContent = this.createPoiPopupContent(poi);
    marker.bindPopup(popupContent);
    
    // Store marker
    this.poiMarkers.set(id, marker);
    
    // Add click handler for interactive POIs
    if (poi.interactable && this.poiClickListener) {
      marker.on('click', () => {
        if (this.poiClickListener) {
          this.poiClickListener(poi);
        }
      });
    }
  }
  
  /**
   * Create popup content for a POI
   */
  private createPoiPopupContent(poi: PointOfInterest): string {
    let content = `<div class="poi-popup">
      <h3>${poi.name}</h3>
      <p>${poi.description}</p>`;
      
    if (poi.visited) {
      content += `<p class="visited">✓ Visited</p>`;
    }
    
    if (poi.interactable) {
      content += `<p class="interactable">Click to interact</p>`;
    }
    
    content += `</div>`;
    
    return content;
  }
  
  /**
   * Update POIs displayed on map based on player position
   */
  private updateNearbyPois(latitude: number, longitude: number): void {
    // Get POIs within a certain radius
    const nearbyPois = this.poiService.getPoisNearLocation(latitude, longitude, 5); // 5km radius
    
    // Update distance info for each POI marker
    nearbyPois.forEach(poi => {
      const marker = this.poiMarkers.get(poi.name);
      if (marker) {
        // Update popup content with distance
        marker.bindPopup(this.createPoiPopupContent(poi));
      }
    });
  }
  
  /**
   * Load and display POIs that are visible in the current map view
   */
  private loadVisiblePois(): void {
    if (!this.map || !this.isVisible) return;
    
    // Get all POIs from service
    const allPois = this.poiService.getAllPois();
    
    // Clear existing markers
    this.clearPoiMarkers();
    
    // Add markers for all POIs
    allPois.forEach(poi => {
      // Only add POIs that have been discovered or are always visible
      if (poi.discovered || poi.type === 'city') {
        this.addPoiMarker(poi);
      }
    });
    
    // Fit map to bounds of shown POIs
    this.fitMapToPois(allPois.filter(p => p.discovered || p.type === 'city'));
  }
  
  /**
   * Adjust the map view to fit all POIs
   */
  private fitMapToPois(pois: PointOfInterest[]): void {
    if (!this.map || pois.length === 0) return;
    
    // Create a bounds object
    let bounds = L.latLngBounds([]);
    
    // Add all POI positions to the bounds
    pois.forEach(poi => {
      bounds.extend([poi.latitude, poi.longitude]);
    });
    
    // If player marker exists, include it in the bounds
    if (this.playerMarker) {
      bounds.extend(this.playerMarker.getLatLng());
    }
    
    // Set a maximum zoom level to ensure proper zooming
    this.map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 19 // Increased from 15 to 19
    });
    
    // Store the bounding box for later reference
    this.boundingBox = bounds;
  }
  
  /**
   * Clear all POI markers from the map
   */
  private clearPoiMarkers(): void {
    if (!this.map) return;
    
    // Remove all markers from the map
    this.poiMarkers.forEach(marker => {
      marker.remove();
    });
    
    // Clear the markers map
    this.poiMarkers.clear();
  }

  /**
   * Draw a grid cell on the map
   */
  public drawGridCell(topLeft: [number, number], bottomRight: [number, number], color: string = 'rgba(255, 0, 0, 0.2)'): void {
    if (!this.map || !this.gridLayer) return;
    
    // Create a rectangle
    const rectangle = L.rectangle([
      [topLeft[0], topLeft[1]],
      [bottomRight[0], bottomRight[1]]
    ], {
      color: color,
      weight: 1,
      fillOpacity: 0.2
    });
    
    // Add to grid layer
    this.gridLayer.addLayer(rectangle);
  }
  
  /**
   * Clear all grid cells
   */
  public clearGridCells(): void {
    if (!this.gridLayer) return;
    
    // Clear all layers
    this.gridLayer.clearLayers();
  }
  
  /**
   * Set a handler for POI click events
   */
  public setPoiClickListener(listener: (poi: PointOfInterest) => void): void {
    this.poiClickListener = listener;
  }

  /**
   * Get the visibility status of the map (always true now)
   */
  public getVisibility(): boolean {
    return true; // Always return true as it's always visible
  }
} 