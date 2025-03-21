import Phaser from "phaser";
import { GameConfig } from "../config";
import { Player } from "../entities/characters/player";
import { OtherPlayer } from "../entities/characters/other-player";
import { WorldService } from "../services/world-service";
import { RoomInfoDisplay } from '../ui/room-info-display';
import { GeolocationService } from "../services/geolocation-service";
import { GeoMapper, type GeoPosition } from "../utils/geo-mapping";
import { MapOverlay } from "../ui/map-overlay";
import { PoiService, PointOfInterest } from "../services/poi-service";
import { GameUI } from "../ui/game-ui";
import { ConnectionManager } from "../managers/connection-manager";
import { PlayerManager } from "../managers/player-manager";
import { LocationManager } from "../managers/location-manager";


export class Game extends Phaser.Scene {
  // Core services
  private worldService: WorldService;
  private poiService: PoiService;
  
  // Managers
  private connectionManager: ConnectionManager;
  private playerManager: PlayerManager;
  private locationManager: LocationManager;
  private gameUI: GameUI;
  
  // Game state
  private playerId: string = "";
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: Player;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private geoService: GeolocationService;
  private geoMapper: GeoMapper;
  private updatePlayerPositionTimer = 0;
  private exitButton!: Phaser.GameObjects.Text;
  private connectionErrorText?: Phaser.GameObjects.Text;
  private locationErrorText?: Phaser.GameObjects.Text;
  private connectionStatusIndicator?: Phaser.GameObjects.Container;
  private locationStatusIndicator?: Phaser.GameObjects.Container;
  private connectionStatus = "disconnected";
  private _reconnectionInProgress = false;
  private roomInfoDisplay: RoomInfoDisplay;
  private lastGeoPosition: GeoPosition | null = null;
  private useGeolocation = true; // Flag to enable/disable geolocation
  private manualControls = false; // Allow manual controls as fallback
  private debugMarker?: Phaser.GameObjects.Graphics;
  private debugText?: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
    
    // Initialize core services
    this.worldService = new WorldService();
    this.poiService = new PoiService();
    
    // Initialize managers that depend on services
    this.connectionManager = new ConnectionManager(this, this.worldService);
    this.playerManager = new PlayerManager(this, this.worldService);
    this.locationManager = new LocationManager(this, this.worldService);
    
    // Create UI instance but don't initialize it yet
    this.gameUI = new GameUI(this, this.poiService);
    
    // Initialize GeoMapper with default config - this will be updated later
    this.geoMapper = new GeoMapper({
      originLatitude: GameConfig.map.originLatitude,
      originLongitude: GameConfig.map.originLongitude,
      boundaryLatitude: GameConfig.map.boundaryLatitude,
      boundaryLongitude: GameConfig.map.boundaryLongitude,
      worldWidth: GameConfig.worldWidth,
      worldHeight: GameConfig.worldHeight
    });
    
