import { GeolocationService } from "../services/geolocation-service";
import { GeoMapper, type GeoPosition } from "../utils/geo-mapping";
import { GameConfig } from "../config";
import { WorldService } from "../services/world-service";
import Phaser from "phaser";

/**
 * LocationManager handles geolocation tracking and converts real-world
 * coordinates to in-game positions.
 */
export class LocationManager {
  private scene: Phaser.Scene;
  private worldService: WorldService;
  private geoService: GeolocationService;
  private geoMapper: GeoMapper;
  private lastGeoPosition: GeoPosition | null = null;
  private useGeolocation: boolean = true;
  private manualControls: boolean = false;
  private updatePositionTimer: number = 0;
  private locationStatusIndicator?: Phaser.GameObjects.Container;
  private locationErrorText?: Phaser.GameObjects.Text;
  private debugMarker?: Phaser.GameObjects.Graphics;
  private debugText?: Phaser.GameObjects.Text;
  private playerId: string = "";
  private onPositionUpdateCallback: ((position: GeoPosition) => void) | null = null;
  private onManualControlsChangedCallback: ((enabled: boolean) => void) | null = null;

  constructor(scene: Phaser.Scene, worldService: WorldService) {
    this.scene = scene;
    this.worldService = worldService;
    this.geoService = new GeolocationService();
    
    // Initialize GeoMapper with default config
    this.geoMapper = new GeoMapper({
      originLatitude: GameConfig.map.originLatitude,
      originLongitude: GameConfig.map.originLongitude,
      boundaryLatitude: GameConfig.map.boundaryLatitude,
      boundaryLongitude: GameConfig.map.boundaryLongitude,
      worldWidth: GameConfig.worldWidth,
      worldHeight: GameConfig.worldHeight
    });
  }

  /**
   * Initialize the location manager with the player ID
   */
  public initialize(playerId: string): void {
    this.playerId = playerId;
    
    // Create location status indicator
    this.createLocationStatusIndicator();
  }

