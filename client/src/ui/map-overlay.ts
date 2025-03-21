/**
 * Map overlay component for displaying real-world maps
 * Uses Leaflet for map rendering
 */

import { GameConfig } from "../config";
import type { GeoPosition } from "../utils/geo-mapping";
import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import { PoiService, type PointOfInterest } from "../services/poi-service";
import type Phaser from "phaser";

export interface MapPoint {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: string;
}

/**
 * Interface for Phaser layer system
 */
export interface PhaserLayers {
  map: Phaser.GameObjects.Container;
  ground: Phaser.GameObjects.Container;
  entities: Phaser.GameObjects.Container;
  overlay: Phaser.GameObjects.Container;
  ui: Phaser.GameObjects.Container;
}

export class MapOverlay {
  private container: HTMLDivElement;
  private mapContainer: HTMLDivElement;
  private map: L.Map | null = null;
  private playerMarker: L.Marker | null = null;
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
  private readonly BOUNDARY_RADIUS = 600; // Reduced from 600 to 300 meters boundary radius for more focused view
  private readonly MAP_ZOOM_LEVEL = 16; // Set to 16 for an appropriate zoom level
  private fixedBoundaryLocation: [number, number] | null = null; // Fixed location for boundary circle
  private phaserLayers: PhaserLayers | null = null; // Reference to Phaser layer system

