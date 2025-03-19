/**
 * Alternate Earth WebSocket Monitoring Dashboard
 */

// UI Elements
const elements = {
  // Connection status
  connectionStatus: document.getElementById('connection-status'),
  statusText: document.getElementById('status-text'),
  connectButton: document.getElementById('connect-btn'),
  
  // Stats
  activeConnections: document.getElementById('active-connections'),
  charactersOnline: document.getElementById('characters-online'),
  latency: document.getElementById('latency'),
  messagesReceived: document.getElementById('messages-received'),
  messagesSent: document.getElementById('messages-sent'),
  refreshStatsBtn: document.getElementById('refresh-stats-btn'),
  
  // Authentication
  authForm: document.getElementById('auth-form'),
  serverUrl: document.getElementById('server-url'),
  characterId: document.getElementById('character-id'),
  characterName: document.getElementById('character-name'),
  authToken: document.getElementById('auth-token'),
  authButton: document.getElementById('auth-btn'),
  
  // Test actions
  pingButton: document.getElementById('ping-btn'),
  movementButton: document.getElementById('movement-btn'),
  actionButton: document.getElementById('action-btn'),
  chatMessage: document.getElementById('chat-message'),
  chatButton: document.getElementById('chat-btn'),
  
  // Log and map
  eventLog: document.getElementById('event-log'),
  clearLogButton: document.getElementById('clear-log-btn'),
  playerMap: document.getElementById('player-map'),
};

// State
const state = {
  socket: null,
  connected: false,
  authenticated: false,
  messageCountReceived: 0,
  messageCountSent: 0,
  players: new Map(), // Map of characterId -> {position, element}
  characterId: null,
  pingIntervalId: null,
  pingTimestamp: 0,
  startTime: Date.now(),
  nearbyPlayers: [],
  logs: [],
  activeCells: []
};

// Initialize
function init() {
  addEventListeners();
  updateUI();
}

// Add event listeners
function addEventListeners() {
  // Connect button
  elements.connectButton.addEventListener('click', toggleConnection);
  
  // Auth form
  elements.authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authenticate();
  });
  
  // Test actions
  elements.pingButton.addEventListener('click', sendPing);
  elements.movementButton.addEventListener('click', sendRandomMovement);
  elements.actionButton.addEventListener('click', sendTestAction);
  elements.chatButton.addEventListener('click', sendChatMessage);
  
  // Clear log
  elements.clearLogButton.addEventListener('click', clearLog);
  
  // Refresh stats button
  if (elements.refreshStatsBtn) {
    elements.refreshStatsBtn.addEventListener('click', () => {
      state.socket.emit('request_stats');
      log('info', 'Requested server stats refresh');
    });
  }
}

// Toggle connection
function toggleConnection() {
  if (state.connected) {
    disconnectFromServer();
  } else {
    connectToServer();
  }
}

// Connect to WebSocket server
function connectToServer() {
  try {
    const serverUrl = elements.serverUrl.value.trim();
    
    if (!serverUrl) {
      log('error', 'Server URL is required');
      return;
    }
    
    // Close existing connection if any
    if (state.socket) {
      state.socket.disconnect();
    }
    
    // Create new connection
    state.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Setup listeners
    setupSocketListeners();
    
    // Update UI
    updateConnectionStatus('connecting');
    elements.connectButton.textContent = 'Connecting...';
    elements.connectButton.disabled = true;
    
    log('info', `Connecting to ${serverUrl}...`);
  } catch (error) {
    log('error', `Connection error: ${error.message}`);
    updateConnectionStatus('disconnected');
  }
}

// Disconnect from server
function disconnectFromServer() {
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  
  // Clear ping interval
  if (state.pingIntervalId) {
    clearInterval(state.pingIntervalId);
    state.pingIntervalId = null;
  }
  
  // Reset state
  state.connected = false;
  state.authenticated = false;
  state.players.clear();
  
  // Update UI
  updateConnectionStatus('disconnected');
  updateUI();
  clearPlayerMap();
  
  log('info', 'Disconnected from server');
}

