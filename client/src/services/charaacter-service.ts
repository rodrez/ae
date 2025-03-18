import axios from 'axios';
import { GameConfig } from '../config';

export interface Character {
  id: number;
  name: string;
  level: number;
  experience: number;
  health: number;
  mana: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

export class CharacterService {
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
  
  async getCharacters(): Promise<Character[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/characters`, this.getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error getting characters:', error);
      throw new Error('Failed to get characters');
    }
  }
  
  async createCharacter(name: string): Promise<Character> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/characters`,
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