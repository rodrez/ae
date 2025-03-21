import Phaser from "phaser";
import { GameConfig } from "../config";
import type { Player } from "../entities/characters/player";
import type { OtherPlayer } from "../entities/characters/other-player";
import { WorldService } from "../services/world-service";
import { RoomInfoDisplay } from "../ui/room-info-display";
import { GeolocationService } from "../services/geolocation-service";
import { GeoMapper, type GeoPosition } from "../utils/geo-mapping";
import { PoiService, type PointOfInterest } from "../services/poi-service";
import { GameUI } from "../ui/game-ui";
import { ConnectionManager } from "../managers/connection-manager";
import { PlayerManager } from "../managers/player-manager";
import { LocationManager } from "../managers/location-manager";
import { PhaserMap } from "../entities/phaser-map";
import { HtmlLoggerPanel } from "../ui/debug/html-logger-panel";
import { logger, LogCategory, LogLevel } from "../utils/logger";

// Extended GeoPosition interface with accuracy
interface EnhancedGeoPosition extends GeoPosition {
  accuracy?: number;
}

// Temporary icon class for logger toggle
class LogIcon {
  private element: HTMLDivElement;
  private onClick: () => void;

  constructor(x: number, y: number, onClick: () => void) {
    this.onClick = onClick;

    this.element = document.createElement("div");
    this.element.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z"/></svg>';
    this.element.style.position = "absolute";
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.width = "32px";
    this.element.style.height = "32px";
    this.element.style.backgroundColor = "#222222";
    this.element.style.borderRadius = "50%";
    this.element.style.padding = "5px";
    this.element.style.boxSizing = "border-box";
    this.element.style.cursor = "pointer";
    this.element.style.zIndex = "1000";
    this.element.title = "Toggle Log Panel (L)";

    // Set SVG color
    const svg = this.element.querySelector("svg");
    if (svg) {
      svg.style.fill = "#ffffff";
    }

    // Add event listener
    this.element.addEventListener("click", this.onClick);

    // Add to DOM
    document.body.appendChild(this.element);
  }

  destroy(): void {
    this.element.removeEventListener("click", this.onClick);
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export class Game extends Phaser.Scene {
  // Core services
  private worldService: WorldService;
  private poiService: PoiService;

  // Managers
  private connectionManager: ConnectionManager;
  private playerManager: PlayerManager;
  private locationManager: LocationManager;
  private gameUI: GameUI;
  private phaserMap: PhaserMap;

  // Logger panel
  private loggerPanel: HtmlLoggerPanel;
  private logIcon?: LogIcon;

  // Game state
  private playerId = "";
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
      worldHeight: GameConfig.worldHeight,
    });

