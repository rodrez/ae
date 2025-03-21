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
    // Modified: More zoomed in boundaries centered on New York City
    originLatitude: 40.760, // Top-left corner (north-west) - ZOOMED IN
    originLongitude: -74.020, // Top-left corner (north-west) - ZOOMED IN
    boundaryLatitude: 40.730, // Bottom-right corner (south-east) - ZOOMED IN
    boundaryLongitude: -73.970, // Bottom-right corner (south-east) - ZOOMED IN
    
    // Default center position (for initialization)
    defaultCenter: { lat: 40.745, lng: -73.995 }, // New York City - centered better for zoom
    defaultZoom: 2, // Increased zoom level
    
    // Scaling settings
    metersPerPixel: 5, // Reduced from 10 to show more detail
    updateDistance: 10, // Reduced from 20 for more frequent updates at zoomed level
    
    // Game mechanics settings
    entityRadius: 100, // Radius in meters to show other entities
    interactionRadius: 50, // Radius in meters for interactions
    
    // Room/grid settings
    gridCellSize: 100, // Size of grid cells in game units
    cellSizeMeters: 250, // Reduced from 500 for more granular regions at zoom level
    
    // Points of interest
    pointsOfInterest: [
      {
        name: "Manhattan",
        latitude: 40.7831,
        longitude: -73.9712,
        radius: 200,
        type: "city"
      },
      {
        name: "Central Park",
        latitude: 40.7812,
        longitude: -73.9665,
        radius: 300,
        type: "landmark"
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