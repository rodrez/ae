import Phaser from 'phaser';
import { GameConfig } from '../../config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private direction: string = 'down';
  private moving: boolean = false;
  private speed: number = GameConfig.playerSpeed;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    
    // Set up physics body
    this.setCollideWorldBounds(true);
    
    // Play default animation
    this.anims.play('idle');
    
    // Set depth to ensure the player is rendered above backgrounds
    this.setDepth(10);
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
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
        this.anims.play(`walk-${newDirection}`, true);
      }
      this.moving = true;
      this.direction = newDirection;
    } else if (this.moving) {
      this.anims.play('idle', true);
      this.moving = false;
    }
  }
} 