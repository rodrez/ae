import Phaser from 'phaser';
import { GameConfig } from '../config';
import { CharacterService } from '../services/CharacterService';
import { GameService } from '../services/GameService';
import { Player } from '../entities/characters/Player';
import { OtherPlayer } from '../entities/characters/OtherPlayer';

export class Game extends Phaser.Scene {
    private player!: Player;
    private otherPlayers: Map<number, OtherPlayer> = new Map();
    private characterService: CharacterService;
    private gameService: GameService;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private characterId: number = 0;
    private updatePlayerPositionTimer: number = 0;
    private nearbyCheckTimer: number = 0;
    private exitButton!: Phaser.GameObjects.Text;

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
        this.cursors = this.input.keyboard.createCursorKeys();

        try {
            // Get characters
            const characters = await this.characterService.getCharacters();

            if (characters.length === 0) {
                // Create a character if none exist
                const newCharacter = await this.characterService.createCharacter(`Hero_${Date.now()}`);
                this.characterId = newCharacter.id;
            } else {
                // Use the first character
                this.characterId = characters[0].id;
            }

            // Enter the game world
            await this.gameService.enterGame(this.characterId);

            // Create the player
            this.createPlayer(this.characterId);

            // Start position update cycle
            this.updatePlayerPositionTimer = 0;
            this.nearbyCheckTimer = 0;
        } catch (error) {
            console.error('Failed to initialize game:', error);
            alert('Failed to start game. Returning to menu.');
            this.scene.start('MainMenu');
        }
    }

    update(time: number, delta: number) {
        if (!this.player) return;

        // Handle player movement
        this.player.update(this.cursors);

        // Periodically update player position on server
        this.updatePlayerPositionTimer += delta;
        if (this.updatePlayerPositionTimer >= 200) { // Send position every 200ms
            this.updatePlayerPosition();
            this.updatePlayerPositionTimer = 0;
        }

        // Periodically check for nearby players
        this.nearbyCheckTimer += delta;
        if (this.nearbyCheckTimer >= 1000) { // Check every 1000ms (1 second)
            this.checkNearbyPlayers();
            this.nearbyCheckTimer = 0;
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

    private createPlayer(characterId: number) {
        // Create player character
        this.player = new Player(this, 640, 360, 'character');
        this.add.existing(this.player);
        this.physics.add.existing(this.player);
        
        // Set up camera to follow player
        this.cameras.main.startFollow(this.player);
    }

    private async updatePlayerPosition() {
        if (!this.player || !this.characterId) return;
        
        try {
            await this.gameService.updatePosition(
                this.characterId,
                this.player.x,
                this.player.y
            );
        } catch (error) {
            console.error('Failed to update position:', error);
        }
    }

    private async checkNearbyPlayers() {
        if (!this.characterId) return;
        
        try {
            const { players } = await this.gameService.getNearbyPlayers(this.characterId);
            
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
        } catch (error) {
            console.error('Failed to check nearby players:', error);
        }
    }

    private async exitGame() {
        try {
            if (this.characterId) {
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
