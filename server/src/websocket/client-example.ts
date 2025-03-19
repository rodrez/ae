/**
 * Example client implementation for the Alternate Earth MMO WebSocket API
 */
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

type Position = {
  x: number;
  y: number;
  z?: number;
  rotation?: number;
};

type Vector = {
  x: number;
  y: number;
  z?: number;
};

interface GameAction {
  characterId: number;
  actionType: string;
  targetId?: number;
  parameters?: Record<string, unknown>;
  timestamp: number;
}

interface ServerError {
  code: string;
  message: string;
  type?: string;
}

interface GameStateData {
  type: string;
  timestamp: number;
  playerData?: {
    position: Position;
    [key: string]: unknown;
  };
  nearbyPlayers?: Array<{
    characterId: number;
    position: Position;
  }>;
  [key: string]: unknown;
}

class GameClient {
  private socket: Socket;
  private characterId?: number;
  private position?: Position;
  private connected = false;
  private authenticated = false;
  private pingInterval?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private latency = 0;
  private nearbyPlayers = new Map<number, { position: Position, lastUpdate: number }>();
  private onPlayerMove?: (characterId: number, position: Position) => void;
  private onPlayerJoin?: (characterId: number) => void;
  private onPlayerLeave?: (characterId: number) => void;
  private onChatMessage?: (characterId: number, message: string, channel: string) => void;
  private onGameAction?: (data: GameAction) => void;
  private onConnectionChange?: (connected: boolean) => void;
  private onError?: (code: string, message: string) => void;

  constructor(serverUrl: string, clientId?: string) {
    this.socket = io(serverUrl, {
      query: clientId ? { clientId } : undefined,
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false, // We'll handle reconnection manually
    });

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for socket.io events
   */
  private setupEventListeners(): void {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange?.(true);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log(`Disconnected from server: ${reason}`);
      this.connected = false;
      this.authenticated = false;
      this.clearPingInterval();
      this.onConnectionChange?.(false);

      // Try to reconnect if it wasn't an intentional disconnect
      if (reason !== 'io client disconnect') {
        this.tryReconnect();
      }
    });

    this.socket.on('connected', (data: { message: string; timestamp: number; clientId: string }) => {
      console.log('Server acknowledged connection', data);
    });

    // Game state events
    this.socket.on('game_state', (data: GameStateData) => {
      if (data.type === 'initial_state') {
        console.log('Received initial state', data);
      } else if (data.type === 'world_state') {
        console.log('Received world state with nearby players');
        
        if (data.playerData) {
          this.position = data.playerData.position;
        }
        
        // Update nearby players
        if (data.nearbyPlayers) {
          for (const player of data.nearbyPlayers) {
            this.nearbyPlayers.set(player.characterId, {
              position: player.position,
              lastUpdate: Date.now()
            });
            this.onPlayerJoin?.(player.characterId);
          }
        }
      }
    });

    // Movement updates
    this.socket.on('move', (data: { characterId: number; position: Position }) => {
      const characterId = data.characterId;
      if (characterId === this.characterId) return; // Ignore own movement
      
      // Update player position
      this.nearbyPlayers.set(characterId, {
        position: data.position,
        lastUpdate: Date.now()
      });
      
      this.onPlayerMove?.(characterId, data.position);
    });

    // Player connection/disconnection
    this.socket.on('player_connected', (data: { characterId: number }) => {
      console.log(`Player ${data.characterId} connected`);
      this.onPlayerJoin?.(data.characterId);
    });

    this.socket.on('player_disconnected', (data: { characterId: number }) => {
      console.log(`Player ${data.characterId} disconnected`);
      this.nearbyPlayers.delete(data.characterId);
      this.onPlayerLeave?.(data.characterId);
    });

    // Chat messages
    this.socket.on('chat', (data: { characterId: number; message: string; channel: string }) => {
      console.log(`Chat from ${data.characterId}: ${data.message}`);
      this.onChatMessage?.(data.characterId, data.message, data.channel);
    });

    // Action notifications
    this.socket.on('action', (data: GameAction) => {
      console.log(`Action from ${data.characterId}: ${data.actionType}`);
      this.onGameAction?.(data);
    });

    // Error handling
    this.socket.on('error', (data: ServerError) => {
      console.error(`Server error: ${data.code} - ${data.message}`);
      this.onError?.(data.code, data.message);
    });

