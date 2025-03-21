import Phaser from "phaser";
import { Boot } from "./scenes/boot";
import { Preload } from "./scenes/preload";
import { MainMenu } from "./scenes/main-menu";
import { Game } from "./scenes/game";
import { GameConfig } from "./config";

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  transparent: true,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: GameConfig.debug,
    },
  },
  scene: [Boot, Preload, MainMenu, Game],
};

// Start the game
new Phaser.Game(config);
