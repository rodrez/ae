import axios from 'axios';
import { GameConfig } from '../config';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export class AuthService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = GameConfig.apiUrl;
  }
  
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/register`, {
        username,
        email,
        password
      });
      
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Registration failed');
    }
  }
  
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email,
        password
      });
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed');
    }
  }
  
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  }
  
  getToken(): string | null {
    return localStorage.getItem('token');
  }
  
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
} 