// Game configuration
export const GameConfig = {
  // Server URL
  apiUrl: 'http://localhost:3000',
  
  // Debug mode
  debug: false,
  
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
    defaultCenter: { lat: 37.7749, lng: -122.4194 }, // Default center (San Francisco)
    defaultZoom: 1,
    metersPerPixel: 10, // How many meters each pixel represents
    updateDistance: 200, // Distance in meters before triggering a map update
    entityRadius: 1000, // Radius in meters to check for entities
    flags: {
      captureRadius: 500, // Radius in meters to capture a flag
      territoryRadius: 600 // Radius in meters for territory control
    }
  }
}; 