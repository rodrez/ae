import Phaser from 'phaser';
import { GameConfig } from '../config';
import { CharacterService } from '../services/character-service';
import { GameService } from '../services/game-service';
import { Player } from '../entities/characters/player';
import { OtherPlayer } from '../entities/characters/other-player';
import { WorldMap } from '../entities/world-map';
import { MapService, MapEntity } from '../services/map-service';
import { GeospatialManager } from '../utils/geospatial-manager';

export class Game extends Phaser.Scene {
    private player!: Player;
    private otherPlayers: Map<number, OtherPlayer> = new Map();
    private characterService: CharacterService;
    private gameService: GameService;
    private mapService: MapService;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private characterId: number = 0;
    private characterName: string = '';
    private updatePlayerPositionTimer: number = 0;
    private nearbyCheckTimer: number = 0;
    private exitButton!: Phaser.GameObjects.Text;
    private connectionStatusText!: Phaser.GameObjects.Text;
    private playerCountText!: Phaser.GameObjects.Text;
    private terrainText!: Phaser.GameObjects.Text;
    private playerCount: number = 0;
    private failedUpdates: number = 0;
    private lastErrorTime: number = 0;
    private worldMap!: WorldMap;
    private geospatialManager: GeospatialManager;
    private entityMarkers: Map<string, any> = new Map();
    private mapUpdateTimer: number = 0;
    private playerLatLng: { lat: number, lng: number } = { 
        lat: GameConfig.map.defaultCenter.lat,
        lng: GameConfig.map.defaultCenter.lng
    };
    private zoomLevel: number = GameConfig.map.defaultZoom;
    private mapControls!: {
        zoomIn: Phaser.GameObjects.Container;
        zoomOut: Phaser.GameObjects.Container;
    };

    constructor() {
        super('Game');
        this.characterService = new CharacterService();
        this.gameService = new GameService();
        this.mapService = new MapService();
        this.geospatialManager = new GeospatialManager(
            GameConfig.map.defaultCenter.lat,
            GameConfig.map.defaultCenter.lng,
            GameConfig.map.metersPerPixel
        );
    }

    async create() {
        // Create world map - this needs to be first so the map is beneath everything
        this.createWorldMap();

        // Set up UI
        this.createUI();
        
        // Create map controls
        this.createMapControls();

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

            // Make the Phaser canvas background transparent so we can see the map
            this.worldMap.makeCanvasTransparent();

            // Initialize player's real-world position
            // Use a real-world location as the starting point
            const startingPosition = {
                x: GameConfig.worldWidth / 2,
                y: GameConfig.worldHeight / 2
            };
            this.player.setPosition(startingPosition.x, startingPosition.y);
            
            // Convert to lat/lng
            this.playerLatLng = this.worldMap.pixelToLatLng(startingPosition.x, startingPosition.y);

            // Load initial map data based on player position
            this.loadMapRegion(this.playerLatLng.lat, this.playerLatLng.lng, this.zoomLevel);

            // Start position update cycle
            this.updatePlayerPositionTimer = 0;
            this.nearbyCheckTimer = 0;
            this.mapUpdateTimer = 0;
            
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

        // Periodically update map data based on player position
        this.mapUpdateTimer += delta;
        if (this.mapUpdateTimer >= 3000) { // Check every 3 seconds
            // Update player's real-world coordinates
            const newLatLng = this.worldMap.pixelToLatLng(this.player.x, this.player.y);
            
            // If player has moved significantly, update map data
            if (this.geospatialManager.getDistance(
                this.playerLatLng.lat, this.playerLatLng.lng,
                newLatLng.lat, newLatLng.lng
            ) > GameConfig.map.updateDistance) { // More than the configured update distance
                this.playerLatLng = newLatLng;
                this.loadMapRegion(newLatLng.lat, newLatLng.lng, this.zoomLevel);
            }
            
            this.mapUpdateTimer = 0;
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

    private createWorldMap() {
        // Create the world map
        this.worldMap = new WorldMap(this);
        
        // Set up physics world bounds based on the map
        this.physics.world.setBounds(0, 0, GameConfig.worldWidth, GameConfig.worldHeight);
        
        // Set up camera to follow player
        this.cameras.main.setBounds(0, 0, GameConfig.worldWidth, GameConfig.worldHeight);
    }
    
    private createMapControls() {
        // Create zoom controls
        const zoomInBtn = this.add.container(1220, 100);
        const zoomOutBtn = this.add.container(1220, 160);
        
        // Zoom in button
        const zoomInBg = this.add.circle(0, 0, 20, 0x333333, 0.7);
        const zoomInIcon = this.add.text(0, 0, '+', {
            color: 'white',
            fontSize: '24px'
        }).setOrigin(0.5);
        zoomInBtn.add([zoomInBg, zoomInIcon]);
        
        // Zoom out button
        const zoomOutBg = this.add.circle(0, 0, 20, 0x333333, 0.7);
        const zoomOutIcon = this.add.text(0, 0, '-', {
            color: 'white',
            fontSize: '24px'
        }).setOrigin(0.5);
        zoomOutBtn.add([zoomOutBg, zoomOutIcon]);
        
        // Make interactive
        zoomInBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.zoomMap(1));
        zoomOutBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.zoomMap(-1));
        
        // Set scroll factor to 0 to fix to camera
        zoomInBtn.setScrollFactor(0);
        zoomOutBtn.setScrollFactor(0);
        
        this.mapControls = {
            zoomIn: zoomInBtn,
            zoomOut: zoomOutBtn
        };
    }
    
