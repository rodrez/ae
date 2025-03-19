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
    
    // Load spritesheets
    this.load.spritesheet('character', 'characters/player.png', { 
      frameWidth: 32, 
      frameHeight: 32 
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
    // Player animations
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('character', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('character', { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('character', { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1
    });
  }
} 