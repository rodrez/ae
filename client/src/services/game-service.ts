import axios from 'axios';
import { GameConfig } from '../config';

export interface NearbyPlayersResponse {
  players: Array<{
    id: number;
    name: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
    distance: number;
  }>;
}

export class GameService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = GameConfig.apiUrl;
  }
  
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }
  
  async enterGame(characterId: number): Promise<{ success: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/game/enter`,
        { characterId },
        this.getAuthHeaders()
      );
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
  ): Promise<{ success: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/game/position`,
        { 
          characterId,
          position: { x, y, z }
        },
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error updating position:', error);
      throw new Error('Failed to update position');
    }
  }
  
  async getNearbyPlayers(characterId: number, radius: number = 20): Promise<NearbyPlayersResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/game/nearby?characterId=${characterId}&radius=${radius}`,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error getting nearby players:', error);
      throw new Error('Failed to get nearby players');
    }
  }
  
  async exitGame(characterId: number): Promise<{ success: boolean }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/game/exit`,
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