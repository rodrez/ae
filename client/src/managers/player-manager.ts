import Phaser from "phaser";
import { Player } from "../entities/characters/player";
import { OtherPlayer } from "../entities/characters/other-player";
import { WorldService } from "../services/world-service";
import type { PlayerState } from "../services/world-service";
import { GameConfig } from "../config";
import { GeoMapper } from "../utils/geo-mapping";

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
    
    // Create the player without using the default position
    this.createPlayer(false);
    
    // Subscribe to player updates from the server
    this.setupPlayerUpdateListener();
  }

  /**
   * Create the player character
   * @param useDefaultPosition Whether to use default position or let it be set later
   */
  private createPlayer(useDefaultPosition: boolean = true): void {
    // Default position in the center of the world
    const defaultX = useDefaultPosition ? GameConfig.worldWidth / 2 : 0;
    const defaultY = useDefaultPosition ? GameConfig.worldHeight / 2 : 0;
    
    // Create the player sprite
    this.player = new Player(
      this.scene, 
      defaultX, 
      defaultY, 
      'player', // texture key
      'Player' // default name
    );
    
    // Add the player to the entities layer if available, otherwise to the scene
    const layers = this.scene.registry.get('layers');
    if (layers && layers.entities) {
      layers.entities.add(this.player);
    } else {
      this.scene.add.existing(this.player);
    }
    
    // Enable physics for the player
    this.scene.physics.add.existing(this.player);
    
    // Make camera follow the player
    this.scene.cameras.main.startFollow(this.player);
    
    // Set player's physics properties
    this.player.setCollideWorldBounds(true);
  }

  /**
   * Set up listener for player updates from the server
   */
  private setupPlayerUpdateListener(): void {
    // Create a single listener for player updates
    this.playerUpdateListener = (players: Map<string, PlayerState>) => {
      // Process updates for other players
      this.processOtherPlayerUpdates(players);
    };
    
    // Register the listener with world service
    this.worldService.onPlayersUpdate(this.playerUpdateListener);
  }

  /**
   * Process updates for other players from the server
   */
  private processOtherPlayerUpdates(players: Map<string, PlayerState>): void {
    // Skip processing if our player isn't yet active
    if (!this.player || !this.player.active) return;
    
    // Get all player IDs from the update
    const playerIds = Array.from(players.keys());
    
    // Get the entities layer if available
    const layers = this.scene.registry.get('layers');
    const entityLayer = layers ? layers.entities : null;
    
    // Create or update other players
    for (const id of playerIds) {
      // Skip our own player
      if (id === this.playerId) continue;
      
      const playerData = players.get(id);
      if (!playerData) continue;
      
      // Check if this player exists in our map
      if (!this.otherPlayers.has(id)) {
        // Create a new other player
        const otherPlayer = new OtherPlayer(
          this.scene,
          playerData.position.x,
          playerData.position.y,
          'player', // texture key
          playerData.name
        );
        
        // Add to entity layer if available, otherwise to scene
        if (entityLayer) {
          entityLayer.add(otherPlayer);
        } else {
          this.scene.add.existing(otherPlayer);
        }
        
        // Enable physics
        this.scene.physics.add.existing(otherPlayer);
        
        // Store in our map
        this.otherPlayers.set(id, otherPlayer);
      } else {
        // Update existing player
        const otherPlayer = this.otherPlayers.get(id);
        if (!otherPlayer) continue;
        
        // Move the other player to the new position
        otherPlayer.updatePosition(
          playerData.position.x,
          playerData.position.y
        );
      }
    }
    
    // Remove players that are no longer in the update
    for (const [id, otherPlayer] of this.otherPlayers) {
      if (!players.has(id)) {
        // Player has left, remove them
        otherPlayer.destroy();
        this.otherPlayers.delete(id);
      }
    }
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
   * Update the player's position on the server
   */
  private updatePlayerPosition(): void {
    if (!this.player || !this.player.active) return;
    
    // Get current position
    const x = this.player.x;
    const y = this.player.y;
    
    // Send to server
    this.worldService.updatePlayerPosition(x, y);
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
      this.player.name,
      x,
      y,
    ).then(success => {
      if (success) {
        // Mark player as active
        this.player.setActive(true);
        
        // Execute callbacks
        for (const callback of this.joinWorldCallbacks) {
          callback();
        }
      }
    });
  }

  /**
   * Leave the game world
   */
  public leaveWorld(): void {
    if (!this.playerId) return;
    
    this.worldService.leaveWorld();
  }
}
