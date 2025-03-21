import type Phaser from "phaser";
import { GameConfig } from "../config";
import type { MapOverlay, PhaserLayers } from "../ui/map-overlay";

/**
 * PhaserMap component that integrates the real-world map with Phaser's rendering system
 * This provides a cohesive integration between the MapOverlay (Leaflet) and Phaser's scene
 */
export class PhaserMap {
  private scene: Phaser.Scene;
  private mapOverlay: MapOverlay | null = null;
  private layers: PhaserLayers;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Initialize layer system
    this.initializeLayers();

    // Set physics bounds
    this.initializePhysicsBounds();
  }

  /**
   * Initialize the layer system for proper rendering order
   */
  private initializeLayers(): void {
    // Create containers for each layer with transparent background
    this.layers = {
      // Background and terrain (lowest layer)
      map: this.scene.add.container(0, 0),

      // Ground decorations (trees, rocks, etc)
      ground: this.scene.add.container(0, 0),

      // Game entities (players, NPCs, monsters)
      entities: this.scene.add.container(0, 0),

      // Above-entity elements (projectiles, effects)
      overlay: this.scene.add.container(0, 0),

      // UI elements that move with the camera
      ui: this.scene.add.container(0, 0),
    };

    // Set depths to ensure proper rendering order - use higher values to ensure all layers are above the HTML map
    this.layers.map.setDepth(10);     // Changed to be well above the map background
    this.layers.ground.setDepth(20);  
    this.layers.entities.setDepth(30); 
    this.layers.overlay.setDepth(40);  
    this.layers.ui.setDepth(50);      

    // Ensure canvas is transparent to allow the HTML map to show through
    this.scene.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Configure alpha for each layer appropriately
    // All layers should be fully visible by default
    this.layers.map.setAlpha(1);
    this.layers.ground.setAlpha(1);
    this.layers.entities.setAlpha(1);
    this.layers.overlay.setAlpha(1);
    this.layers.ui.setAlpha(1);

    // Make UI layer fixed to the camera
    this.layers.ui.setScrollFactor(0);

    // Store layers in the registry for access from other classes
    this.scene.registry.set("layers", this.layers);
  }

  /**
   * Initialize physics bounds for the game world
   */
  private initializePhysicsBounds(): void {
    // Add game world bounds
    this.scene.physics.world.setBounds(
      0,
      0,
      GameConfig.worldWidth,
      GameConfig.worldHeight,
    );
  }

  /**
   * Set the map overlay component
   */
  setMapOverlay(mapOverlay: MapOverlay): void {
    this.mapOverlay = mapOverlay;

    // Connect the MapOverlay to the layer system
    this.mapOverlay.setPhaserLayers(this.layers);
  }

  /**
   * Add a decorative element to the ground layer
   */
  addGroundDecoration(
    x: number,
    y: number,
    texture: string,
  ): Phaser.GameObjects.Image {
    const image = this.scene.add.image(x, y, texture);
    this.layers.ground.add(image);
    return image;
  }

  /**
   * Add an entity to the entities layer
   */
  addEntity(gameObject: Phaser.GameObjects.GameObject): void {
    this.layers.entities.add(gameObject);
  }

  /**
   * Add a UI element to the UI layer
   */
  addUIElement(gameObject: Phaser.GameObjects.GameObject): void {
    this.layers.ui.add(gameObject);
  }

  /**
   * Get the layer system
   */
  getLayers(): PhaserLayers {
    return this.layers;
  }

  /**
   * Destroy and clean up resources
   */
  destroy(): void {
    // Clean up layers
    for (const layer of Object.values(this.layers)) {
      layer.destroy();
    }
  }

  /**
   * Add a game object to a specific layer
   * @param layer Layer name ('map', 'ground', 'entities', 'overlay', 'ui')
   * @param gameObject The Phaser game object to add
   */
  addToLayer(
    layer: keyof PhaserLayers, 
    gameObject: Phaser.GameObjects.GameObject
  ): void {
    if (this.layers[layer]) {
      this.layers[layer].add(gameObject);
    } else {
      console.warn(`Attempted to add object to non-existent layer: ${layer}`);
      // Add to entities as fallback
      this.layers.entities.add(gameObject);
    }
  }

  /**
   * Get a specific layer by name
   */
  getLayer(layer: keyof PhaserLayers): Phaser.GameObjects.Container {
    return this.layers[layer];
  }
}
