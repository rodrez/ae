import Phaser from 'phaser';

export class OtherPlayer extends Phaser.Physics.Arcade.Sprite {
  private nameText: Phaser.GameObjects.Text;
  private targetX: number;
  private targetY: number;
  private lerp = 0.1; // Smoothing factor for movement
  private uniqueColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, name: string) {
    super(scene, x, y, texture);
    
    // Position initialization
    this.targetX = x;
    this.targetY = y;
    
    // Generate a unique color based on the player name
    this.uniqueColor = this.generateColorFromName(name);
    
    // Apply tint to visually distinguish this player
    this.setTint(this.uniqueColor);
    
    // Play idle animation
    this.anims.play('idle');
    
    // Create floating name tag with unique color
    const hexColor = '#' + this.uniqueColor.toString(16).padStart(6, '0');
    this.nameText = scene.add.text(x, y - 40, name, {
      fontSize: '16px',
      color: hexColor,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);
    
    // Set depth to ensure rendering above most objects
    this.setDepth(10);
    
    // Set alpha to distinguish from main player
    this.setAlpha(0.9);
    
    // Set up update method to be called every frame
    scene.events.on('update', this.update, this);
    
    // Make sure to clean up on destroy
    this.on('destroy', () => {
      scene.events.off('update', this.update, this);
      if (this.nameText) this.nameText.destroy();
    });
  }
  
  private generateColorFromName(name: string): number {
    // Generate a consistent color based on the player name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Create a pastel-ish color (avoiding yellow which is used for the local player)
    const h = Math.abs(hash) % 360;
    const s = 50 + (Math.abs(hash >> 3) % 30); // 50-80% saturation
    const l = 60 + (Math.abs(hash >> 6) % 15); // 60-75% lightness
    
    return this.hslToRgb(h, s, l);
  }
  
  private hslToRgb(h: number, s: number, l: number): number {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    // Convert RGB components to 0-255 range and then to hex
    const toHex = (c: number) => Math.round(c * 255);
    return (toHex(r) << 16) + (toHex(g) << 8) + toHex(b);
  }

  updatePosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    
    // If the player moved, determine which animation to play
    if (Math.abs(this.x - x) > Math.abs(this.y - y)) {
      if (this.x > x) {
        // Moving left
        this.flipX = true;
        this.anims.play('walk-down', true);
      } else {
        // Moving right
        this.flipX = false;
        this.anims.play('walk-down', true);
      }
    } else {
      // Reset flip for up/down movement
      this.flipX = false;
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