  /**
   * Clean up resources and listeners
   */
  public destroy(): void {
    // Stop geolocation tracking
    if (this.useGeolocation) {
      this.geoService.stopTracking();
    }
    
    // Clean up UI elements
    if (this.locationStatusIndicator) {
      this.locationStatusIndicator.destroy();
      this.locationStatusIndicator = undefined;
    }
    
    if (this.locationErrorText) {
      this.locationErrorText.destroy();
      this.locationErrorText = undefined;
    }
    
    if (this.debugMarker) {
      this.debugMarker.destroy();
      this.debugMarker = undefined;
    }
    
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = undefined;
    }
  }

  /**
   * Update timer for position broadcasting
   */
  public update(delta: number): void {
    if (!this.useGeolocation || this.manualControls) return;
    
    // Update timer for periodic position updates
    this.updatePositionTimer += delta;
    if (this.updatePositionTimer >= 5000) { // Send every 5 seconds
      if (this.lastGeoPosition) {
        this.updatePlayerPosition();
      }
      this.updatePositionTimer = 0;
    }
  }

  /**
   * Start tracking the player's real-world location
   */
  public async startLocationTracking(): Promise<void> {
    // If we're not using geolocation, just use manual controls
    if (!this.useGeolocation) {
      this.setManualControls(true);
      return;
    }
    
    try {
      // Request location permission and start tracking
      const position = await this.geoService.startTracking();
      
      // Convert browser position to our format and update
      this.handleLocationUpdate(position);
      
      // Set up event listeners for future updates without sending last position again
      this.geoService.onLocationUpdate(this.handleLocationUpdate.bind(this), false);
      this.geoService.onLocationError(this.handleLocationError.bind(this));
      
      // Update location status indicator
      this.updateLocationStatusIndicator(true);
      
    } catch (error) {
      console.error("Geolocation error:", error);
      
      // Show error message
      this.handleLocationError(error as GeolocationPositionError);
      
      // Update location status indicator
      this.updateLocationStatusIndicator(false);
      
      // Fall back to manual controls
      this.setManualControls(true);
    }
  }

  /**
   * Enable or disable geolocation
   */
  public setUseGeolocation(enabled: boolean): void {
    if (this.useGeolocation === enabled) return;
    
    this.useGeolocation = enabled;
    
    if (enabled) {
      this.startLocationTracking();
    } else {
      this.geoService.stopTracking();
      this.setManualControls(true);
    }
  }

  /**
   * Enable or disable manual controls
   */
  public setManualControls(enabled: boolean): void {
    this.manualControls = enabled;
    
    // Notify callback if registered
    if (this.onManualControlsChangedCallback) {
      this.onManualControlsChangedCallback(enabled);
    }
  }

  /**
   * Get the current geolocation status
   */
  public isUsingGeolocation(): boolean {
    return this.useGeolocation && !this.manualControls;
  }

  /**
   * Check if manual controls are enabled
   */
  public isUsingManualControls(): boolean {
    return this.manualControls;
  }

  /**
   * Get the last known position
   */
  public getLastPosition(): GeoPosition | null {
    return this.lastGeoPosition;
  }

  /**
   * Register a callback for position updates
   * @param callback The function to call when position is updated
   * @param sendLastPosition Whether to immediately send the last known position (defaults to false)
   */
  public onPositionUpdate(callback: (position: GeoPosition) => void, sendLastPosition: boolean = false): void {
    this.onPositionUpdateCallback = callback;
    
    // If we already have a position and sendLastPosition is true, send it immediately
    if (sendLastPosition && this.lastGeoPosition && this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(this.lastGeoPosition);
    }
  }

  /**
   * Register a callback for when manual controls setting changes
   */
  public onManualControlsChanged(callback: (enabled: boolean) => void): void {
    this.onManualControlsChangedCallback = callback;
  }

  /**
   * Handle location updates from the GeolocationService
   */
  private handleLocationUpdate(position: GeolocationPosition): void {
    // Convert browser position to our format
    this.lastGeoPosition = this.geoMapper.browserPositionToGeoPosition(position);
    
    // Check if position is within map boundaries
    const isInBounds = this.geoMapper.isWithinBoundaries(
      this.lastGeoPosition.latitude, 
      this.lastGeoPosition.longitude
    );
    
    if (!isInBounds) {
      console.warn("Player location is outside map boundaries");
    }
    
    // Update debug marker if enabled
    this.updateDebugInfo();
    
    // Notify position update callback
    if (this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(this.lastGeoPosition);
    }
  }

  /**
   * Handle geolocation errors
   */
  private handleLocationError(error: GeolocationPositionError): void {
    console.error("Location error:", error);
    
    let errorMessage = "Location error: ";
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage += "Permission denied. Please enable location services.";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage += "Position unavailable. Check your device's GPS.";
        break;
      case error.TIMEOUT:
        errorMessage += "Location request timed out. Please try again.";
        break;
      default:
        errorMessage += error.message || "Unknown error";
    }
    
    // Show error message
    this.showLocationError(errorMessage);
    
    // Enable manual controls so the player can move around
    this.setManualControls(true);
  }
  
  /**
   * Show location error message on screen
   */
  private showLocationError(message: string): void {
    // Create error text if it doesn't exist
    if (!this.locationErrorText) {
      this.locationErrorText = this.scene.add
        .text(640, 100, "", {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#ff0000",
          backgroundColor: "#00000088",
          padding: { left: 10, right: 10, top: 5, bottom: 5 },
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(1000)
        .setVisible(false);
    }
    
    // Update and show the error message
    this.locationErrorText.setText(message);
    this.locationErrorText.setVisible(true);
    
    // Hide after 5 seconds
    this.scene.time.delayedCall(5000, () => {
      if (this.locationErrorText) {
        this.locationErrorText.setVisible(false);
      }
    });
  }

  /**
   * Create a location status indicator
   */
  private createLocationStatusIndicator(): void {
    // Create a container to hold the indicator components
    this.locationStatusIndicator = this.scene.add.container(1240, 50);

    // Add background
    const bg = this.scene.add.rectangle(0, 0, 20, 20, 0x000000, 0.6).setOrigin(0.5);

    // Add status circle (initial color is yellow for unknown)
    const circle = this.scene.add.circle(0, 0, 6, 0xffff00).setOrigin(0.5);

    // Add text label
    const label = this.scene.add
      .text(15, 0, "Location", {
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    // Add all elements to the container
    this.locationStatusIndicator.add([bg, circle, label]);

    // Make it fixed to camera
    this.locationStatusIndicator.setScrollFactor(0);

    // Set depth to always appear on top
    this.locationStatusIndicator.setDepth(1000);
  }
  
  /**
   * Update the location status indicator based on current status
   */
  private updateLocationStatusIndicator(isActive: boolean): void {
    if (!this.locationStatusIndicator) return;

    const circle = this.locationStatusIndicator.getAt(1) as Phaser.GameObjects.Arc;
    const label = this.locationStatusIndicator.getAt(2) as Phaser.GameObjects.Text;

    if (!circle || !label) return;

    // Set color based on status
    if (isActive) {
      circle.fillColor = 0x00ff00; // Green for active
      label.setText("GPS Active");
    } else {
      circle.fillColor = 0xff0000; // Red for inactive/error
      label.setText("GPS Inactive");
    }
  }
  
  /**
   * Create debug visualization for location data
   */
  private updateDebugInfo(): void {
    // Check if debug is enabled in GameConfig 
    if (!this.lastGeoPosition || !GameConfig.debug) return;
    
    // Create debug marker if it doesn't exist
    if (!this.debugMarker) {
      this.debugMarker = this.scene.add.graphics();
      this.debugMarker.setDepth(100);
      
      // Add debug text
      this.debugText = this.scene.add.text(0, 0, "", {
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { left: 5, right: 5, top: 2, bottom: 2 },
      });
      this.debugText.setDepth(101);
    }
    
    // Clear previous graphics
    this.debugMarker.clear();
    
    // Draw accuracy circle
    if (this.lastGeoPosition.accuracy) {
      // Convert accuracy from meters to game units
      // This is approximate - would need proper scaling based on your map
      const accuracyRadius = this.lastGeoPosition.accuracy / 10; // Example scaling
      
      // Draw semi-transparent circle
      this.debugMarker.fillStyle(0x0088ff, 0.2);
      this.debugMarker.fillCircle(
        this.lastGeoPosition.x, 
        this.lastGeoPosition.y, 
        accuracyRadius
      );
      
      // Draw outline
      this.debugMarker.lineStyle(1, 0x0088ff, 0.8);
      this.debugMarker.strokeCircle(
        this.lastGeoPosition.x, 
        this.lastGeoPosition.y, 
        accuracyRadius
      );
    }
    
    // Draw point at exact location
    this.debugMarker.fillStyle(0x0088ff, 1);
    this.debugMarker.fillCircle(
      this.lastGeoPosition.x, 
      this.lastGeoPosition.y, 
      5
    );
    
    // Update debug text
    if (this.debugText) {
      this.debugText.setText(
        `Lat: ${this.lastGeoPosition.latitude.toFixed(6)}\n` +
        `Lng: ${this.lastGeoPosition.longitude.toFixed(6)}\n` +
        `Acc: ${this.lastGeoPosition.accuracy?.toFixed(1)}m\n` +
        `X: ${Math.round(this.lastGeoPosition.x)}\n` +
        `Y: ${Math.round(this.lastGeoPosition.y)}`
      );
      this.debugText.setPosition(
        this.lastGeoPosition.x + 10,
        this.lastGeoPosition.y - 30
      );
    }
  }

  /**
   * Send player position update to the server
   */
  private async updatePlayerPosition(): Promise<void> {
    if (!this.lastGeoPosition || !this.playerId) return;

    try {
      // Call updatePlayerPosition with x and y coordinates
      await this.worldService.updatePlayerPosition(
        this.lastGeoPosition.x,
        this.lastGeoPosition.y
      );
    } catch (error) {
      console.error("Failed to update position:", error);
    }
  }

  /**
   * Relocate the player to the default position
   * This should be called when the player clicks a relocate button
   */
  public relocateToDefaultPosition(): void {
    // Create default position (New York - Times Square)
    const defaultPosition = {
      coords: {
        latitude: GameConfig.map.defaultCenter.lat,
        longitude: GameConfig.map.defaultCenter.lng,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };
    
    // Process the default position as if it came from geolocation
    this.handleLocationUpdate(defaultPosition as unknown as GeolocationPosition);
  }
} 