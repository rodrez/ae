import Phaser from 'phaser';
import { GameConfig } from '../config';
import { Player } from '../entities/characters/player';
import { OtherPlayer } from '../entities/characters/other-player';
import { WorldService } from '../services/world-service';
import type { PlayerState } from '../services/world-service';
import type { WebSocketStatus } from '../services/websocket-service';

// Instead of extending Player, create an interface for checking movement status
interface PlayerWithMovement {
    moving?: boolean;
    isMoving?(): boolean;
}

export class Game extends Phaser.Scene {
    private player!: Player;
    private otherPlayers: Map<string, OtherPlayer> = new Map();
    private worldService: WorldService;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerId = '';
    private updatePlayerPositionTimer = 0;
    private exitButton!: Phaser.GameObjects.Text;
    private connectionErrorText?: Phaser.GameObjects.Text;
    private connectionStatusIndicator?: Phaser.GameObjects.Container;
    private connectionStatus = 'disconnected';
    private _reconnectionInProgress = false;

    constructor() {
        super('Game');
        this.worldService = new WorldService();
    }

    async create() {
        // Create world background
        this.createWorld();

        // Set up UI
        this.createUI();

        // Create connection status indicator
        this.createConnectionStatusIndicator();

        // Set up controls
        this.cursors = this.input.keyboard?.createCursorKeys() ?? this.createEmptyCursors();

        try {
            // Initialize world service and connect to WebSocket
            await this.worldService.initialize();
            
            // Set up WebSocket status listener
            this.setupConnectionStatusListener();
            
            // Get the player ID from localStorage (set in MainMenu)
            const storedId = localStorage.getItem('userId') ?? `guest_${Math.floor(Math.random() * 10000)}`;
            this.playerId = storedId;
            
            // Create the player
            this.createPlayer();
            
            // Join the world with initial position
            await this.worldService.joinWorld(
                this.playerId,
                `Player_${this.playerId.substring(6)}`,
                this.player.x,
                this.player.y
            );
            
            // Subscribe to player updates
            this.worldService.onPlayersUpdate(this.handlePlayersUpdate.bind(this));
            
            // Start position update cycle
            this.updatePlayerPositionTimer = 0;
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to start game. Returning to menu.');
            this.scene.start('MainMenu');
        }
    }

    update(time: number, delta: number) {
        if (!this.player) return;

        // Keep track of previous movement state
        const playerAsMovement = this.player as unknown as PlayerWithMovement;
        const wasMoving = playerAsMovement.moving || playerAsMovement.isMoving?.();

        // Update player (handles movement and animations)
        this.player.update(this.cursors);
        
        // Get current movement state
        const isMoving = playerAsMovement.moving || playerAsMovement.isMoving?.();

        // Only send position updates when the player is moving or just stopped moving
        if (isMoving || (wasMoving && !isMoving)) {
            this.updatePlayerPositionTimer += delta;
            if (this.updatePlayerPositionTimer >= 100) { // Send position every 100ms while moving
                this.updatePlayerPosition();
                this.updatePlayerPositionTimer = 0;
            }
        }
    }

    // Create empty cursors in case keyboard is not available
    private createEmptyCursors(): Phaser.Types.Input.Keyboard.CursorKeys {
        return {
            up: { isDown: false } as Phaser.Input.Keyboard.Key,
            down: { isDown: false } as Phaser.Input.Keyboard.Key,
            left: { isDown: false } as Phaser.Input.Keyboard.Key,
            right: { isDown: false } as Phaser.Input.Keyboard.Key,
            space: { isDown: false } as Phaser.Input.Keyboard.Key,
            shift: { isDown: false } as Phaser.Input.Keyboard.Key
        };
    }

    private createWorld() {
        // Create a simple background
        this.add.image(640, 360, 'world-bg');

        // Add game world bounds
        this.physics.world.setBounds(0, 0, GameConfig.worldWidth, GameConfig.worldHeight);
        
        // Set up camera to follow player
        this.cameras.main.setBounds(0, 0, GameConfig.worldWidth, GameConfig.worldHeight);
    }