    this.geoService = new GeolocationService();
    this.roomInfoDisplay = new RoomInfoDisplay();
  }

  async create(): Promise<void> {
    // Initialize services
    await this.initializeServices();

    // Initialize PhaserMap (layer system and world boundaries)
    this.phaserMap = new PhaserMap(this);
    
    // Initialize UI with layer system (including map overlay)
    this.initializeGameUI();
    
    // Make sure the canvas background is transparent to allow the map to show through
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    
    // Add a semi-transparent overlay to dim the map slightly and make game elements more visible
    const mapOverlay = this.add.rectangle(
      0, 
      0, 
      GameConfig.worldWidth,
      GameConfig.worldHeight,
      0x000000,
      0.2  // 20% opacity black overlay
    );
    mapOverlay.setOrigin(0, 0);
    this.phaserMap.addToLayer('map', mapOverlay);

    // Ensure logger is configured properly
    const loggerConfig = logger.getConfig();
    console.log("Logger configuration:", loggerConfig);
    logger.setConfig({
      enabled: true,
      minLevel: LogLevel.DEBUG,
      persistToStorage: true,
    });

    // Add a test log message
    logger.info(LogCategory.SYSTEM, "Game scene initialized - logger test");

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

    // Start tracking location, but don't automatically relocate
    this.locationManager.startLocationTracking();

    // Connect the relocate button to the location manager
    this.gameUI.setRelocateHandler(() => {
      // When user clicks relocate, set up the position handler and relocate
      this.locationManager.relocateToDefaultPosition();
      logger.info(LogCategory.GAME, "User relocated to default position");

      // Then connect the location manager to player manager after user click
      this.connectLocationManagerToPlayerManager();
    });

    // Set up manual controls change handler
    this.locationManager.onManualControlsChanged((enabled) => {
      this.playerManager.setManualControls(enabled);

      const message = enabled
        ? "Manual controls enabled. Use arrow keys to move."
        : "GPS tracking active. Move in the real world to play.";

      this.gameUI.showNotification(message);
      logger.info(
        LogCategory.GAME,
        `Manual controls ${enabled ? "enabled" : "disabled"}`,
      );
    });

    // Connect player manager to game UI
    this.playerManager.onJoinWorld(() => {
      this.gameUI.updateStatus("Connected to world");
      this.gameUI.showNotification("You've joined the world!");
      logger.info(LogCategory.GAME, "Player joined the world");
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

    // Initialize logger panel
    this.initializeLoggerPanel();

    // Start the game
    this.playerManager.joinWorld();
    logger.info(LogCategory.GAME, "Game scene initialized successfully");
  }

  update(time: number, delta: number): void {
    // Update managers
    this.playerManager.update(delta);
    this.locationManager.update(delta);
  }

  shutdown(): void {
    this.gameUI.destroy();
    this.connectionManager.destroy();
    this.playerManager.destroy();
    this.locationManager.destroy();

    // Clean up logger panel and icon
    if (this.loggerPanel) {
      this.loggerPanel.destroy();
    }

    if (this.logIcon) {
      this.logIcon.destroy();
    }

    // Clean up PhaserMap
    if (this.phaserMap) {
      this.phaserMap.destroy();
    }
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
      this.gameUI?.showNotification(
        "Failed to initialize game services. Please try again.",
      );
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
    this.connectionStatus = "connected";
    this.gameUI.updateConnectionStatus(true);
    this.gameUI.showNotification("Connected to the world server!");
    logger.info(LogCategory.NETWORK, "Connected to world server");
  }

  /**
   * Handle disconnection from server
   */
  private handleDisconnected(): void {
    this.connectionStatus = "disconnected";
    this.gameUI.updateConnectionStatus(false);
    this.gameUI.showWarning("Disconnected from world server. Reconnecting...");
    logger.warn(
      LogCategory.NETWORK,
      "Disconnected from world server, attempting to reconnect",
    );

    if (!this._reconnectionInProgress) {
      this._reconnectionInProgress = true;
      this.connectionManager.attemptReconnection();
    }
  }

  /**
   * Update debug information
   */
  private updateDebugInfo(position: EnhancedGeoPosition): void {
    const isUsingGeo = this.locationManager.isUsingGeolocation();
    const connectionStatus = this.connectionManager.getConnectionStatus();

    if (!position) return;

    const debugText = [
      `Position: (${Math.round(position.x)}, ${Math.round(position.y)})`,
      `Geo: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
      `Accuracy: ${position.accuracy?.toFixed(1) || "unknown"} meters`,
      `Location: ${isUsingGeo ? "GPS" : "Manual"}`,
      `Connection: ${connectionStatus}`,
      `Players: ${this.playerManager.getPlayerCount()}`,
    ].join("\n");

    this.gameUI.updateDebugInfo(debugText);
  }

  /**
   * Connect location manager to player manager
   * This will only happen after the user clicks the relocate button
   */
  private connectLocationManagerToPlayerManager(): void {
    // Connect location manager to player manager
    this.locationManager.onPositionUpdate((position) => {
      // Update player position when location changes
      this.playerManager.setPlayerPosition(position.x, position.y);

      // Update map overlay with position
      this.gameUI.updatePlayerPosition(position);

      // Update debug info if enabled
      if (GameConfig.debug) {
        this.updateDebugInfo(position);
      }
    }, false); // Don't send last position immediately
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
        case "shop":
          // Open shop interface
          this.showShopInterface(poi);
          break;
        case "quest":
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
      poi.visited
        ? "You have visited this location before."
        : "This is your first time here!",
    );
  }

  private showShopInterface(poi: PointOfInterest) {
    // Placeholder for shop interface
    this.gameUI.showInfoModal(
      `${poi.name} - Shop`,
      poi.description,
      "Shop interface would open here in the full implementation.",
    );
  }

  private showQuestDialog(poi: PointOfInterest) {
    // Placeholder for quest dialog
    this.gameUI.showInfoModal(
      `${poi.name} - Quest`,
      poi.description,
      "Quest dialog would open here in the full implementation.",
    );
  }

  /**
   * Initialize the logger panel and set up keyboard controls
   */
  private initializeLoggerPanel(): void {
    // Create HTML-based logger panel
    this.loggerPanel = new HtmlLoggerPanel();

    // Set up keyboard shortcut to toggle logger panel (L key)
    this.input.keyboard?.addKey("L").on("down", () => {
      this.loggerPanel.toggle();
      logger.debug(LogCategory.UI, "Logger panel toggled");
    });

    // Create a visual indicator for the logger panel
    this.logIcon = new LogIcon(this.cameras.main.width - 40, 20, () => {
      this.loggerPanel.toggle();
      logger.debug(LogCategory.UI, "Logger panel toggled via indicator");
    });

    logger.info(LogCategory.UI, "Logger panel initialized");
  }

  /**
   * Initialize the GameUI with the current layer system
   */
  private initializeGameUI(): void {
    // Initialize the GameUI
    this.gameUI.initialize();
    
    // Connect map overlay to PhaserMap
    this.phaserMap.setMapOverlay(this.gameUI.mapOverlay);
  }
}
