import { WebSocketService } from './websocket-service';
import type { WebSocketStatus } from './websocket-service';
import type { RoomInfo } from '../ui/room-info-display';

export interface PlayerState {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
  };
  lastUpdate: number;
}

export interface WorldUpdate {
  players: PlayerState[];
  timestamp: number;
}

/**
 * Service for handling real-time world state synchronization
 */
export class WorldService {
  private wsService: WebSocketService;
  private playerStates: Map<string, PlayerState> = new Map();
  private playerId = '';
  private playerUpdateListeners: ((players: Map<string, PlayerState>) => void)[] = [];
  private connectionStatusListeners: ((status: WebSocketStatus) => void)[] = [];
  private roomInfoListeners: ((roomInfo: RoomInfo) => void)[] = [];
  
  constructor() {
    this.wsService = new WebSocketService();
    
    // Initialize connection status monitoring
    this.monitorConnectionStatus();
  }

  /**
   * Initialize the world service and connect to the WebSocket server
   */
  async initialize(): Promise<boolean> {
    try {
      // Connect to WebSocket server
      const connected = await this.wsService.connect();
      
      if (connected) {
        // Set up event listeners
        this.wsService.on('world_update', (data: unknown) => this.handleWorldUpdate(data as WorldUpdate));
        this.wsService.on('player_join', (data: unknown) => this.handlePlayerJoin(data as PlayerState));
        this.wsService.on('player_leave', (data: unknown) => this.handlePlayerLeave(data as { id: string }));
        this.wsService.on('room_info', (data: unknown) => this.handleRoomInfo(data as RoomInfo));
        
        console.log('WorldService initialized successfully');
        
        // Request initial room information
        this.requestRoomInfo();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to initialize WorldService:', error);
      return false;
    }
  }
  
  /**
   * Monitor WebSocket connection status and notify listeners when it changes
   */
  private monitorConnectionStatus(): void {
    // Listen for status changes
    this.wsService.on('status_change', (data: unknown) => {
      const statusData = data as { status: WebSocketStatus };
      if (statusData?.status) {
        this.notifyConnectionStatusListeners(statusData.status);
      }
    });
  }
  
  /**
   * Register a callback to be notified when the connection status changes
   */
  onConnectionStatusChange(callback: (status: WebSocketStatus) => void): void {
    this.connectionStatusListeners.push(callback);
    
    // Also notify immediately with current status
    callback(this.wsService.status);
  }
  
  /**
   * Notify all connection status listeners
   */
  private notifyConnectionStatusListeners(status: WebSocketStatus): void {
    for (const listener of this.connectionStatusListeners) {
      listener(status);
    }
  }
  
  /**
   * Request current room information from the server
   */
  requestRoomInfo(): void {
    if (this.wsService.status !== 'connected') {
      console.error('Cannot request room info: Not connected to server');
      return;
    }
    
    this.wsService.sendMessage('get_rooms', {});
  }
  
  /**
   * Handle room information updates from the server
   */
  private handleRoomInfo(roomInfo: RoomInfo): void {
    console.log('Received room info:', roomInfo);
    
    // Notify listeners
    for (const listener of this.roomInfoListeners) {
      listener(roomInfo);
    }
  }
  
  /**
   * Register a callback to be notified when room information changes
   */
  onRoomInfoUpdate(callback: (roomInfo: RoomInfo) => void): void {
    this.roomInfoListeners.push(callback);
  }
  
  /**
   * Join the world with a player ID and initial position
   */
  async joinWorld(id: string, name: string, x: number, y: number): Promise<boolean> {
    try {
      this.playerId = id;
      
      const playerState: PlayerState = {
        id,
        name,
        position: { x, y },
        lastUpdate: Date.now()
      };
      
      // Update local state
      this.playerStates.set(id, playerState);
      
      // Notify server
      await this.wsService.sendMessage('join_world', playerState);
      
      console.log(`Player ${id} joined the world at position (${x}, ${y})`);
      return true;
    } catch (error) {
      console.error('Failed to join world:', error);
      return false;
    }
  }
  
  /**
   * Update the player's position in the world
   */
  async updatePlayerPosition(x: number, y: number): Promise<void> {
    if (!this.playerId) {
      console.error('Cannot update position: Not joined to world');
      return;
    }
    
    const player = this.playerStates.get(this.playerId);
    
    if (!player) {
      console.error('Player state not found');
      return;
    }
    
    // Update player state
    player.position.x = x;
    player.position.y = y;
    player.lastUpdate = Date.now();
    
    // Send update to server
    await this.wsService.sendMessage('player_move', {
      id: this.playerId,
      position: { x, y },
      timestamp: player.lastUpdate
    });
  }
  
  /**
   * Leave the world
   */
  async leaveWorld(): Promise<void> {
    if (!this.playerId) return;
    
    try {
      // Notify server
      await this.wsService.sendMessage('leave_world', {
        id: this.playerId
      });
      
      // Clean up
      this.playerStates.delete(this.playerId);
      this.playerId = '';
      
      // Disconnect from WebSocket
      this.wsService.disconnect();
      
      console.log('Left the world');
    } catch (error) {
      console.error('Error leaving world:', error);
    }
  }
  
  /**
   * Get the current state of all players
   */
  getAllPlayers(): Map<string, PlayerState> {
    return new Map(this.playerStates);
  }
  
  /**
   * Get other players (excluding the current player)
   */
  getOtherPlayers(): Map<string, PlayerState> {
    const otherPlayers = new Map(this.playerStates);
    otherPlayers.delete(this.playerId);
    return otherPlayers;
  }
  
  /**
   * Subscribe to player updates
   */
  onPlayersUpdate(callback: (players: Map<string, PlayerState>) => void): void {
    this.playerUpdateListeners.push(callback);
  }
  
  /**
   * Unsubscribe from player updates
   */
  offPlayersUpdate(callback: (players: Map<string, PlayerState>) => void): void {
    const index = this.playerUpdateListeners.indexOf(callback);
    if (index !== -1) {
      this.playerUpdateListeners.splice(index, 1);
    }
  }
  
  /**
   * Handler for world update events from the server
   */
  private handleWorldUpdate(data: WorldUpdate): void {
    // Update player states from server data
    for (const [id, playerData] of Object.entries(data.players)) {
      this.playerStates.set(id, playerData);
    }
    
    // Notify listeners of the update
    this.notifyUpdateListeners();
  }
  
  /**
   * Handler for player join events
   */
  private handlePlayerJoin(data: PlayerState): void {
    // Add new player to our state
    this.playerStates.set(data.id, data);
    console.log(`Player ${data.id} joined the world`);
    
    // Notify listeners of the update
    this.notifyUpdateListeners();
  }
  
  /**
   * Handler for player leave events
   */
  private handlePlayerLeave(data: { id: string }): void {
    // Remove player from our state
    this.playerStates.delete(data.id);
    console.log(`Player ${data.id} left the world`);
    
    // Notify listeners of the update
    this.notifyUpdateListeners();
  }
  
  /**
   * Notify all listeners of player state updates
   */
  private notifyUpdateListeners(): void {
    for (const listener of this.playerUpdateListeners) {
      try {
        listener(this.playerStates);
      } catch (error) {
        console.error('Error in player update listener:', error);
      }
    }
  }

  /**
   * Reconnect to the WebSocket server
   * Useful when a connection is lost or fails
   */
  async reconnect(): Promise<boolean> {
    console.log('WorldService: Attempting to reconnect...');
    
    try {
      // Explicitly disconnect first to clean up any lingering connections
      this.wsService.disconnect();
      
      // Attempt to connect again
      const connected = await this.wsService.connect();
      
      if (connected) {
        console.log('WorldService: Reconnection successful');
        return true;
      }
      
      console.log('WorldService: Reconnection failed');
      return false;
    } catch (error) {
      console.error('WorldService: Error during reconnection:', error);
      return false;
    }
  }
} 