    this.geoService = new GeolocationService();
    this.roomInfoDisplay = new RoomInfoDisplay();
  }

  async create(): Promise<void> {
    // Initialize services
    await this.initializeServices();
    
    // Initialize UI
    this.gameUI.initialize();
    this.gameUI.updateStatus("Connecting to world...");
    
    // Initialize managers
    this.connectionManager = new ConnectionManager(this, this.worldService);
    this.playerManager = new PlayerManager(this, this.worldService);
    this.locationManager = new LocationManager(this, this.worldService);
    
    // Generate a unique player ID
    this.playerId = this.generatePlayerId();
    
    // Initialize managers with player ID
    this.connectionManager.initialize();
    this.playerManager.initialize(this.playerId);
    this.locationManager.initialize(this.playerId);
    
    // Connect location manager to player manager
    this.locationManager.onPositionUpdate((position) => {
      // Update player position when location changes
      this.playerManager.setPlayerPosition(position.x, position.y);
      
      // Update map overlay with position
      this.gameUI.updatePlayerPosition(position);
      
      // Update debug info if enabled
      if (GameConfig.debug) {
        this.updateDebugInfo();
      }
    });
    
    // Start tracking location
    this.locationManager.startLocationTracking();
    
    // Set up manual controls change handler
    this.locationManager.onManualControlsChanged((enabled) => {
      this.playerManager.setManualControls(enabled);
      
      const message = enabled 
        ? "Manual controls enabled. Use arrow keys to move." 
        : "GPS tracking active. Move in the real world to play.";
        
      this.gameUI.showNotification(message);
    });
    
    // Connect player manager to game UI
    this.playerManager.onJoinWorld(() => {
      this.gameUI.updateStatus("Connected to world");
      this.gameUI.showNotification("You've joined the world!");
    });
    
    // Handle connection changes
    this.connectionManager.onConnectionStatusChange((status) => {
      if (status === "connected") {
        this.handleConnected();
      } else if (status === "disconnected") {
        this.handleDisconnected();
      }
    });
    
    // Set up POI interaction handlers
    this.setupInteractionHandlers();
    
    // Start the game
    this.playerManager.joinWorld();
  }

  update(time: number, delta: number): void {
    // Update managers
    this.playerManager.update(delta);
    this.locationManager.update(delta);
  }

  private createWorld() {
    // Create a simple background
    this.add.image(640, 360, "world-bg");

    // Add game world bounds
    this.physics.world.setBounds(
      0,
      0,
      GameConfig.worldWidth,
      GameConfig.worldHeight,
    );

    // Set up camera to follow player
    this.cameras.main.setBounds(
      0,
      0,
      GameConfig.worldWidth,
      GameConfig.worldHeight,
    );
  }

  // Create empty cursors in case keyboard is not available
  private createEmptyCursors(): Phaser.Types.Input.Keyboard.CursorKeys {
    return {
      up: { isDown: false } as Phaser.Input.Keyboard.Key,
      down: { isDown: false } as Phaser.Input.Keyboard.Key,
      left: { isDown: false } as Phaser.Input.Keyboard.Key,
      right: { isDown: false } as Phaser.Input.Keyboard.Key,
      space: { isDown: false } as Phaser.Input.Keyboard.Key,
      shift: { isDown: false } as Phaser.Input.Keyboard.Key,
    };
  }
  
  private setupInteractionHandlers() {
    // Set up POI interaction handler
    this.gameUI.setPoiInteractionHandler((poi: PointOfInterest) => {
      this.handlePoiInteraction(poi);
    });
  }
  
  private handlePoiInteraction(poi: PointOfInterest) {
    console.log(`Interacting with POI: ${poi.name}`);
    
    // Mark as visited in the POI service
    if (poi.interactable) {
      this.poiService.visitPoi(poi.id);
      
      // Handle different POI types
      switch (poi.type) {
        case 'shop':
          // Open shop interface
          this.showShopInterface(poi);
          break;
        case 'quest':
          // Open quest dialog
          this.showQuestDialog(poi);
          break;
        default:
          // Generic interaction
          this.showPoiInfo(poi);
          break;
      }
    } else {
      // Just discover it if not interactable
      this.poiService.discoverPoi(poi.id);
      this.showPoiInfo(poi);
    }
  }
  
  private showPoiInfo(poi: PointOfInterest) {
    // For now, just show information using the UI
    this.gameUI.showInfoModal(
      poi.name,
      poi.description,
      poi.visited ? 'You have visited this location before.' : 'This is your first time here!'
    );
  }
  
  private showShopInterface(poi: PointOfInterest) {
    // Placeholder for shop interface
    this.gameUI.showInfoModal(
      `${poi.name} - Shop`,
      poi.description,
      'Shop interface would open here in the full implementation.'
    );
  }
  
  private showQuestDialog(poi: PointOfInterest) {
    // Placeholder for quest dialog
    this.gameUI.showInfoModal(
      `${poi.name} - Quest`,
      poi.description,
      'Quest dialog would open here in the full implementation.'
    );
  }

  shutdown(): void {
    // Clean up resources
    this.gameUI.destroy();
    this.connectionManager.destroy();
    this.playerManager.destroy();
    this.locationManager.destroy();
  }

  /**
   * Initialize services required by the game
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize WorldService first (establishes connection)
      await this.worldService.initialize();
      
      // Then initialize POI service (loads POI data)
      await this.poiService.initialize();
      
    } catch (error) {
      console.error("Failed to initialize services:", error);
      this.gameUI?.showNotification("Failed to initialize game services. Please try again.");
    }
  }

  /**
   * Generate a unique player ID
   */
  private generatePlayerId(): string {
    // Generate a unique ID or use a stored one
    const storedId = localStorage.getItem("playerId");
    
    if (storedId) {
      return storedId;
    }
    
    // Generate a random ID if none exists
    const newId = `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("playerId", newId);
    
    return newId;
  }

  /**
   * Handle successful connection to server
   */
  private handleConnected(): void {
    this.gameUI.updateStatus("Connected to world");
  }

  /**
   * Handle disconnection from server
   */
  private handleDisconnected(): void {
    this.gameUI.updateStatus("Disconnected - Attempting to reconnect...");
    this.gameUI.showNotification("Lost connection to server. Trying to reconnect...");
  }

  /**
   * Update debug information
   */
  private updateDebugInfo(): void {
    if (!GameConfig.debug) return;
    
    const position = this.locationManager.getLastPosition();
    const isUsingGeo = this.locationManager.isUsingGeolocation();
    const connectionStatus = this.connectionManager.getConnectionStatus();
    
    if (!position) return;
    
    const debugText = [
      `Position: (${Math.round(position.x)}, ${Math.round(position.y)})`,
      `Geo: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
      `Accuracy: ${position.accuracy?.toFixed(1) || "unknown"} meters`,
      `Location: ${isUsingGeo ? "GPS" : "Manual"}`,
      `Connection: ${connectionStatus}`,
      `Players: ${this.playerManager.getPlayerCount()}`
    ].join("\n");
    
    this.gameUI.updateDebugInfo(debugText);
  }
}