    // Latency measurement
    this.socket.on('pong', (data: { timestamp?: number }) => {
      if (data.timestamp) {
        this.latency = Date.now() - data.timestamp;
      }
    });
  }

  /**
   * Try to reconnect to server after disconnect
   */
  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.clearPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, 10000); // Ping every 10 seconds
  }

  /**
   * Clear ping interval
   */
  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  /**
   * Connect to the server
   */
  public connect(): void {
    if (!this.connected) {
      this.socket.connect();
    }
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    this.authenticated = false;
    this.clearPingInterval();
    
    if (this.connected) {
      this.socket.emit('logout');
      this.socket.disconnect();
    }
  }

  /**
   * Authenticate with the server
   */
  public authenticate(characterId: number, characterName: string, token?: string): void {
    if (!this.connected) {
      console.error('Cannot authenticate: not connected to server');
      return;
    }

    this.characterId = characterId;
    
    this.socket.emit('connect_game', {
      characterId,
      characterName,
      token
    });
    
    this.authenticated = true;
    this.startPingInterval();
  }

  /**
   * Update player position
   */
  public movePlayer(position: Position, velocity?: Vector, animation?: string): void {
    if (!this.authenticated) {
      console.error('Cannot move: not authenticated');
      return;
    }

    this.position = position;
    
    this.socket.emit('move', {
      position,
      velocity,
      animation
    });
  }

  /**
   * Perform game action
   */
  public performAction(actionType: string, targetId?: number, parameters?: Record<string, unknown>): void {
    if (!this.authenticated) {
      console.error('Cannot perform action: not authenticated');
      return;
    }
    
    this.socket.emit('action', {
      type: actionType,
      targetId,
      parameters
    });
  }

  /**
   * Send chat message
   */
  public sendChatMessage(message: string, channel?: string): void {
    if (!this.authenticated) {
      console.error('Cannot send message: not authenticated');
      return;
    }
    
    this.socket.emit('chat', {
      message,
      channel
    });
  }

  /**
   * Get current latency in milliseconds
   */
  public getLatency(): number {
    return this.latency;
  }

  /**
   * Get list of nearby players
   */
  public getNearbyPlayers(): Map<number, Position> {
    const players = new Map<number, Position>();
    
    for (const [characterId, data] of this.nearbyPlayers.entries()) {
      players.set(characterId, data.position);
    }
    
    return players;
  }

  /**
   * Register event handlers
   */
  public on(event: 'playerMove', callback: (characterId: number, position: Position) => void): void;
  public on(event: 'playerJoin', callback: (characterId: number) => void): void;
  public on(event: 'playerLeave', callback: (characterId: number) => void): void;
  public on(event: 'chatMessage', callback: (characterId: number, message: string, channel: string) => void): void;
  public on(event: 'gameAction', callback: (data: GameAction) => void): void;
  public on(event: 'connectionChange', callback: (connected: boolean) => void): void;
  public on(event: 'error', callback: (code: string, message: string) => void): void;
  public on(event: string, callback: unknown): void {
    switch (event) {
      case 'playerMove':
        this.onPlayerMove = callback as (characterId: number, position: Position) => void;
        break;
      case 'playerJoin':
        this.onPlayerJoin = callback as (characterId: number) => void;
        break;
      case 'playerLeave':
        this.onPlayerLeave = callback as (characterId: number) => void;
        break;
      case 'chatMessage':
        this.onChatMessage = callback as (characterId: number, message: string, channel: string) => void;
        break;
      case 'gameAction':
        this.onGameAction = callback as (data: GameAction) => void;
        break;
      case 'connectionChange':
        this.onConnectionChange = callback as (connected: boolean) => void;
        break;
      case 'error':
        this.onError = callback as (code: string, message: string) => void;
        break;
    }
  }
}

// Usage example
function exampleUsage(): void {
  const client = new GameClient('https://your-server-url');
  
  client.on('connectionChange', (connected) => {
    console.log(`Connection state changed: ${connected ? 'connected' : 'disconnected'}`);
    
    if (connected) {
      // Authenticate after successful connection
      client.authenticate(12345, 'PlayerName', 'optional-auth-token');
    }
  });
  
  client.on('playerMove', (characterId, position) => {
    console.log(`Player ${characterId} moved to`, position);
    // Update game rendering
  });
  
  client.on('chatMessage', (characterId, message, channel) => {
    console.log(`[${channel}] ${characterId}: ${message}`);
    // Update chat UI
  });
  
  client.on('error', (code, message) => {
    console.error(`Error: ${code} - ${message}`);
    
    if (code === 'RATE_LIMIT') {
      // Implement backoff strategy
    }
  });
  
  // Connect to server
  client.connect();
  
  // Example game loop (would be integrated with your game engine)
  function gameLoop(): void {
    // Update player position based on inputs
    if (Math.random() > 0.95) { // Just for testing
      client.movePlayer(
        { x: Math.random() * 1000, y: Math.random() * 1000, rotation: Math.random() * Math.PI * 2 },
        { x: 0, y: 0 },
        'idle'
      );
    }
    
    // Request next frame
    requestAnimationFrame(gameLoop);
  }
  
  // Start game loop
  gameLoop();
}

export { GameClient }; 