// Setup socket event listeners
function setupSocketListeners() {
  if (!state.socket) return;
  
  // Connection events
  state.socket.on('connect', () => {
    state.connected = true;
    updateConnectionStatus('connected');
    elements.connectButton.textContent = 'Disconnect';
    elements.connectButton.disabled = false;
    elements.authButton.disabled = false;
    
    log('success', 'Connected to server');
  });
  
  state.socket.on('disconnect', (reason) => {
    state.connected = false;
    state.authenticated = false;
    updateConnectionStatus('disconnected');
    updateUI();
    
    log('error', `Disconnected: ${reason}`);
  });
  
  state.socket.on('connect_error', (error) => {
    log('error', `Connection error: ${error.message}`);
    updateConnectionStatus('error');
  });
  
  // Game messages
  state.socket.on('connected', (data) => {
    state.messageCountReceived++;
    log('info', `Server welcome: ${data.message}`);
    elements.activeConnections.textContent = data.activeConnections;
    elements.charactersOnline.textContent = data.authenticatedPlayers || 0;
    
    // Update stats
    updateStats();
  });
  
  // Server stats (new event)
  state.socket.on('server_stats', (data) => {
    if (data) {
      elements.activeConnections.textContent = data.totalConnections || 0;
      elements.charactersOnline.textContent = data.authenticatedConnections || 0;
      
      // Update messages counts if the elements exist
      if (elements.messagesReceived) {
        elements.messagesReceived.textContent = data.messagesReceived || 0;
      }
      if (elements.messagesSent) {
        elements.messagesSent.textContent = data.messagesSent || 0;
      }
      
      // Store active cells for map rendering
      if (data.activeCells && Array.isArray(data.activeCells)) {
        state.activeCells = data.activeCells;
        log('info', `Updated active cells: ${state.activeCells.length} cells`);
      }
      
      // Redraw the map with updated cell information
      if (mapCtx) {
        drawMap();
      }
    }
  });
  
  state.socket.on('game_state', (data) => {
    state.messageCountReceived++;
    if (data.type === 'initial_state') {
      log('info', 'Received initial game state');
      elements.activeConnections.textContent = data.totalConnections || data.players.count;
      elements.charactersOnline.textContent = data.authenticatedConnections || 0;
    } else if (data.type === 'world_state') {
      log('info', `Received world state with ${data.nearbyPlayers?.length || 0} nearby players`);
      
      // Update grid cell information if available
      if (data.gridCell) {
        log('info', `You are in grid cell ${data.gridCell}`);
      }
      
      // Update player map
      if (data.playerData?.position) {
        updatePlayerPosition(state.characterId, data.playerData.position, true);
      }
      
      // Update nearby players
      if (data.nearbyPlayers) {
        for (const player of data.nearbyPlayers) {
          updatePlayerPosition(player.characterId, player.position, false);
        }
      }
    }
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('move', (data) => {
    state.messageCountReceived++;
    log('info', `Player ${data.characterId} moved`);
    
    // Update player position on map
    if (data.characterId !== state.characterId) {
      updatePlayerPosition(data.characterId, data.position, false);
    }
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('player_connected', (data) => {
    state.messageCountReceived++;
    log('success', `Player ${data.characterId} connected`);
    
    // Update character counts if provided in the message
    if (data.authenticatedConnections) {
      elements.charactersOnline.textContent = data.authenticatedConnections;
    } else {
      // Fallback to incrementing
      elements.charactersOnline.textContent = Number.parseInt(elements.charactersOnline.textContent) + 1;
    }
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('player_disconnected', (data) => {
    state.messageCountReceived++;
    log('info', `Player ${data.characterId} disconnected (${data.reason})`);
    
    // Don't manually decrement here, we'll get server_stats update
    
    // Remove player from map
    removePlayerFromMap(data.characterId);
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('chat', (data) => {
    state.messageCountReceived++;
    log('chat', `[${data.channel || 'global'}] ${data.characterId}: ${data.message}`);
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('action', (data) => {
    state.messageCountReceived++;
    log('action', `Player ${data.characterId} used ${data.actionType} on ${data.targetId || 'no target'}`);
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('error', (data) => {
    state.messageCountReceived++;
    log('error', `Server error: ${data.code} - ${data.message}`);
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('pong', (data) => {
    state.messageCountReceived++;
    const latency = Date.now() - (data.timestamp || state.pingTimestamp);
    elements.latency.textContent = `${latency} ms`;
    
    // Update stats
    updateStats();
  });
  
  state.socket.on('test_response', (data) => {
    state.messageCountReceived++;
    log('info', `Test response received: ${JSON.stringify(data.echo)}`);
    
    // Update stats
    updateStats();
  });
}

// Authenticate with server
function authenticate() {
  if (!state.connected || !state.socket) {
    log('error', 'Cannot authenticate: not connected to server');
    return;
  }
  
  const characterId = Number.parseInt(elements.characterId.value);
  const characterName = elements.characterName.value.trim();
  const token = elements.authToken.value.trim();
  
  if (!characterId || !characterName) {
    log('error', 'Character ID and name are required');
    return;
  }
  
  // Send authentication request
  state.socket.emit('connect_game', {
    characterId,
    characterName,
    token: token || undefined
  });
  
  state.messageCountSent++;
  state.characterId = characterId;
  state.authenticated = true;
  
  log('info', `Authenticating as ${characterName} (ID: ${characterId})`);
  
  // Update UI
  updateUI();
  
  // Setup ping interval
  if (state.pingIntervalId) {
    clearInterval(state.pingIntervalId);
  }
  
  state.pingIntervalId = setInterval(() => {
    sendPing();
  }, 10000); // Send ping every 10 seconds
  
  // Update stats
  updateStats();
}

// Send ping to server
function sendPing() {
  if (!state.connected || !state.socket) return;
  
  state.pingTimestamp = Date.now();
  state.socket.emit('ping', { timestamp: state.pingTimestamp });
  state.messageCountSent++;
  
  // Update stats
  updateStats();
}

// Send random movement
function sendRandomMovement() {
  if (!state.authenticated || !state.socket) return;
  
  const position = {
    x: Math.floor(Math.random() * 1000),
    y: Math.floor(Math.random() * 1000),
    z: 0,
    rotation: Math.random() * Math.PI * 2
  };
  
  const velocity = {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: 0
  };
  
  state.socket.emit('move', {
    position,
    velocity,
    animation: 'walk'
  });
  
  state.messageCountSent++;
  log('info', `Sent movement to ${position.x}, ${position.y}`);
  
  // Update player position on map
  updatePlayerPosition(state.characterId, position, true);
  
  // Update stats
  updateStats();
}

// Send test action
function sendTestAction() {
  if (!state.authenticated || !state.socket) return;
  
  const actionTypes = ['attack', 'jump', 'dance', 'emote', 'use_item'];
  const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
  
  state.socket.emit('action', {
    type: actionType,
    targetId: Math.random() > 0.5 ? Math.floor(Math.random() * 1000) : undefined,
    parameters: {
      strength: Math.floor(Math.random() * 100),
      duration: Math.floor(Math.random() * 5) + 1
    }
  });
  
  state.messageCountSent++;
  log('action', `Sent action: ${actionType}`);
  
  // Update stats
  updateStats();
}

// Send chat message
function sendChatMessage() {
  if (!state.authenticated || !state.socket) return;
  
  const message = elements.chatMessage.value.trim();
  if (!message) return;
  
  state.socket.emit('chat', {
    message,
    channel: Math.random() > 0.7 ? 'global' : undefined // Sometimes use global, otherwise area chat
  });
  
  state.messageCountSent++;
  log('chat', `Sent message: ${message}`);
  
  // Clear input
  elements.chatMessage.value = '';
  
  // Update stats
  updateStats();
}

// Update connection status in UI
function updateConnectionStatus(status) {
  const statusDot = elements.connectionStatus.querySelector('div');
  
  switch (status) {
    case 'disconnected':
      statusDot.className = 'h-3 w-3 rounded-full bg-red-500 mr-2';
      elements.statusText.textContent = 'Disconnected';
      elements.connectButton.textContent = 'Connect';
      elements.connectButton.disabled = false;
      break;
    case 'connecting':
      statusDot.className = 'h-3 w-3 rounded-full bg-yellow-500 mr-2 animate-pulse-slow';
      elements.statusText.textContent = 'Connecting...';
      break;
    case 'connected':
      statusDot.className = 'h-3 w-3 rounded-full bg-emerald-500 mr-2';
      elements.statusText.textContent = 'Connected';
      elements.connectButton.textContent = 'Disconnect';
      elements.connectButton.disabled = false;
      break;
    case 'error':
      statusDot.className = 'h-3 w-3 rounded-full bg-red-500 mr-2 animate-pulse-slow';
      elements.statusText.textContent = 'Error';
      elements.connectButton.textContent = 'Reconnect';
      elements.connectButton.disabled = false;
      break;
  }
}

// Update UI based on current state
function updateUI() {
  // Authentication button
  elements.authButton.disabled = !state.connected;
  
  // Test action buttons
  elements.pingButton.disabled = !state.connected;
  elements.movementButton.disabled = !state.authenticated;
  elements.actionButton.disabled = !state.authenticated;
  elements.chatButton.disabled = !state.authenticated;
  
  // Update stats display
  updateStats();
}

// Add log entry
function log(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  
  switch (type) {
    case 'info':
      logEntry.className = 'text-gray-300';
      break;
    case 'success':
      logEntry.className = 'text-emerald-400';
      break;
    case 'error':
      logEntry.className = 'text-red-400';
      break;
    case 'chat':
      logEntry.className = 'text-blue-300';
      break;
    case 'action':
      logEntry.className = 'text-purple-300';
      break;
    default:
      logEntry.className = 'text-gray-300';
  }
  
  logEntry.textContent = `[${timestamp}] ${message}`;
  elements.eventLog.appendChild(logEntry);
  
  // Scroll to bottom
  elements.eventLog.scrollTop = elements.eventLog.scrollHeight;
}

// Clear log
function clearLog() {
  elements.eventLog.innerHTML = '';
}

// Update stats display
function updateStats() {
  elements.messagesReceived.textContent = state.messageCountReceived;
  elements.messagesSent.textContent = state.messageCountSent;
}

// Update player position on map
function updatePlayerPosition(characterId, position, isCurrentPlayer) {
  // Calculate position on map (translate game coordinates to map coordinates)
  // Assuming map is 1000x1000 and our display is relative to that
  const mapWidth = elements.playerMap.clientWidth;
  const mapHeight = elements.playerMap.clientHeight;
  const xPercent = (position.x / 1000) * 100;
  const yPercent = (position.y / 1000) * 100;
  
  // Check if player already exists on map
  if (state.players.has(characterId)) {
    // Update existing player
    const player = state.players.get(characterId);
    if (player?.element) {
      player.element.style.left = `${xPercent}%`;
      player.element.style.top = `${yPercent}%`;
      player.position = position;
    }
  } else {
    // Create new player element
    const playerEl = document.createElement('div');
    playerEl.className = isCurrentPlayer 
      ? 'absolute h-3 w-3 rounded-full bg-emerald-500 transform -translate-x-1/2 -translate-y-1/2' 
      : 'absolute h-3 w-3 rounded-full bg-blue-500 transform -translate-x-1/2 -translate-y-1/2';
    playerEl.style.left = `${xPercent}%`;
    playerEl.style.top = `${yPercent}%`;
    
    // Add ID as tooltip
    playerEl.title = `Player ${characterId}`;
    
    // Add to map
    elements.playerMap.appendChild(playerEl);
    
    // Store player
    state.players.set(characterId, {
      position,
      element: playerEl
    });
  }
}

// Remove player from map
function removePlayerFromMap(characterId) {
  if (state.players.has(characterId)) {
    const player = state.players.get(characterId);
    if (player?.element?.parentNode) {
      player.element.parentNode.removeChild(player.element);
    }
    state.players.delete(characterId);
  }
}

// Clear all players from map
function clearPlayerMap() {
  for (const [characterId, player] of state.players) {
    if (player?.element?.parentNode) {
      player.element.parentNode.removeChild(player.element);
    }
  }
  state.players.clear();
}

// Initialize
window.addEventListener('DOMContentLoaded', init); 

// Update map with grid cells
function drawGridCells(ctx, activeCells) {
  const cellSize = 50; // Same scale as our player dots
  
  ctx.save();
  ctx.lineWidth = 1;
  
  // Draw all active cells
  if (activeCells?.length) {
    for (const cell of activeCells) {
      const [x, y] = cell.split(':').map(coord => Number.parseInt(coord));
      ctx.strokeStyle = 'rgba(65, 185, 131, 0.5)';
      ctx.fillStyle = 'rgba(65, 185, 131, 0.1)';
      
      // Draw cell rectangle
      ctx.beginPath();
      ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.fill();
      ctx.stroke();
      
      // Draw cell coordinates
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '8px monospace';
      ctx.fillText(`${x}:${y}`, x * cellSize + 5, y * cellSize + 12);
    }
  }
  
  ctx.restore();
}

// Draw map function
function drawMap() {
  if (!mapCtx) return;
  
  clearMap(mapCtx);
  
  // Draw grid cells first
  drawGridCells(mapCtx, state.activeCells);
  
  // Then draw players on top
  drawPlayers(mapCtx);
} 