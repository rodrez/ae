import Phaser from 'phaser';
import { GameConfig } from '../config';
import { CharacterService } from '../services/character-service';
import { GameService } from '../services/game-service';
import { Player } from '../entities/characters/player';
import { OtherPlayer } from '../entities/characters/other-player';

export class Game extends Phaser.Scene {
    private player!: Player;
    private otherPlayers: Map<number, OtherPlayer> = new Map();
    private characterService: CharacterService;
    private gameService: GameService;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private characterId: number = 0;
    private characterName: string = '';
    private updatePlayerPositionTimer: number = 0;
    private nearbyCheckTimer: number = 0;
    private exitButton!: Phaser.GameObjects.Text;
    private connectionStatusText!: Phaser.GameObjects.Text;
    private playerCountText!: Phaser.GameObjects.Text;
    private playerCount: number = 0;
    private failedUpdates: number = 0;
    private lastErrorTime: number = 0;

    constructor() {
        super('Game');
        this.characterService = new CharacterService();
        this.gameService = new GameService();
    }

    async create() {
        // Create world background
        this.createWorld();

        // Set up UI
        this.createUI();

        // Set up controls
        if (this.input && this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        try {
            // Initialize WebSocket connection
            await this.gameService.initialize();
            
            // Register for player updates
            this.gameService.onPlayerUpdate(this.handlePlayerUpdate.bind(this));

            // Get characters
            const characters = await this.characterService.getCharacters();

            if (characters.length === 0) {
                // Create a character if none exist
                const playerName = `Hero_${Math.floor(Math.random() * 1000)}`;
                const newCharacter = await this.characterService.createCharacter(playerName);
                this.characterId = newCharacter.id;
                this.characterName = newCharacter.name;
            } else {
                // Use the first character
                this.characterId = characters[0].id;
                this.characterName = characters[0].name;
            }

            // Enter the game world
            await this.gameService.enterGame(this.characterId);

            // Create the player
            this.createPlayer(this.characterId, this.characterName);

            // Start position update cycle
            this.updatePlayerPositionTimer = 0;
            this.nearbyCheckTimer = 0;
            
            // Get initial nearby players
            this.checkNearbyPlayers();
            
            // Update connection status
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.updateConnectionStatus(false, 'Failed to connect to game server');
            
            // Give the player a chance to see the error before returning to menu
            setTimeout(() => {
                this.scene.start('MainMenu');
            }, 3000);
        }
    }

    update(time: number, delta: number) {
        if (!this.player) return;

        // Handle player movement
        this.player.update(this.cursors);

        // Periodically update player position on server
        this.updatePlayerPositionTimer += delta;
        if (this.updatePlayerPositionTimer >= 100) { // Send position every 100ms for smoother multiplayer
            this.updatePlayerPosition();
            this.updatePlayerPositionTimer = 0;
        }

        // Periodically check for nearby players
        this.nearbyCheckTimer += delta;
        if (this.nearbyCheckTimer >= 5000) { // Check every 5 seconds as a backup to WebSocket updates
            this.checkNearbyPlayers();
            this.nearbyCheckTimer = 0;
        }
    }
    
    private handlePlayerUpdate(update: any) {
        if (update.type === 'move') {
            // Skip updates for our own player
            if (update.characterId === this.characterId) return;
            
            // Update other player position
            if (this.otherPlayers.has(update.characterId)) {
                const otherPlayer = this.otherPlayers.get(update.characterId)!;
                otherPlayer.updatePosition(update.position.x, update.position.y);
            } else {
                // If we don't have this player yet, trigger a nearby check
                this.checkNearbyPlayers();
            }
        } else if (update.type === 'disconnect') {
            // Remove disconnected player
            if (this.otherPlayers.has(update.characterId)) {
                const otherPlayer = this.otherPlayers.get(update.characterId)!;
                otherPlayer.destroy();
                this.otherPlayers.delete(update.characterId);
                this.updatePlayerCountDisplay();
            }
        }
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
        // Add connection status text
        this.connectionStatusText = this.add.text(640, 20, 'Connecting...', {
            color: '#ffff00',
            fontSize: '16px',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0);
            
        // Add player count display
        this.playerCountText = this.add.text(20, 20, 'Players: 1', {
            color: '#ffffff',
            fontSize: '16px',
            stroke: '#000000',
            strokeThickness: 3
        })
            .setScrollFactor(0);
    
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
    
    private updateConnectionStatus(connected: boolean, message?: string) {
        if (connected) {
            this.connectionStatusText.setText('Connected').setColor('#00ff00');
            setTimeout(() => {
                this.connectionStatusText.setAlpha(0);
            }, 2000);
        } else {
            this.connectionStatusText.setText(message || 'Connection lost').setColor('#ff0000');
            this.connectionStatusText.setAlpha(1);
        }
    }
    
    private updatePlayerCountDisplay() {
        this.playerCount = this.otherPlayers.size + 1; // Add 1 for the local player
        this.playerCountText.setText(`Players: ${this.playerCount}`);
    }

    private createPlayer(characterId: number, name: string) {
        // Use a random position for better multiplayer testing
        const startX = Phaser.Math.Between(100, GameConfig.worldWidth - 100);
        const startY = Phaser.Math.Between(100, GameConfig.worldHeight - 100);
        
        // Create player character with name display
        this.player = new Player(this, startX, startY, 'character', name);
        this.add.existing(this.player);
        this.physics.add.existing(this.player);
        
        // Set collision bounds after adding physics
        this.player.setCollideWorldBounds(true);
        
        // Set up camera to follow player
        this.cameras.main.startFollow(this.player);
    }

    private async updatePlayerPosition() {
        if (!this.player || !this.characterId) return;
        
        const now = Date.now();
        
        try {
            await this.gameService.updatePosition(
                this.characterId,
                this.player.x,
                this.player.y
            );
            
            // Reset failed updates counter on success
            this.failedUpdates = 0;
            
            // Clear any error status if it was showing
            if (this.connectionStatusText.text.includes('failed')) {
                this.updateConnectionStatus(true);
            }
        } catch (error) {
            console.error('Failed to update position:', error);
            
            // Increment failed updates counter
            this.failedUpdates++;
            this.lastErrorTime = now;
            
            // Only show error message if we've had multiple failures
            if (this.failedUpdates >= 3) {
                this.updateConnectionStatus(
                    false, 
                    `Position updates failing (${this.failedUpdates}). Game continues locally.`
                );
                
                // After many failures, try to reconnect websocket
                if (this.failedUpdates >= 10 && this.failedUpdates % 5 === 0) {
                    try {
                        await this.gameService.initialize();
                        console.log('Attempted websocket reconnection');
                    } catch (e) {
                        console.error('Websocket reconnection failed:', e);
                    }
                }
            }
        }
    }

    private async checkNearbyPlayers() {
        if (!this.characterId) return;
        
        try {
            const { players } = await this.gameService.getNearbyPlayers(this.characterId, 500); // Increased radius for testing
            
            // Keep track of current players to remove those who are no longer nearby
            const currentPlayerIds = new Set<number>();
            
            // Add or update other players
            for (const playerData of players) {
                currentPlayerIds.add(playerData.id);
                
                if (this.otherPlayers.has(playerData.id)) {
                    // Update existing player
                    const otherPlayer = this.otherPlayers.get(playerData.id)!;
                    otherPlayer.updatePosition(playerData.position.x, playerData.position.y);
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
                    this.otherPlayers.set(playerData.id, otherPlayer);
                }
            }
            
            // Remove players that are no longer nearby
            for (const [playerId, otherPlayer] of this.otherPlayers.entries()) {
                if (!currentPlayerIds.has(playerId)) {
                    otherPlayer.destroy();
                    this.otherPlayers.delete(playerId);
                }
            }
            
            // Update player count display
            this.updatePlayerCountDisplay();
        } catch (error) {
            console.error('Failed to check nearby players:', error);
        }
    }

    private async exitGame() {
        try {
            if (this.characterId) {
                this.gameService.offPlayerUpdate(this.handlePlayerUpdate.bind(this));
                await this.gameService.exitGame(this.characterId);
            }
            
            this.scene.start('MainMenu');
        } catch (error) {
            console.error('Failed to exit game:', error);
            // Force return to menu even if exit fails
            this.scene.start('MainMenu');
        }
    }
}
