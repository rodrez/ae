import axios from 'axios';
import { GameConfig } from '../config';
import { WebSocketService } from './websocket-service';

export interface PlayerData {
  id: number;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  distance?: number;
}

export interface GameEnterResponse {
  success: boolean;
  message: string;
  activePlayerCount: number;
}

export interface GameExitResponse {
  success: boolean;
}

export interface NearbyPlayersResponse {
  players: PlayerData[];
}

export class GameService {
  private baseUrl: string;
  private wsService: WebSocketService;
  private playerUpdateListeners: ((data: any) => void)[] = [];
  private api: any;
  // Store last positions to maintain local state if server updates fail
  private lastPositions: Map<number, {x: number, y: number, z: number}> = new Map();
  
  constructor() {
    // Use the proxy through Vite for development instead of direct connection
    this.baseUrl = '/api';
    this.wsService = new WebSocketService();
    
    // Create an Axios instance with CORS configuration
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for CORS with credentials
    });
  }
  
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      },
      withCredentials: true
    };
  }
  
  async initialize() {
    try {
      await this.wsService.connect();
      
      // Listen for player update events
      this.wsService.on('move', this.handlePlayerMove.bind(this));
      this.wsService.on('disconnect', this.handlePlayerDisconnect.bind(this));
      
      return true;
    } catch (error) {
      console.error('Failed to initialize game service:', error);
      return false;
    }
  }
  
  private handlePlayerMove(data: any) {
    this.notifyPlayerUpdateListeners({
      type: 'move',
      characterId: data.characterId,
      position: data.position
    });
  }
  
  private handlePlayerDisconnect(data: any) {
    this.notifyPlayerUpdateListeners({
      type: 'disconnect',
      characterId: data.characterId
    });
  }
  
  onPlayerUpdate(callback: (data: any) => void) {
    this.playerUpdateListeners.push(callback);
  }
  
  offPlayerUpdate(callback: (data: any) => void) {
    const index = this.playerUpdateListeners.indexOf(callback);
    if (index !== -1) {
      this.playerUpdateListeners.splice(index, 1);
    }
  }
  
  private notifyPlayerUpdateListeners(data: any) {
    for (const listener of this.playerUpdateListeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in player update listener:', error);
      }
    }
  }
  
  async enterGame(characterId: number): Promise<GameEnterResponse> {
    try {
      const response = await this.api.post(
        '/game/enter',
        { characterId },
        this.getAuthHeaders()
      );
      
      console.log('Entered game:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error entering game:', error);
      throw new Error('Failed to enter game');
    }
  }
  
  async updatePosition(
    characterId: number,
    x: number,
    y: number,
    z: number = 0
  ): Promise<void> {
    try {
      // Ensure we have valid position values
      const validX = typeof x === 'number' && !isNaN(x) ? x : 0;
      const validY = typeof y === 'number' && !isNaN(y) ? y : 0;
      const validZ = typeof z === 'number' && !isNaN(z) ? z : 0;
      
      // For graceful degradation, track position in memory even if server updates fail
      const position = { x: validX, y: validY, z: validZ };
      this.lastPositions.set(characterId, position);
      
      // Send position update via HTTP API
      const response = await this.api.post(
        '/game/position',
        { characterId, position },
        this.getAuthHeaders()
      );
      
      return response.data;
    } catch (error) {
      // Log the error details for debugging
      console.error('Error updating position:', error);
      
      // Return the cached position to maintain local state
      if (axios.isAxiosError(error)) {
        // Log more detailed information about the request
        console.error('Request details:', {
          url: error.config?.url,
          method: error.config?.method,
          data: JSON.parse(error.config?.data || '{}'),
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        });
        
        // If token expired (401) or invalid token
        if (error.response?.status === 401) {
          console.warn('Authentication issue. You may need to log in again.');
        } 
        // If server error (500), allow local gameplay to continue
        else if (error.response?.status === 500) {
          console.warn('Server encountered an error. Position update will be retried later.');
          // Continue gameplay locally without throwing an error
          return;
        }
      }
      
      // For other types of errors, throw to let the game scene handle it
      throw error;
    }
  }
  
  async getNearbyPlayers(characterId: number, radius: number = 100): Promise<NearbyPlayersResponse> {
    try {
      const response = await this.api.get(
        `/game/nearby?characterId=${characterId}&radius=${radius}`,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error getting nearby players:', error);
      return { players: [] };
    }
  }
  
  async exitGame(characterId: number): Promise<GameExitResponse> {
    try {
      // Clean up WebSocket listeners
      this.wsService.off('move', this.handlePlayerMove.bind(this));
      this.wsService.off('disconnect', this.handlePlayerDisconnect.bind(this));
      this.wsService.disconnect();
      
      const response = await this.api.post(
        '/game/exit',
        { characterId },
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error exiting game:', error);
      throw new Error('Failed to exit game');
    }
  }
} 