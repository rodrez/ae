import { WorldService } from "../services/world-service";
import type { WebSocketStatus } from "../services/websocket-service";

/**
 * ConnectionManager handles all aspects of the WebSocket connection
 * including status monitoring, reconnection logic, and UI indicators
 */
export class ConnectionManager {
  private scene: Phaser.Scene;
  private worldService: WorldService;
  private connectionStatus: WebSocketStatus = "disconnected";
  private reconnectionInProgress = false;
  private connectionStatusIndicator?: Phaser.GameObjects.Container;
  private connectionErrorText?: Phaser.GameObjects.Text;
  private connectionStatusHandler: ((status: WebSocketStatus) => void) | null = null;
  private connectionStatusChangeCallbacks: Array<(status: WebSocketStatus) => void> = [];

  constructor(scene: Phaser.Scene, worldService: WorldService) {
    this.scene = scene;
    this.worldService = worldService;
  }

  /**
   * Initialize the connection manager
   */
  public initialize(): void {
    // Create connection status indicator
    this.createConnectionStatusIndicator();
    
    // Set up WebSocket status listener
    this.setupConnectionStatusListener();
  }

  /**
   * Clean up resources and event listeners
   */
  public destroy(): void {
    // Remove status update listener
    if (this.connectionStatusHandler) {
      // There's no explicit offConnectionStatusChange method
      // We'll need to rely on the WorldService to clean up event listeners
      // or implement a proper cleanup mechanism in the future
      this.connectionStatusHandler = null;
    }
    
    // Clean up UI elements
    if (this.connectionStatusIndicator) {
      this.connectionStatusIndicator.destroy();
      this.connectionStatusIndicator = undefined;
    }
    
    if (this.connectionErrorText) {
      this.connectionErrorText.destroy();
      this.connectionErrorText = undefined;
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  public async attemptReconnection(): Promise<boolean> {
    console.log("Attempting to reconnect...");

    // Don't spam reconnection attempts - use a debounce
    if (this.reconnectionInProgress) return false;

    this.reconnectionInProgress = true;

    try {
      // Try to reconnect
      const success = await this.worldService.reconnect();
      this.reconnectionInProgress = false;

      if (success) {
        console.log("Reconnection successful");
        return true;
      } else {
        console.log("Reconnection failed");
        return false;
      }
    } catch (error) {
      this.reconnectionInProgress = false;
      console.error("Error during reconnection:", error);
      return false;
    }
  }

  /**
   * Rejoin the game world after reconnection
   */
  public async rejoinWorld(playerId: string, name: string, x: number, y: number): Promise<void> {
    try {
      await this.worldService.joinWorld(playerId, name, x, y);
      console.log("Successfully rejoined world");
    } catch (error) {
      console.error("Failed to rejoin world after reconnection:", error);
      this.handleConnectionError("Failed to rejoin world. Retrying...");
      
      // Attempt to rejoin again after a delay
      setTimeout(() => {
        this.rejoinWorld(playerId, name, x, y);
      }, 5000);
    }
  }

  /**
   * Get the current connection status
   */
  public getConnectionStatus(): WebSocketStatus {
    return this.connectionStatus;
  }

  /**
   * Check if currently reconnecting
   */
  public isReconnecting(): boolean {
    return this.reconnectionInProgress;
  }

  /**
   * Set up connection status listener
   */
  private setupConnectionStatusListener(): void {
    this.connectionStatusHandler = this.handleConnectionStatusChange;
    this.worldService.onConnectionStatusChange(this.connectionStatusHandler);
  }

  /**
   * Register a callback for connection status changes
   */
  public onConnectionStatusChange(callback: (status: WebSocketStatus) => void): void {
    this.connectionStatusChangeCallbacks.push(callback);
    
    // Call immediately with current status
    callback(this.connectionStatus);
  }

  /**
   * Handle connection status changes
   */
  private handleConnectionStatusChange = (status: WebSocketStatus): void => {
    this.connectionStatus = status;
    this.updateConnectionStatusIndicator();

    // Clear error message if we're connected
    if (status === "connected" && this.connectionErrorText?.visible) {
      this.connectionErrorText.setVisible(false);
    }
    
    // Notify all callbacks
    for (const callback of this.connectionStatusChangeCallbacks) {
      callback(status);
    }
  }

  /**
   * Create connection status indicator
   */
  private createConnectionStatusIndicator(): void {
    // Create a container to hold the indicator components
    this.connectionStatusIndicator = this.scene.add.container(1240, 20);

    // Add background
    const bg = this.scene.add.rectangle(0, 0, 20, 20, 0x000000, 0.6).setOrigin(0.5);

    // Add status circle (initial color is red for disconnected)
    const circle = this.scene.add.circle(0, 0, 6, 0xff0000).setOrigin(0.5);

    // Add text label
    const label = this.scene.add
      .text(15, 0, "Connection", {
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    // Add all elements to the container
    this.connectionStatusIndicator.add([bg, circle, label]);

    // Make it fixed to camera
    this.connectionStatusIndicator.setScrollFactor(0);

    // Set depth to always appear on top
    this.connectionStatusIndicator.setDepth(1000);

    // Initial update of the indicator
    this.updateConnectionStatusIndicator();
  }

  /**
   * Update the connection status indicator
   */
  private updateConnectionStatusIndicator(): void {
    if (!this.connectionStatusIndicator) return;

    const circle = this.connectionStatusIndicator.getAt(1) as Phaser.GameObjects.Arc;
    const label = this.connectionStatusIndicator.getAt(2) as Phaser.GameObjects.Text;

    if (!circle || !label) return;

    // Set color based on status
    switch (this.connectionStatus) {
      case "connected":
        circle.fillColor = 0x00ff00; // Green
        label.setText("Connected");
        break;
      case "connecting":
        circle.fillColor = 0xffff00; // Yellow
        label.setText("Connecting...");
        break;
      case "error":
        circle.fillColor = 0xff0000; // Red
        label.setText("Error");
        break;
      default:
        circle.fillColor = 0xff0000; // Red
        label.setText("Disconnected");
        break;
    }
  }

  /**
   * Handle connection errors and display messages
   */
  public handleConnectionError(message: string): void {
    // Create error message if it doesn't exist
    if (!this.connectionErrorText) {
      this.connectionErrorText = this.scene.add
        .text(640, 50, "", {
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
    this.connectionErrorText.setText(message);
    this.connectionErrorText.setVisible(true);

    // Hide after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      if (this.connectionErrorText) {
        this.connectionErrorText.setVisible(false);
      }
    });

    // Attempt to reconnect if the status is currently disconnected or error
    if (
      this.connectionStatus === "disconnected" ||
      this.connectionStatus === "error"
    ) {
      this.attemptReconnection();
    }
  }
} 