    private createUI() {
        // Add exit button
        this.exitButton = this.add.text(1260, 20, 'Exit', {
            backgroundColor: '#000000',
            padding: { left: 10, right: 10, top: 5, bottom: 5 },
            color: '#ffffff',
            fontSize: '18px'
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setInteractive()
            .on('pointerdown', () => this.exitGame());
    }

    private createPlayer() {
        // Create player character at a random position
        const x = Math.floor(Math.random() * (GameConfig.worldWidth - 200)) + 100;
        const y = Math.floor(Math.random() * (GameConfig.worldHeight - 200)) + 100;
        
        this.player = new Player(this, x, y, 'character');
        this.add.existing(this.player);
        this.physics.add.existing(this.player);
        
        // Set up camera to follow player
        this.cameras.main.startFollow(this.player);
    }

    private async updatePlayerPosition() {
        if (!this.player || !this.playerId) return;
        
        try {
            await this.worldService.updatePlayerPosition(
                this.player.x,
                this.player.y
            );
            
            // Reset any connection error UI indicators that might have been displayed
            if (this.connectionErrorText?.visible) {
                this.connectionErrorText.setVisible(false);
            }
        } catch (error) {
            console.error('Failed to update position:', error);
            
            // Don't spam the connection attempts if we're having issues
            // Just skip this update cycle
            this.handleConnectionError('Position update failed. Reconnecting...');
        }
    }

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
                    otherPlayer.updatePosition(playerData.position.x, playerData.position.y);
                }
            } else {
                // Create new player
                const otherPlayer = new OtherPlayer(
                    this,
                    playerData.position.x,
                    playerData.position.y,
                    'character',
                    playerData.name
                );
                this.add.existing(otherPlayer);
                this.otherPlayers.set(playerId, otherPlayer);
                console.log(`Added player: ${playerData.name}`);
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

    private async exitGame() {
        try {
            await this.worldService.leaveWorld();
            
            this.scene.start('MainMenu');
        } catch (error) {
            console.error('Failed to exit game:', error);
            // Force return to menu even if exit fails
            this.scene.start('MainMenu');
        }
    }
    
    shutdown() {
        // Clean up resources and event listeners
        this.worldService.offPlayersUpdate(this.handlePlayersUpdate.bind(this));
        this.worldService.leaveWorld().catch(console.error);
    }

    // Helper method to handle connection errors
    private handleConnectionError(message: string): void {
        // Create error message if it doesn't exist
        if (!this.connectionErrorText) {
            this.connectionErrorText = this.add.text(640, 50, '', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ff0000',
                backgroundColor: '#00000088',
                padding: { left: 10, right: 10, top: 5, bottom: 5 }
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
        this.time.delayedCall(3000, () => {
            if (this.connectionErrorText) {
                this.connectionErrorText.setVisible(false);
            }
        });
        
        // Attempt to reconnect if the status is currently disconnected or error
        if (this.connectionStatus === 'disconnected' || this.connectionStatus === 'error') {
            this.attemptReconnection();
        }
    }

    // Add method to attempt reconnection
    private attemptReconnection(): void {
        console.log('Attempting to reconnect...');
        
        // Don't spam reconnection attempts - use a debounce
        if (this._reconnectionInProgress) return;
        
        this._reconnectionInProgress = true;
        
        // Try to reconnect
        this.worldService.reconnect()
            .then((success: boolean) => {
                this._reconnectionInProgress = false;
                
                if (success) {
                    console.log('Reconnection successful');
                    
                    // If we were previously in the world, attempt to rejoin
                    if (this.playerId && this.player) {
                        // Rejoin the world
                        this.worldService.joinWorld(
                            this.playerId,
                            `Player_${this.playerId.substring(6)}`,
                            this.player.x,
                            this.player.y
                        ).catch((error: Error) => {
                            console.error('Failed to rejoin world after reconnection:', error);
                        });
                    }
                } else {
                    console.log('Reconnection failed');
                }
            })
            .catch((error: Error) => {
                this._reconnectionInProgress = false;
                console.error('Error during reconnection:', error);
            });
    }

    // Add connection status listener
    private setupConnectionStatusListener(): void {
        this.worldService.onConnectionStatusChange((status: WebSocketStatus) => {
            this.connectionStatus = status;
            this.updateConnectionStatusIndicator();
        });
    }

    // Create connection status indicator in the top-right corner
    private createConnectionStatusIndicator(): void {
        // Create a container to hold the indicator components
        this.connectionStatusIndicator = this.add.container(1240, 20);
        
        // Add background
        const bg = this.add.rectangle(0, 0, 20, 20, 0x000000, 0.6)
            .setOrigin(0.5);
        
        // Add status circle (initial color is red for disconnected)
        const circle = this.add.circle(0, 0, 6, 0xff0000)
            .setOrigin(0.5);
            
        // Add text label
        const label = this.add.text(15, 0, 'Connection', {
            fontSize: '12px',
            color: '#ffffff'
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
    
    // Update the connection status indicator based on current status
    private updateConnectionStatusIndicator(): void {
        if (!this.connectionStatusIndicator) return;
        
        const circle = this.connectionStatusIndicator.getAt(1) as Phaser.GameObjects.Arc;
        const label = this.connectionStatusIndicator.getAt(2) as Phaser.GameObjects.Text;
        
        if (!circle || !label) return;
        
        // Set color based on status
        switch (this.connectionStatus) {
            case 'connected':
                circle.fillColor = 0x00ff00; // Green
                label.setText('Connected');
                break;
            case 'connecting':
                circle.fillColor = 0xffff00; // Yellow
                label.setText('Connecting...');
                break;
            case 'error':
                circle.fillColor = 0xff0000; // Red
                label.setText('Error');
                break;
            default:
                circle.fillColor = 0xff0000; // Red
                label.setText('Disconnected');
                break;
        }
    }
}
