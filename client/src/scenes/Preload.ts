import Phaser from 'phaser';

export class Preload extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Preload');
  }

  preload() {
    // Create loading UI
    this.createLoadingUI();

    this.load.setPath('assets/');

    // Load game assets
    this.load.image('tileset', 'tileset.png');
    this.load.image('player', 'characters/player.png');
    this.load.image('other-player', 'characters/other-player.png');
    this.load.image('button', 'button.png');
    this.load.image('world-bg', 'world-bg.jpg');
    this.load.image('world-map', 'world-map.png');
    
    // Load map entity assets
    this.load.image('flag', 'entities/flag.png');
    this.load.image('dungeon', 'entities/dungeon.png');
    this.load.image('monster', 'entities/monster.png');
    this.load.image('marketplace', 'entities/marketplace.png');
    this.load.image('house', 'entities/house.png');
    
    // Load spritesheets
    this.load.spritesheet('character', 'characters/player.png', { 
      frameWidth: 48, 
      frameHeight: 48 
    });

    // Loading UI progress
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xffffff, 1);
      this.progressBar.fillRect(400, 370, 400 * value, 30);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.loadingBar.destroy();
    });
  }

  create() {
    // Create animations
    this.createAnimations();
    
    // Continue to the MainMenu scene
    this.scene.start('MainMenu');
  }

  private createLoadingUI() {
    // Background
    this.add.image(640, 360, 'logo').setScale(0.5);
    
    // Loading bar background
    this.loadingBar = this.add.graphics();
    this.loadingBar.fillStyle(0x333333, 1);
    this.loadingBar.fillRect(400, 370, 400, 30);

    // Progress bar
    this.progressBar = this.add.graphics();
  }

  private createAnimations() {
    // Player animations based on README.txt
    // [0-2] idle, [3-5] move, [6-8] attack, [9] death
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('character', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('character', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('character', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('character', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('character', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'attack',
      frames: this.anims.generateFrameNumbers('character', { start: 6, end: 8 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'death',
      frames: this.anims.generateFrameNumbers('character', { start: 9, end: 9 }),
      frameRate: 5,
      repeat: 0
    });
  }
} 