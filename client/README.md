# Alternate Earth MMO - Client

This is the client application for the Alternate Earth MMO game. It's built with Phaser 3, TypeScript, and Vite.

## Prerequisites

- Node.js (v16 or newer)
- npm or pnpm

## Setup

1. Install dependencies:

```bash
npm install
# or with pnpm
pnpm install
```

2. Start the development server:

```bash
npm run dev
# or with pnpm
pnpm dev
```

3. Open the game in your browser at `http://localhost:3001`

## Building for Production

To build the client for production:

```bash
npm run build
# or with pnpm
pnpm build
```

The built files will be available in the `dist` directory.

## Game Controls

- **Arrow keys**: Move your character
- **Exit button**: Return to the main menu

## Project Structure

- `src/`: Source code
  - `assets/`: Game assets (images, audio)
  - `scenes/`: Phaser scenes (Boot, Preload, MainMenu, Game)
  - `entities/`: Game entities (Player, OtherPlayer)
  - `services/`: Services for API communication
  - `ui/`: UI components
  - `utils/`: Utility functions
- `public/`: Public assets and HTML template

## Server Communication

The client connects to the server at the URL specified in `src/config.ts`. Make sure the server is running before starting the game. 