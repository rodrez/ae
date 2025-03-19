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
  private api: any;
  
  constructor() {
    // Use the proxy through Vite for development instead of direct connection
    this.baseUrl = '/api';
    console.log('AuthService initialized with baseUrl:', this.baseUrl);
    
    // Create an Axios instance with CORS configuration
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for CORS with credentials
    });
  }
  
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting to register user:', { username, email });
      const response = await this.api.post('/auth/register', {
        username,
        email,
        password
      });
      
      console.log('Registration successful:', response);
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Request details:', {
          url: error.config?.url,
          headers: error.config?.headers,
          data: error.config?.data,
          status: error.response?.status,
          responseData: error.response?.data
        });
      }
      throw new Error('Registration failed');
    }
  }
  
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting to login user:', { email });
      const response = await this.api.post('/auth/login', {
        email,
        password
      });
      
      console.log('Login successful:', response);
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Request details:', {
          url: error.config?.url,
          headers: error.config?.headers,
          data: error.config?.data,
          status: error.response?.status,
          responseData: error.response?.data
        });
      }
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