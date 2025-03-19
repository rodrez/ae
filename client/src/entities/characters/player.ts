import Phaser from 'phaser';
import { GameConfig } from '../../config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private direction: string = 'down';
  private moving: boolean = false;
  private speed: number = GameConfig.playerSpeed;
  private nameText: Phaser.GameObjects.Text;
  private nameColor: string = '#ffff00'; // Yellow for local player

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, name: string = 'You') {
    super(scene, x, y, texture);
    
    // Add highlight effect for local player
    this.setTint(0xffff00);
    
    // Add a subtle glow effect and play idle animation
    const glow = scene.add.sprite(x, y, texture)
      .setTint(0xffff00)
      .setAlpha(0.3)
      .setScale(1.2)
      .play('idle', true); // Play idle animation (frames 0-2) on loop
    
    // Make the glow follow the player
    scene.events.on('update', () => {
      glow.setPosition(this.x, this.y);
    });
    
    // Create floating name tag
    this.nameText = scene.add.text(x, y - 40, name, {
      fontSize: '16px',
      color: this.nameColor,
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
    
    // Play default animation
    this.anims.play('idle');
    
    // Set depth to ensure the player is rendered above backgrounds
    this.setDepth(10);
    
    // Make sure to clean up on destroy
    this.on('destroy', () => {
      scene.events.off('update');
      if (this.nameText) this.nameText.destroy();
      if (glow) glow.destroy();
    });
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys | null) {
    if (!cursors) return;

    let vx = 0;
    let vy = 0;
    let newDirection = this.direction;

    // Handle movement input
    if (cursors.left.isDown) {
      vx = -this.speed;
      newDirection = 'left';
    } else if (cursors.right.isDown) {
      vx = this.speed;
      newDirection = 'right';
    }

    if (cursors.up.isDown) {
      vy = -this.speed;
      newDirection = 'up';
    } else if (cursors.down.isDown) {
      vy = this.speed;
      newDirection = 'down';
    }

    // Apply velocity
    this.setVelocity(vx, vy);

    // Determine if player is moving
    const isMoving = vx !== 0 || vy !== 0;

    // Update animations based on movement
    if (isMoving) {
      if (!this.moving || this.direction !== newDirection) {
        // For left/right movement, we use walk animation and flip the sprite
        if (newDirection === 'left') {
          this.flipX = true;
          this.anims.play('walk-down', true);
        } else if (newDirection === 'right') {
          this.flipX = false;
          this.anims.play('walk-down', true);
        } else {
          // For up/down we use the appropriate animation without flipping
          this.flipX = false;
          this.anims.play(`walk-${newDirection}`, true);
        }
      }
      this.moving = true;
      this.direction = newDirection;
    } else if (this.moving) {
      this.anims.play('idle', true);
      this.moving = false;
    }
    
    // Update the position of the name text
    this.nameText.setPosition(this.x, this.y - 40);
  }
} 