    private zoomMap(delta: number) {
        // Adjust zoom level
        this.zoomLevel = Math.max(1, Math.min(18, this.zoomLevel + delta));
        
        // Update map with new zoom level
        this.loadMapRegion(this.playerLatLng.lat, this.playerLatLng.lng, this.zoomLevel);
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
        
        // Add terrain info display
        this.terrainText = this.add.text(20, 50, 'Terrain: Unknown', {
            color: '#ffffff',
            fontSize: '14px',
            stroke: '#000000',
            strokeThickness: 2
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
            
        // Add coordinate display (for debugging)
        if (GameConfig.debug) {
            const coordText = this.add.text(20, 80, 'Coordinates: 0, 0', {
                color: '#ffffff',
                fontSize: '12px',
                stroke: '#000000',
                strokeThickness: 2
            })
                .setScrollFactor(0);
                
            this.events.on('update', () => {
                if (this.player) {
                    const coords = this.worldMap.pixelToLatLng(this.player.x, this.player.y);
                    coordText.setText(`Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
                }
            });
        }
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
        // Start player in the center of the screen
        const startX = GameConfig.worldWidth / 2;
        const startY = GameConfig.worldHeight / 2;
        
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
            const { players } = await this.gameService.getNearbyPlayers(this.characterId, 500);
            
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

    private async loadMapRegion(lat: number, lng: number, zoom: number = 1) {
        try {
            // First, clear existing entity markers
            this.clearEntityMarkers();
            
            // Load map region data
            const regionData = await this.mapService.getRegionData({ lat, lng, zoom });
            
            // Update the world map with new region data
            this.worldMap.loadRegion(lat, lng, zoom);
            
            // Now load nearby entities
            const entities = await this.mapService.getNearbyEntities(lat, lng, GameConfig.map.entityRadius);
            
            // Place entities on the map
            for (const entity of entities) {
                this.createMapEntity(entity);
            }
            
            // Update terrain info display
            this.terrainText.setText(`Terrain: ${regionData.terrain}, Biome: ${regionData.biome}`);
            
            console.log(`Loaded map region for ${lat.toFixed(6)}, ${lng.toFixed(6)} with ${entities.length} entities`);
        } catch (error) {
            console.error('Failed to load map region:', error);
        }
    }
    
    private createMapEntity(entity: MapEntity) {
        const entityId = `entity-${entity.id}-${entity.type}`;

        // Get icon based on entity type
        const iconPath = `/assets/entities/${entity.type}.png`;
        
        // Add marker to the Leaflet map
        const marker = this.worldMap.addMarker(
            entity.position.lat, 
            entity.position.lng,
            entityId,
            iconPath
        );
        
        // Store reference to the marker
        this.entityMarkers.set(entityId, marker);
        
        // Add tooltip with entity name if available
        if (entity.properties && entity.properties.name) {
            marker.bindTooltip(entity.properties.name);
        }
        
        // Add popup with entity details
        const popupContent = this.createEntityPopupContent(entity);
        marker.bindPopup(popupContent);
        
        return marker;
    }
    
    private createEntityPopupContent(entity: MapEntity): string {
        let content = `<div class="entity-popup">`;
        content += `<h3>${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}</h3>`;
        
        if (entity.properties) {
            if (entity.properties.name) {
                content += `<p><strong>Name:</strong> ${entity.properties.name}</p>`;
            }
            
            if (entity.properties.description) {
                content += `<p>${entity.properties.description}</p>`;
            }
            
            // Add other properties based on entity type
            switch (entity.type) {
                case 'dungeon':
                    if (entity.properties.level) {
                        content += `<p><strong>Level:</strong> ${entity.properties.level}</p>`;
                    }
                    content += `<button onclick="window.gameEvents.enterDungeon(${entity.id})">Enter Dungeon</button>`;
                    break;
                case 'marketplace':
                    content += `<button onclick="window.gameEvents.openMarketplace(${entity.id})">Enter Market</button>`;
                    break;
                case 'flag':
                    content += `<button onclick="window.gameEvents.captureFlag(${entity.id})">Capture Flag</button>`;
                    break;
            }
        }
        
        content += `</div>`;
        return content;
    }
    
    private clearEntityMarkers() {
        // Remove all entity markers from the map
        this.entityMarkers.forEach((marker, id) => {
            this.worldMap.removeMarker(id);
        });
        
        // Clear the markers collection
        this.entityMarkers.clear();
    }

    private async exitGame() {
        try {
            // Cleanup resources
            this.clearEntityMarkers();
            this.worldMap.destroy();
            
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
