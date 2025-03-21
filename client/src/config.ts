// Game configuration
export const GameConfig = {
  // Server URL
  apiUrl: 'http://localhost:3000',
  
  // Debug mode
  debug: true,
  
  // WebSocket settings
  websocket: {
    reconnectAttempts: 5,  // How many times to try reconnecting
    reconnectDelay: 3000,  // Base delay between reconnect attempts (ms)
    timeout: 30000,        // Connection timeout (ms)
    debug: true,           // Enable WebSocket debug logging
    path: '/socket.io/'    // Socket.IO path
  },
  
  // Game settings
  worldWidth: 1600,
  worldHeight: 1200,
  
  // Player settings
  playerSpeed: 200,
  
  // UI settings
  fontSize: 16,
  fontFamily: 'Arial',
  
  // Map settings
  map: {
    // Geographic boundaries for the game world
    // Default is centered on San Francisco with a surrounding area
    originLatitude: 37.810, // Top-left corner (north-west)
    originLongitude: -122.480, // Top-left corner (north-west)
    boundaryLatitude: 37.710, // Bottom-right corner (south-east)
    boundaryLongitude: -122.380, // Bottom-right corner (south-east)
    
    // Default center position (for initialization)
    defaultCenter: { lat: 37.7749, lng: -122.4194 }, // San Francisco
    defaultZoom: 1,
    
    // Scaling settings
    metersPerPixel: 10, // How many meters each pixel represents
    updateDistance: 20, // Minimum movement distance in meters to trigger position update
    
    // Game mechanics settings
    entityRadius: 100, // Radius in meters to show other entities
    interactionRadius: 50, // Radius in meters for interactions
    
    // Room/grid settings
    gridCellSize: 100, // Size of grid cells in game units
    cellSizeMeters: 500, // Approximate size of a grid cell in meters
    
    // Points of interest
    pointsOfInterest: [
      {
        name: "Downtown",
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 200,
        type: "city"
      },
      {
        name: "Ocean Beach",
        latitude: 37.7594,
        longitude: -122.5107,
        radius: 300,
        type: "beach"
      }
    ],
    
    // Feature flags
    features: {
      showDebugGrid: true, // Show grid cells
      showAccuracyRadius: true, // Show GPS accuracy radius
      showPointsOfInterest: true // Show POIs on map
    }
  }
}; 