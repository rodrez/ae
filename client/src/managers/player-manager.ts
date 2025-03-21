import { Player } from "../entities/characters/player";
import { OtherPlayer } from "../entities/characters/other-player";
import { WorldService } from "../services/world-service";
import type { PlayerState } from "../services/world-service";
import { GameConfig } from "../config";

/**
 * Interface for checking movement status on player objects
 */
interface PlayerWithMovement {
  moving?: boolean;
  isMoving?(): boolean;
}

/**
 * PlayerManager handles the main player and other players in the game
 * including creation, movement, and position updates
 */
export class PlayerManager {
  private scene: Phaser.Scene;
  private worldService: WorldService;
  private player!: Player;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private playerId: string = "";
  private updatePlayerPositionTimer: number = 0;
  private playerUpdateListener: ((players: Map<string, PlayerState>) => void) | null = null;
  private manualControls: boolean = false;
  private joinWorldCallbacks: Array<() => void> = [];

  constructor(scene: Phaser.Scene, worldService: WorldService) {
    this.scene = scene;
    this.worldService = worldService;
  }

  /**
   * Initialize the player manager with the player ID
   */
  public initialize(playerId: string): void {
    this.playerId = playerId;
    
    // Create the player
    this.createPlayer();
    
    // Subscribe to player updates from the server
    this.setupPlayerUpdateListener();
  }

  /**
   * Clean up resources and event listeners
   */
  public destroy(): void {
    // Remove player update listener
    if (this.playerUpdateListener) {
      this.worldService.offPlayersUpdate(this.playerUpdateListener);
      this.playerUpdateListener = null;
    }
    
    // Destroy player and other players
    if (this.player) {
      this.player.destroy();
    }
    
    for (const [_, otherPlayer] of this.otherPlayers) {
      otherPlayer.destroy();
    }
    
    this.otherPlayers.clear();
  }

  /**
   * Update player movement and position
   */
  public update(delta: number): void {
    if (!this.player) return;
    
    // Only handle manual controls if manual controls are allowed
    if (this.manualControls) {
      // Keep track of previous movement state
      const playerAsMovement = this.player as unknown as PlayerWithMovement;
      const wasMoving = playerAsMovement.moving || playerAsMovement.isMoving?.();

      // Get cursors from the scene
      const cursors = this.scene.input.keyboard?.createCursorKeys();
      
      // Update player (handles movement and animations)
      if (cursors) {
        this.player.update(cursors);
      }

      // Get current movement state
      const isMoving = playerAsMovement.moving || playerAsMovement.isMoving?.();

      // Only send position updates when the player is moving or just stopped moving
      if (isMoving || (wasMoving && !isMoving)) {
        this.updatePlayerPositionTimer += delta;
        if (this.updatePlayerPositionTimer >= 100) {
          // Send position every 100ms while moving
          this.updatePlayerPosition();
          this.updatePlayerPositionTimer = 0;
        }
      }
    } else {
      // Update timer for periodic position updates even when not manually moving
      this.updatePlayerPositionTimer += delta;
      if (this.updatePlayerPositionTimer >= 5000) { // Send every 5 seconds
        this.updatePlayerPosition();
        this.updatePlayerPositionTimer = 0;
      }
    }
  }

  /**
   * Set whether manual controls are enabled
   */
  public setManualControls(enabled: boolean): void {
    this.manualControls = enabled;
  }

  /**
   * Get the main player instance
   */
  public getPlayer(): Player {
    return this.player;
  }

  /**
   * Get a specific other player by ID
   */
  public getOtherPlayer(id: string): OtherPlayer | undefined {
    return this.otherPlayers.get(id);
  }

  /**
   * Get all other players
   */
  public getAllOtherPlayers(): Map<string, OtherPlayer> {
    return this.otherPlayers;
  }

  /**
   * Set player position directly
   */
  public setPlayerPosition(x: number, y: number): void {
    if (!this.player) return;
    
    this.player.setPosition(x, y);
    
    // Update camera to follow player
    this.scene.cameras.main.centerOn(x, y);
    
    // If this is the first position update, join the world
    if (!this.player.active) {
      this.joinWorld(x, y);
    }
  }

