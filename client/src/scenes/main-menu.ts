import Phaser from "phaser";

export class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    this.add.image(640, 360, "world-bg").setScale(0.5);
    this.add.image(640, 200, "logo");

    // Create a simple start button
    const startButton = this.add
      .text(640, 450, "START GAME", {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        backgroundColor: "#4a7dff",
        padding: {
          left: 20,
          right: 20,
          top: 10,
          bottom: 10,
        },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => startButton.setTint(0xcccccc))
      .on("pointerout", () => startButton.clearTint())
      .on("pointerdown", () => this.startGame());

    // Instructions
    this.add
      .text(640, 510, "Authentication disabled for development", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#cccccc",
      })
      .setOrigin(0.5);
  }

  private startGame() {
    // Generate a random guest ID for the player
    const guestId = `guest_${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem("userId", guestId);

    console.log("Starting game with guest ID:", guestId);
    this.scene.start("Game");
  }
}
