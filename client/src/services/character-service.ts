import axios from 'axios';
import { GameConfig } from '../config';

export interface Character {
  id: number;
  userId: number;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  createdAt: string;
  updatedAt: string;
}

export class CharacterService {
  private baseUrl: string;
  private api: any;
  
  constructor() {
    // Use the proxy through Vite for development instead of direct connection
    this.baseUrl = '/api';
    
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
  
  async getCharacters(): Promise<Character[]> {
    try {
      const response = await this.api.get('/characters', this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching characters:', error);
      throw new Error('Failed to fetch characters');
    }
  }
  
  async createCharacter(name: string): Promise<Character> {
    try {
      const response = await this.api.post(
        '/characters',
        { name },
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error creating character:', error);
      throw new Error('Failed to create character');
    }
  }
  
  async getCharacter(id: number): Promise<Character> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/characters/${id}`,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting character ${id}:`, error);
      throw new Error('Failed to get character');
    }
  }
} 