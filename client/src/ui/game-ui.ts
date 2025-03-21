import type Phaser from "phaser";
import { MapOverlay, type PhaserLayers } from "./map-overlay";
import type { PoiService, PointOfInterest } from "../services/poi-service";
import type { GeoPosition } from "../utils/geo-mapping";

/**
 * Manages all UI elements for the game scene
 */
export class GameUI {
  private scene: Phaser.Scene;
  public mapOverlay: MapOverlay;
  private poiService: PoiService;
  private statusText: Phaser.GameObjects.Text;
  private debugText: Phaser.GameObjects.Text;
  private controlsButton: Phaser.GameObjects.Container;
  private menuButton: Phaser.GameObjects.Container;
  private relocateButton: Phaser.GameObjects.Container;
  private notificationContainer: Phaser.GameObjects.Container;
  private notifications: Phaser.GameObjects.Text[] = [];
  private helpOverlay: Phaser.GameObjects.Container;
  private helpVisible = false;
  private poiInteractionHandler: ((poi: PointOfInterest) => void) | null = null;
  private relocateHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, poiService: PoiService) {
    this.scene = scene;
    this.poiService = poiService;

    // Initialize components only when explicitly called
    // Don't create UI elements in constructor
  }

  /**
   * Initialize UI components
   */
  public initialize(): void {
    // Create basic UI elements
    this.createStatusText();
    this.createButtons();
    this.createNotificationArea();
    this.createHelpOverlay();

    // Get the layer system from the scene registry
    const layers = this.scene.registry.get("layers") as PhaserLayers;

    // Initialize map overlay with proper z-index
    this.mapOverlay = new MapOverlay(this.poiService);
    
    // Remove the DOM manipulation code since it's now handled by the MapOverlay class
    // Let the MapOverlay class handle its own positioning

    // Make map overlay aware of the Phaser layer system
    if (layers) {
      this.mapOverlay.setPhaserLayers(layers);
    }

    // Initialize POI Service for the map overlay if not already initialized
    if (this.poiService) {
      this.initializeMapPois();
    }

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Show help overlay
   */
  public showHelp(): void {
    if (this.helpOverlay) {
      this.helpOverlay.setVisible(true);
      this.helpVisible = true;
    }
  }

  /**
   * Hide help overlay
   */
  public hideHelp(): void {
    if (this.helpOverlay) {
      this.helpOverlay.setVisible(false);
      this.helpVisible = false;
    }
  }

  /**
   * Toggle help overlay
   */
  public toggleHelp(): void {
    if (this.helpVisible) {
      this.hideHelp();
    } else {
      this.showHelp();
    }
  }

  /**
   * Show a notification to the player
   */
  public showNotification(message: string, duration = 3000): void {
    // Create notification text
    const notification = this.scene.add.text(0, 0, message, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
    });

    notification.setOrigin(0.5);

    // Add to container and array
    this.notificationContainer.add(notification);
    this.notifications.push(notification);

    // Position notifications (stack from bottom to top)
    this.repositionNotifications();

    // Auto-remove after duration
    this.scene.time.delayedCall(duration, () => {
      this.removeNotification(notification);
    });
  }

  /**
   * Update the status text
   */
  public updateStatus(text: string): void {
    if (this.statusText) {
      this.statusText.setText(text);
    }
  }

  /**
   * Update connection status indicator
   */
  public updateConnectionStatus(connected: boolean): void {
    const status = connected ? "Connected" : "Disconnected";
    this.updateStatus(status);

    // Could also update a visual indicator here if needed
  }

  /**
   * Show a warning notification with a longer duration
   */
  public showWarning(message: string, duration = 5000): void {
    this.showNotification(message, duration);
    // Could add additional styling or sound effects for warnings
  }

  /**
   * Update debug information
   */
  public updateDebugInfo(text: string): void {
    if (this.debugText) {
      this.debugText.setText(text);
      this.debugText.setVisible(text !== "");
    }
  }

  /**
   * Update player position on the map overlay
   */
  public updatePlayerPosition(position: GeoPosition): void {
    if (this.mapOverlay) {
      this.mapOverlay.updatePosition(position);
    }
  }

  /**
   * Show an information modal with title, text and optional details
   */
  public showInfoModal(title: string, text: string, details?: string): void {
    // Create a modal container
    const modal = this.scene.add.container(640, 360);
    modal.setDepth(300);
    modal.setScrollFactor(0);

    // Semi-transparent background
    const bg = this.scene.add.rectangle(0, 0, 600, 400, 0x000000, 0.8);
    bg.setOrigin(0.5);
    bg.setStrokeStyle(2, 0xffffff);

    // Title
    const titleText = this.scene.add.text(0, -150, title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      align: "center",
    });
    titleText.setOrigin(0.5);

    // Main text
    const mainText = this.scene.add.text(0, -50, text, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 500 },
    });
    mainText.setOrigin(0.5);

    // Details text (if provided)
    let detailsText: Phaser.GameObjects.Text | undefined;
    if (details) {
      detailsText = this.scene.add.text(0, 50, details, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#cccccc",
        align: "center",
        wordWrap: { width: 500 },
      });
      detailsText.setOrigin(0.5);
    }

    // Close button
    const closeButton = this.scene.add.text(0, 150, "CLOSE", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "#444444",
      padding: { left: 20, right: 20, top: 10, bottom: 10 },
    });
    closeButton.setOrigin(0.5);
    closeButton.setInteractive({ useHandCursor: true });

    // Add all elements to the container
    const elements = [bg, titleText, mainText, closeButton];
    if (detailsText) {
      elements.push(detailsText);
    }
    modal.add(elements);

    // Close button handler
    closeButton.on("pointerdown", () => {
      modal.destroy();
    });

    // Click anywhere to close
    bg.setInteractive();
    bg.on("pointerdown", () => {
      modal.destroy();
    });

    // Show notification
    this.showNotification(`Discovered: ${title}`);
  }

  /**
   * Clean up all UI elements
   */
  public destroy(): void {
    // Clean up MapOverlay
    if (this.mapOverlay) {
      this.mapOverlay.destroy();
    }

    // Clean up UI elements
    if (this.statusText) {
      this.statusText.destroy();
    }

    if (this.debugText) {
      this.debugText.destroy();
    }

    if (this.controlsButton) {
      this.controlsButton.destroy();
    }

    if (this.menuButton) {
      this.menuButton.destroy();
    }

    if (this.notificationContainer) {
      this.notificationContainer.destroy();
    }

    if (this.helpOverlay) {
      this.helpOverlay.destroy();
    }

    // Clear arrays
    this.notifications = [];
  }

  /**
   * Create status text display
   */
  private createStatusText(): void {
    // Status text at top of screen
    this.statusText = this.scene.add
      .text(640, 20, "Connecting to world...", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Debug text at bottom of screen (hidden by default)
    this.debugText = this.scene.add
      .text(10, 710, "", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { left: 5, right: 5, top: 3, bottom: 3 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  /**
   * Create UI buttons
   */
  private createButtons(): void {
    // Create controls toggle button
    this.controlsButton = this.createButton(1100, 680, "Controls", () => {
      // Toggle between GPS and manual controls
      // This will need to be connected to the location manager
      this.showNotification("Controls button pressed");
    });

    // Create menu button
    this.menuButton = this.createButton(1000, 680, "Menu", () => {
      this.toggleHelp();
    });

    // Create relocate button
    this.relocateButton = this.createButton(900, 680, "Relocate", () => {
      if (this.relocateHandler) {
        this.relocateHandler();
        this.showNotification("Relocating to default position...");
      } else {
        this.showNotification("Relocate function not available");
      }
    });
  }

  /**
   * Create notification area
   */
  private createNotificationArea(): void {
    this.notificationContainer = this.scene.add.container(640, 400);
    this.notificationContainer.setDepth(100);
    this.notificationContainer.setScrollFactor(0);
  }

  /**
   * Create help overlay with game instructions
   */
  private createHelpOverlay(): void {
    this.helpOverlay = this.scene.add.container(640, 360);
    this.helpOverlay.setDepth(200);
    this.helpOverlay.setScrollFactor(0);

    // Semi-transparent background
    const bg = this.scene.add.rectangle(0, 0, 800, 600, 0x000000, 0.8);
    bg.setOrigin(0.5);

    // Help title
    const title = this.scene.add.text(0, -250, "GAME HELP", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#ffffff",
      align: "center",
    });
    title.setOrigin(0.5);

    // Help text
    const helpText = this.scene.add.text(
      0,
      -50,
      [
        "Welcome to Alternate Earth!",
        "",
        "How to play:",
        "• Move around in the real world to explore the game world",
        "• Discover points of interest by visiting new locations",
        "• Interact with other players and complete quests",
        "• Use the map overlay to see your location and points of interest",
        "",
        "Controls:",
        "• Map button: Toggle the map overlay",
        "• Controls button: Switch between GPS and manual movement",
        "• Relocate button: Teleport to New York (default location)",
        "• Menu button: Show/hide this help screen",
        "",
        "Click anywhere to close this help screen",
      ].join("\n"),
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        align: "left",
      },
    );
    helpText.setOrigin(0.5, 0.5);

    // Close button
    const closeButton = this.scene.add.text(0, 220, "CLOSE", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#444444",
      padding: { left: 20, right: 20, top: 10, bottom: 10 },
    });
    closeButton.setOrigin(0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => {
      this.hideHelp();
    });

    // Add all elements to container
    this.helpOverlay.add([bg, title, helpText, closeButton]);

    // Click anywhere to close
    bg.setInteractive();
    bg.on("pointerdown", () => {
      this.hideHelp();
    });

    // Hide initially
    this.helpOverlay.setVisible(false);
  }

  /**
   * Create a button with text and background
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setDepth(100);
    container.setScrollFactor(0);

    // Button background
    const bg = this.scene.add.rectangle(0, 0, 90, 40, 0x666666, 0.8);
    bg.setOrigin(0.5);
    bg.setStrokeStyle(2, 0xffffff);

    // Button text
    const buttonText = this.scene.add.text(0, 0, text, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
    });
    buttonText.setOrigin(0.5);

    // Add elements to container
    container.add([bg, buttonText]);

    // Make interactive
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", callback);

    // Hover effects
    bg.on("pointerover", () => {
      bg.fillColor = 0x888888;
    });

    bg.on("pointerout", () => {
      bg.fillColor = 0x666666;
    });

    return container;
  }

  /**
   * Remove a notification from display
   */
  private removeNotification(notification: Phaser.GameObjects.Text): void {
    // Remove from array
    const index = this.notifications.indexOf(notification);
    if (index >= 0) {
      this.notifications.splice(index, 1);
    }

    // Remove from container
    this.notificationContainer.remove(notification);
    notification.destroy();

    // Reposition remaining notifications
    this.repositionNotifications();
  }

  /**
   * Reposition all notifications in the stack
   */
  private repositionNotifications(): void {
    // Position notifications from bottom to top
    for (let i = 0; i < this.notifications.length; i++) {
      const y = (this.notifications.length - 1 - i) * 40;
      if (this.notifications[i]) {
        this.notifications[i].y = y;
      }
    }
  }

  /**
   * Set up event handlers for UI components
   */
  private setupEventHandlers(): void {
    // Add global input handlers
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on("keydown-H", () => {
        this.toggleHelp();
      });
    }
  }

  /**
   * Set handler for POI interactions
   */
  public setPoiInteractionHandler(
    handler: (poi: PointOfInterest) => void,
  ): void {
    this.poiInteractionHandler = handler;
  }

  /**
   * Set relocate button handler
   */
  public setRelocateHandler(handler: () => void): void {
    this.relocateHandler = handler;
  }

  /**
   * Initialize POIs for the map overlay
   */
  private initializeMapPois(): void {
    // This method will be the central point for POI management
    if (!this.mapOverlay || !this.poiService) return;

    // Register POI click listener if we have a handler
    if (this.poiInteractionHandler) {
      this.mapOverlay.setPoiClickListener(this.poiInteractionHandler);
    }

    // Initial load of all POIs
    this.loadAllPois();

    // Listen for POI updates to keep map in sync
    this.poiService.onPoiUpdated((poi) => {
      this.handlePoiUpdate(poi);
    });

    // Listen for new POIs being loaded
    this.poiService.onPoisLoaded(() => {
      this.loadAllPois();
    });
  }

  /**
   * Load all POIs onto the map
   */
  private loadAllPois(): void {
    const allPois = this.poiService.getAllPois();
    
    // Add POIs to the map
    let addedCount = 0;
    for (const poi of allPois) {
      // Add all POIs to the map, but only discovered ones should be visible
      if (poi.discovered || poi.type === "city") {
        this.mapOverlay.addCustomPoint(
          poi.name,
          poi.latitude,
          poi.longitude,
          poi.type,
        );
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this.showNotification(`Map updated with ${addedCount} points of interest`);
    }
  }

  /**
   * Handle updates to a single POI
   */
  private handlePoiUpdate(poi: PointOfInterest): void {
    if (poi.discovered || poi.type === "city") {
      // Update existing POI or add new one
      this.mapOverlay.addCustomPoint(
        poi.name,
        poi.latitude,
        poi.longitude,
        poi.type,
      );
      
      // Only show discovery notification if it's a new discovery
      if (poi.discovered && !poi.visited) {
        this.showNotification(`Discovered new location: ${poi.name}`);
      }
    }
  }
}
