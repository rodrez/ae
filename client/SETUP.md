# Setting Up the Alternate Earth Client

This guide will help you complete the setup for the Alternate Earth client.

## 1. Install Dependencies

First, install the required dependencies:

```bash
cd client
npm install
# or if you're using pnpm
pnpm install
```

## 2. Create the Missing Assets

Currently, the game requires several placeholder images to function. You have a few options:

### Option 1: Create simple placeholder graphics

Use a tool like GIMP, Photoshop, or even MS Paint to create simple placeholder graphics as described in `public/assets/placeholder-assets.txt`.

### Option 2: Use an asset pack

Download a free game asset pack, like:
- [RPG Character Pack](https://opengameart.org/content/rpg-character-sprites)
- [Roguelike/RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack)

### Option 3: Generate simple placeholders with code

Run the following command to generate simple colored rectangles for testing (requires ImageMagick to be installed):

```bash
# Create logo
convert -size 512x512 xc:#4488aa -fill white -gravity center -pointsize 48 -annotate 0 "Alternate Earth" public/assets/logo.png

# Create loading bars
convert -size 400x30 xc:#333333 public/assets/loading-bar-bg.png
convert -size 400x30 xc:#ffffff public/assets/loading-bar.png

# Create button
convert -size 200x60 xc:#555555 public/assets/button.png

# Create background
convert -size 1280x720 xc:#4488aa public/assets/world-bg.jpg

# Create simple player
convert -size 32x48 xc:#ffaa00 public/assets/player.png
convert -size 32x48 xc:#00aaff public/assets/other-player.png

# Create very simple character sheet (not animated)
convert -size 128x192 xc:#cccccc public/assets/character.png

# Create tileset
convert -size 512x512 xc:#aaccee public/assets/tileset.png
```

## 3. Start the Development Server

Once you have the assets in place, you can start the development server:

```bash
npm run dev
# or with pnpm
pnpm dev
```

Access the game at http://localhost:3001

## 4. Complete Your Game

This is just a starter template. You should:

1. Replace the placeholder assets with proper game assets
2. Implement additional game features
3. Expand the world and gameplay mechanics

## Troubleshooting

If you encounter issues with the game not loading or assets not appearing:

1. Check the browser console for errors
2. Verify that all required assets exist in the public/assets directory
3. Make sure the server is running at http://localhost:3000 