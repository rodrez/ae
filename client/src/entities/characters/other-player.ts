import Phaser from 'phaser';

export class OtherPlayer extends Phaser.Physics.Arcade.Sprite {
  private nameText: Phaser.GameObjects.Text;
  private targetX: number;
  private targetY: number;
  private lerp = 0.1; // Smoothing factor for movement

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, name: string) {
    super(scene, x, y, texture);
    
    // Position initialization
    this.targetX = x;
    this.targetY = y;
    
    // Play idle animation
    this.anims.play('idle');
    
    // Create floating name tag
    this.nameText = scene.add.text(x, y - 40, name, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(11);
    
    // Set depth to ensure rendering above most objects
    this.setDepth(10);
    
    // Set alpha to distinguish from main player
    this.setAlpha(0.8);
    
    // Add tint to other players to distinguish them
    this.setTint(0x00ffff);
    
    // Set up update method to be called every frame
    scene.events.on('update', this.update, this);
    
    // Make sure to clean up on destroy
    this.on('destroy', () => {
      scene.events.off('update', this.update, this);
      if (this.nameText) this.nameText.destroy();
    });
  }

  updatePosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    
    // If the player moved, determine which animation to play
    if (Math.abs(this.x - x) > Math.abs(this.y - y)) {
      if (this.x > x) {
        this.anims.play('walk-left', true);
      } else {
        this.anims.play('walk-right', true);
      }
    } else {
      if (this.y > y) {
        this.anims.play('walk-up', true);
      } else {
        this.anims.play('walk-down', true);
      }
    }
  }

  update(): void {
    // Smoothly move towards target position
    this.x = Phaser.Math.Linear(this.x, this.targetX, this.lerp);
    this.y = Phaser.Math.Linear(this.y, this.targetY, this.lerp);
    
    // If close enough to target, stop animating
    if (Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY) < 5) {
      this.anims.play('idle', true);
    }
    
    // Update the position of the name text
    this.nameText.setPosition(this.x, this.y - 40);
  }
} 