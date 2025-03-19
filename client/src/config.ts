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
    debug: true            // Enable WebSocket debug logging
  },
  
  // Game settings
  worldWidth: 1600,
  worldHeight: 1200,
  
  // Player settings
  playerSpeed: 200,
  
  // UI settings
  fontSize: 16,
  fontFamily: 'Arial',
}; 