  /**
   * Register a callback for when the player joins the world
   */
  public onJoinWorld(callback: () => void): void {
    this.joinWorldCallbacks.push(callback);
  }

  /**
   * Get the number of players (including self)
   */
  public getPlayerCount(): number {
    // Count other players plus self (if active)
    return this.otherPlayers.size + (this.player && this.player.active ? 1 : 0);
  }

  /**
   * Join the game world
   */
  public joinWorld(x: number = 0, y: number = 0): void {
    if (!this.playerId) return;
    
    this.worldService.joinWorld(
      this.playerId,
      `Player_${this.playerId.substring(Math.max(0, this.playerId.length - 6))}`,
      x || this.player.x,
      y || this.player.y
    ).then(() => {
      // Notify all callbacks
      for (const callback of this.joinWorldCallbacks) {
        callback();
      }
    }).catch(error => {
      console.error("Failed to join world:", error);
    });
  }

  /**
   * Create the player character
   */
  private createPlayer(): void {
    // Create player at the center of the world initially
    const x = GameConfig.worldWidth / 2;
    const y = GameConfig.worldHeight / 2;

    this.player = new Player(this.scene, x, y, "character");
    this.scene.add.existing(this.player);
    this.scene.physics.add.existing(this.player);

    // Set up camera to follow player
    this.scene.cameras.main.startFollow(this.player);
  }

  /**
   * Set up listener for player updates from the server
   */
  private setupPlayerUpdateListener(): void {
    this.playerUpdateListener = this.handlePlayersUpdate.bind(this);
    this.worldService.onPlayersUpdate(this.playerUpdateListener);
  }

  /**
   * Handle updates about other players from the server
   */
  private handlePlayersUpdate(players: Map<string, PlayerState>): void {
    // Skip processing if this is our own update
    if (!this.playerId || !this.player) return;

    // Keep track of current players to remove those who are no longer present
    const currentPlayerIds = new Set<string>();

    // Process updates for all players except self
    for (const [playerId, playerData] of players.entries()) {
      // Skip ourselves
      if (playerId === this.playerId) continue;

      currentPlayerIds.add(playerId);

      if (this.otherPlayers.has(playerId)) {
        // Update existing player
        const otherPlayer = this.otherPlayers.get(playerId);
        if (otherPlayer) {
          otherPlayer.updatePosition(
            playerData.position.x,
            playerData.position.y,
          );
        }
      } else {
        // Create new player
        const otherPlayer = new OtherPlayer(
          this.scene,
          playerData.position.x,
          playerData.position.y,
          "character",
          playerData.name,
        );
        this.scene.add.existing(otherPlayer);
        this.otherPlayers.set(playerId, otherPlayer);
        console.log(`Added player: ${playerData.name}`);
        
        // Notify of new player (used for map updates, etc.)
        this.onPlayerJoined(playerId, playerData);
      }
    }

    // Remove players that are no longer in the update
    for (const [playerId, otherPlayer] of this.otherPlayers.entries()) {
      if (!currentPlayerIds.has(playerId)) {
        otherPlayer.destroy();
        this.otherPlayers.delete(playerId);
        console.log(`Removed player: ${playerId}`);
      }
    }
  }

  /**
   * Handle when a new player joins
   */
  private onPlayerJoined(playerId: string, playerData: PlayerState): void {
    // Optional hook for subclasses or external handlers
    // This might be used by the Game scene to update the map with player markers
  }

  /**
   * Send player position update to the server
   */
  private async updatePlayerPosition(): Promise<void> {
    if (!this.player || !this.playerId) return;

    try {
      await this.worldService.updatePlayerPosition(
        this.player.x,
        this.player.y,
      );
    } catch (error) {
      console.error("Failed to update position:", error);
      // Error handling would be managed by the ConnectionManager
    }
  }
} 