  constructor(poiService?: PoiService) {
    // Create container for the map that fills the entire game area
    this.container = document.createElement("div");
    this.container.className = "map-background";
    this.container.style.position = "absolute";
    this.container.style.left = "0";
    this.container.style.top = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.zIndex = "0"; // Set to 0 instead of -1
    this.container.style.pointerEvents = "auto"; // Changed from 'none' to 'auto' to allow map interaction

    // Add a CSS class to differentiate this as the map container
    this.container.dataset.mapContainer = "true";

    // Create map container within the main container
    this.mapContainer = document.createElement("div");
    this.mapContainer.style.width = "100%";
    this.mapContainer.style.height = "100%";
    this.container.appendChild(this.mapContainer);

    // Set tile layer URL (using OpenStreetMap by default)
    this.tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    // Add points of interest from config
    this.pointsOfInterest = GameConfig.map.pointsOfInterest || [];

    // Find the game canvas and insert the map container before it
    const canvas = document.querySelector("canvas");
    if (canvas?.parentNode) {
      canvas.parentNode.insertBefore(this.container, canvas);
    } else {
      // If canvas doesn't exist yet, add to body and will be repositioned later
      document.body.appendChild(this.container);
    }

    // Use provided POI service or create a new one
    this.poiService = poiService || new PoiService();

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
      // doubleClickZoom: true, // Enable double click zoom
      scrollWheelZoom: true, // Enable scroll wheel zoom
      // boxZoom: false, // Disable box zoom
      keyboard: false, // Disable keyboard navigation
      // zoomSnap: 0.1, // For finer zoom control if we programmatically zoom
      maxBounds: undefined, // Will be set dynamically based on player position
      zoom: 16, // Set to 16 as requested
    });

    // Add tile layer
    L.tileLayer(this.tileLayerUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
    this.map.setView([defaultCenter.lat, defaultCenter.lng], 16); // Set zoom to 16

    // Create initial boundary circle in New York
    if (this.fixedBoundaryLocation) {
      this.boundaryCircle = L.circle(this.fixedBoundaryLocation, {
        radius: this.BOUNDARY_RADIUS,
        color: "#ff3300",
        fillColor: "#ff3300",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 10",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    });
  }

  /**
   * Update player position on the map
   */
  updatePosition(position: GeoPosition): void {
    this.lastPosition = position;

    // No need to check visibility since it's always visible
    if (!this.map) return;

    const { latitude, longitude } = position;

    // Create or update player marker
    if (!this.playerMarker) {
      // Create a custom player marker that's more visible
      const playerIcon = L.divIcon({
        className: 'player-marker',
        html: `<div style="background-color: #0088ff; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      this.playerMarker = L.marker([latitude, longitude], { 
        icon: playerIcon,
        zIndexOffset: 1000 // Ensure player marker is above other markers
      }).addTo(this.map);
      
      // Bind a popup to the marker showing "You are here"
      this.playerMarker.bindPopup("You are here");
    } else {
      this.playerMarker.setLatLng([latitude, longitude]);
    }

    // Center the map on the player's position while maintaining zoom level
    this.map.setView([latitude, longitude], this.map.getZoom() || 16, {
      animate: true,
      duration: 0.5
    });

    // Update boundary circle if needed
    this.updateMapView();
  }

  /**
   * Update the map view based on current position
   */
  private updateMapView(): void {
    if (!this.map || !this.lastPosition) return;

    const { latitude, longitude } = this.lastPosition;

    // Only update boundary circle if not fixed to New York
    if (!this.fixedBoundaryLocation) {
      // Update boundary circle position if it exists, otherwise create it
      if (this.boundaryCircle) {
        this.boundaryCircle.setLatLng([latitude, longitude]);
      } else {
        this.boundaryCircle = L.circle([latitude, longitude], {
          radius: this.BOUNDARY_RADIUS,
          color: "#ff3300",
          fillColor: "#ff3300",
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "5, 10",
        }).addTo(this.map);
      }
    } else if (!this.boundaryCircle && this.map) {
      // If we have a fixed location but no boundary circle yet, create it
      this.boundaryCircle = L.circle(this.fixedBoundaryLocation, {
        radius: this.BOUNDARY_RADIUS,
        color: "#ff3300",
        fillColor: "#ff3300",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 10",
      }).addTo(this.map);
    }
  }

  /**
   * Add points of interest to the map
   */
  private addPointsOfInterest(): void {
    if (!this.map || !GameConfig.map.features.showPointsOfInterest) return;

    // Clear existing markers
    for (const marker of this.poiMarkers.values()) {
      marker.remove();
    }
    this.poiMarkers.clear();

    // Add each point of interest
    for (const poi of this.pointsOfInterest) {
      // Create custom icon based on POI type
      const icon = this.createPoiIcon(poi.type);

      // Create marker
      const marker = L.marker([poi.latitude, poi.longitude], { icon }).addTo(
        this.map!,
      );

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
          weight: 1,
        }).addTo(this.map!);
      }
    }
  }

  /**
   * Create a custom icon for a POI based on its type
   * Fix for TypeScript type error by explicitly declaring return type
   */
  private createPoiIcon(type: string): L.DivIcon {
    const color = this.getPoiColor(type);

    return L.divIcon({
      className: "custom-poi-icon",
      html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  /**
   * Get color for a POI type
   */
  private getPoiColor(type: string): string {
    switch (type.toLowerCase()) {
      case "city":
        return "#ff4444";
      case "beach":
        return "#44aaff";
      case "forest":
        return "#44ff44";
      case "mountain":
        return "#aa7744";
      case "landmark":
        return "#ffaa44";
      default:
        return "#aa44ff";
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
    const lonCellSize =
      cellSizeMeters / (111000 * Math.cos((midLat * Math.PI) / 180));

    // Draw latitude lines
    let lat = Math.floor(south / latCellSize) * latCellSize;
    while (lat <= north) {
      L.polyline(
        [
          [lat, west],
          [lat, east],
        ],
        {
          color: "#555555",
          weight: 0.5,
          opacity: 0.5,
          dashArray: "5,5",
        },
      ).addTo(this.gridLayer);
      lat += latCellSize;
    }

    // Draw longitude lines
    let lon = Math.floor(west / lonCellSize) * lonCellSize;
    while (lon <= east) {
      L.polyline(
        [
          [south, lon],
          [north, lon],
        ],
        {
          color: "#555555",
          weight: 0.5,
          opacity: 0.5,
          dashArray: "5,5",
        },
      ).addTo(this.gridLayer);
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
        [
          [cellLatBase, cellLonBase],
          [cellLatBase + latCellSize, cellLonBase + lonCellSize],
        ],
        {
          color: "#ff0000",
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0.1,
          fillColor: "#ff0000",
          dashArray: "5,5",
        },
      ).addTo(this.gridLayer);
    }
  }

  /**
   * Add a custom point to the map
   */
  addCustomPoint(
    name: string,
    latitude: number,
    longitude: number,
    type = "custom",
  ): void {
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

    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
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
      for (const poi of pois) {
        this.addPoiMarker(poi);
      }

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
      marker.on("click", () => {
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

    content += "</div>";

    return content;
  }

  /**
   * Adjust the map view to fit all POIs
   */
  private fitMapToPois(pois: PointOfInterest[]): void {
    if (!this.map || pois.length === 0) return;

    // Create a bounds object
    const bounds = L.latLngBounds([]);

    // Add all POI positions to the bounds
    for (const poi of pois) {
      bounds.extend([poi.latitude, poi.longitude]);
    }

    // If player marker exists, include it in the bounds
    if (this.playerMarker) {
      bounds.extend(this.playerMarker.getLatLng());
    }

    // Store the bounding box for later reference
    this.boundingBox = bounds;
  }

  /**
   * Clear all POI markers from the map
   */
  private clearPoiMarkers(): void {
    if (!this.map) return;

    // Remove all markers from the map
    for (const marker of this.poiMarkers.values()) {
      marker.remove();
    }

    // Clear the markers map
    this.poiMarkers.clear();
  }

  /**
   * Draw a grid cell on the map
   */
  public drawGridCell(
    topLeft: [number, number],
    bottomRight: [number, number],
    color = "rgba(255, 0, 0, 0.2)",
  ): void {
    if (!this.map || !this.gridLayer) return;

    // Create a rectangle
    const rectangle = L.rectangle(
      [
        [topLeft[0], topLeft[1]],
        [bottomRight[0], bottomRight[1]],
      ],
      {
        color: color,
        weight: 1,
        fillOpacity: 0.2,
      },
    );

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

  /**
   * Set the Phaser layer system to integrate with
   * This allows MapOverlay to coordinate with Phaser's rendering layers
   */
  setPhaserLayers(layers: PhaserLayers): void {
    this.phaserLayers = layers;

    // Update visibility based on layers
    if (this.phaserLayers && this.container) {
      // Make sure the map container has the correct z-index
      this.container.style.zIndex = "0";

      // Ensure the container is positioned correctly
      this.container.style.visibility = "visible";
      this.container.style.display = "block";

      // Find the canvas again to make sure the map is correctly positioned
      const canvas = document.querySelector("canvas");
      if (canvas?.parentNode) {
        // Insert the map container right before the canvas in the DOM
        canvas.parentNode.insertBefore(this.container, canvas);
      }
    }
  }

  /**
   * Initialize POI Service for POI data
   */
  private initializePoiService(): void {
    // If we have a poiService, set up event listeners
    // but don't automatically load POIs - that will be handled by GameUI
    if (this.poiService) {
      // Listen for POI updates (this will trigger when POIs are discovered)
      this.poiService.onPoiUpdated((poi) => {
        if (poi.discovered || poi.type === "city") {
          // Update or add the POI marker
          this.addCustomPoint(poi.name, poi.latitude, poi.longitude, poi.type);
        }
      });

      // If we have a callback for when POIs are loaded, call it
      if (this.onRefreshCallback) {
        this.onRefreshCallback();
      }
    }
  }
}
