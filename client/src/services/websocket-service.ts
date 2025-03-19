import { GameConfig } from '../config';
import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: string;
  data?: any;
  clientId?: string;
  timestamp?: number;
}

export type WebSocketStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = GameConfig.websocket.reconnectAttempts;
  private reconnectDelay: number = GameConfig.websocket.reconnectDelay;
  private messageCallbacks: Map<string, ((data: any) => void)[]> = new Map();
  private clientId: string = Math.random().toString(36).substring(7);
  private connectionPromise: Promise<boolean> | null = null;
  private debug: boolean = GameConfig.websocket.debug;
  private _status: WebSocketStatus = 'disconnected';
  private pingInterval: number | null = null;
  private lastPongTime: number = 0;
  private connectionStartTime: number = 0;
  
  constructor() {
    this.logDebug('WebSocketService initialized with clientId:', this.clientId);
    // Setup beforeunload event to close the connection properly on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanupConnection();
    });
  }
  
  /**
   * Get the current connection status
   */
  get status(): WebSocketStatus {
    return this._status;
  }
  
  /**
   * Set the connection status and dispatch an event
   */
  private set status(newStatus: WebSocketStatus) {
    if (this._status !== newStatus) {
      this._status = newStatus;
      this.dispatchEvent('status_change', { status: newStatus });
      this.logDebug(`Status changed to: ${newStatus}`);
    }
  }
  
  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<boolean> {
    // Set status to connecting
    this.status = 'connecting';
    
    // If we're already connected, return a resolved promise
    if (this.isConnected && this.socket) {
      this.logDebug('Already connected');
      this.status = 'connected';
      return Promise.resolve(true);
    }
    
    // If we're in the process of connecting, return the existing promise
    if (this.connectionPromise) {
      this.logDebug('Connection already in progress');
      return this.connectionPromise;
    }
    
    // Reset connection properties
    this.connectionStartTime = Date.now();
    
    // Create a new promise for the connection attempt
    this.connectionPromise = new Promise((resolve, reject) => {
      // First check server availability before trying connection
      this.checkServerAvailability(GameConfig.apiUrl)
        .then(isAvailable => {
          if (!isAvailable) {
            this.status = 'error';
            throw new Error('Server is not responding to HTTP request. Is it running?');
          }
          
          // Generate the Socket.io URL
          const socketUrl = this.getSocketUrl();
          this.logDebug(`Connecting to Socket.io at ${socketUrl}`);
          
          try {
            // Create a new Socket.io connection
            this.socket = io(socketUrl, {
              transports: ['websocket', 'polling'],
              reconnection: false, // We'll handle reconnection ourselves
              query: {
                clientId: this.clientId
              },
              timeout: GameConfig.websocket.timeout,
              withCredentials: true, // Enable CORS credentials
            });
            
            // Set up event handlers
            this.socket.on('connect', () => this.handleSocketOpen(resolve));
            this.socket.on('disconnect', (reason) => this.handleSocketClose(reject, reason));
            this.socket.on('connect_error', (error) => this.handleSocketError(reject, error));
            
            // Listen for various message types
            this.socket.on('connected', (data) => this.handleMessage({ type: 'connected', data }));
            this.socket.on('pong', (data) => this.handleMessage({ type: 'pong', data }));
            this.socket.on('game_state', (data) => this.handleMessage({ type: 'game_state', data }));
            this.socket.on('move', (data) => this.handleMessage({ type: 'move', data }));
            this.socket.on('action', (data) => this.handleMessage({ type: 'action', data }));
            this.socket.on('test_response', (data) => this.handleMessage({ type: 'test_response', data }));
            
            // Generic error handler
            this.socket.on('error', (error) => {
              this.logError('Socket.io error:', error);
              this.dispatchEvent('error', { error });
            });
            
          } catch (error) {
            this.logError('Failed to create Socket.io connection:', error);
            this.status = 'error';
            this.connectionPromise = null;
            reject(error);
          }
        })
        .catch(error => {
          this.logError('Connection failed:', error);
          this.status = 'error';
          this.connectionPromise = null;
          reject(error);
        });
    });
    
    // Add reconnection logic to the connection promise
    this.connectionPromise = this.connectionPromise.catch(error => {
      // If we haven't exceeded the max reconnect attempts, try to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        this.logDebug(`Connection failed. Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        return new Promise<boolean>((resolve) => {
          setTimeout(() => {
            this.connectionPromise = null;
            this.connect().then(resolve).catch(() => resolve(false));
          }, delay);
        });
      }
      
      // Otherwise, give up
      this.logError('Failed to connect after', this.reconnectAttempts, 'attempts');
      this.status = 'error';
      throw error;
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Get the proper socket URL depending on environment
   */
  private getSocketUrl(): string {
    // For development environments, connect directly to the Socket.io server
    // instead of relying on the automatic proxy
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // For production, we can rely on same origin or a production server URL
    return window.location.origin;
  }
  
  /**
   * Handle socket open event
   */
  private handleSocketOpen(resolve: (value: boolean | PromiseLike<boolean>) => void): void {
    this.logDebug('Socket.io connection established successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
    this.status = 'connected';
    
    // Set up ping/pong for keep-alive
    this.setupPingPong();
    
    // Announce client connection to server
    this.sendMessage('connect_game', { clientId: this.clientId });
    
    // Calculate how long it took to connect
    const connectionTime = Date.now() - this.connectionStartTime;
    this.logDebug(`Connected in ${connectionTime}ms`);
    
    // Resolve the connection promise
    resolve(true);
  }
  
  /**
   * Handle socket close event
   */
  private handleSocketClose(reject: (reason?: any) => void, reason: string): void {
    this.logDebug('Socket.io connection closed:', reason);
    
    // Clean up connection state
    this.isConnected = false;
    this.cleanupConnection();
    
    // Update status
    this.status = 'disconnected';
    
    // Reject the connection promise if it exists
    if (this.connectionPromise) {
      this.connectionPromise = null;
      reject(new Error(`WebSocket closed: ${reason}`));
    }
    
    // Dispatch an event
    this.dispatchEvent('disconnected', { reason });
  }
  
  /**
   * Handle socket error event
   */
  private handleSocketError(reject: (reason?: any) => void, error: Error): void {
    this.logError('Socket.io error:', error);
    
    // Clean up connection state
    this.isConnected = false;
    this.cleanupConnection();
    
    // Update status
    this.status = 'error';
    
    // Reject the connection promise if it exists
    if (this.connectionPromise) {
      this.connectionPromise = null;
      reject(error);
    }
    
    // Dispatch an event
    this.dispatchEvent('error', { error });
  }
  
  /**
   * Handle socket message event
   */
  private handleSocketMessage(data: any): void {
    try {
      // With Socket.io, messages are already parsed to objects
      this.handleMessage(data);
    } catch (error) {
      this.logError('Error handling message:', error);
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (!this.socket) {
      return;
    }
    
    this.logDebug('Disconnecting from Socket.io server');
    
    // Send a disconnect message first
    this.sendMessage('logout', {});
    
    // Clean up our connection
    this.cleanupConnection();
    
    // Update status
    this.status = 'disconnected';
  }
  
  /**
   * Clean up the WebSocket connection
   */
  private cleanupConnection(): void {
    // Clear ping interval
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Close the socket if it exists
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Reset state
    this.isConnected = false;
  }
  
  /**
   * Send a message to the server
   */
  sendMessage(type: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        this.logError('Cannot send message - not connected');
        reject(new Error('Not connected'));
        return;
      }
      
      try {
        // With Socket.io, we emit events directly
        this.socket.emit(type, data);
        resolve();
      } catch (error) {
        this.logError('Error sending message:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Alias for sendMessage for backward compatibility
   */
  send(type: string, data: any): Promise<void> {
    return this.sendMessage(type, data);
  }
  
  /**
   * Register a callback for a specific message type
   */
  on(type: string, callback: (data: any) => void): void {
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
    }
    
    this.messageCallbacks.get(type)!.push(callback);
  }
  
  /**
   * Remove a callback for a specific message type
   */
  off(type: string, callback: (data: any) => void): void {
    if (!this.messageCallbacks.has(type)) {
      return;
    }
    
    const callbacks = this.messageCallbacks.get(type)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  /**
   * Setup ping/pong for keep-alive
   */
  private setupPingPong(): void {
    // Clear existing interval
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
    }
    
    this.lastPongTime = Date.now();
    
    // Set up ping interval
    this.pingInterval = window.setInterval(() => {
      if (!this.isConnected || !this.socket) {
        return;
      }
      
      // Check if we've received a pong recently
      const now = Date.now();
      if (now - this.lastPongTime > 30000) {
        // Haven't received a pong in 30 seconds, consider the connection dead
        this.logError('No pong received for 30 seconds, reconnecting');
        this.cleanupConnection();
        this.connect();
        return;
      }
      
      // Send ping
      this.sendMessage('ping', { timestamp: now })
        .catch(error => {
          this.logError('Error sending ping:', error);
        });
    }, 15000);
  }
  
  /**
   * Dispatch a custom event
   */
  private dispatchEvent(type: string, data: any): void {
    // Create an event with the same name as the WebSocket message type
    const event = new CustomEvent(`ws:${type}`, { detail: data });
    window.dispatchEvent(event);
  }
  
  /**
   * Check if the server is reachable
   */
  private checkServerAvailability(url: string): Promise<boolean> {
    this.logDebug(`Checking server availability at ${url}`);
    
    return fetch(`${url}/health`, { method: 'GET' })
      .then(response => {
        return response.ok;
      })
      .catch(() => {
        return false;
      });
  }
  
  /**
   * Log a debug message
   */
  private logDebug(...args: any[]): void {
    if (this.debug) {
      console.debug('[WebSocketService]', ...args);
    }
  }
  
  /**
   * Log an error message
   */
  private logError(...args: any[]): void {
    console.error('[WebSocketService]', ...args);
  }
  
  /**
   * Get a human-readable string for a WebSocket state
   */
  private getWebSocketStateString(state: number): string {
    switch (state) {
      case 0: return 'CONNECTING';
      case 1: return 'OPEN';
      case 2: return 'CLOSING';
      case 3: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
  
  /**
   * Handle incoming messages from the server
   */
  private handleMessage(message: WebSocketMessage): void {
    const { type, data } = message;
    
    this.logDebug(`Received message of type ${type}:`, data);
    
    // Special handling for pong messages
    if (type === 'pong') {
      this.lastPongTime = Date.now();
    }
    
    // Invoke callbacks for this message type
    const callbacks = this.messageCallbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        this.logError(`Error in message handler for type ${type}:`, error);
      }
    });
    
    // Also dispatch a general 'message' event
    this.dispatchEvent('message', message);
  }
  
  /**
   * Test the WebSocket connection and return diagnostics
   */
  async testConnection(): Promise<{
    status: WebSocketStatus;
    serverReachable: boolean;
    webSocketState: string | null;
    connectionTime?: number;
    error?: string;
  }> {
    const result = {
      status: this.status,
      serverReachable: false,
      webSocketState: this.socket ? (this.socket.connected ? 'CONNECTED' : 'DISCONNECTED') : null,
      connectionTime: undefined as number | undefined,
      error: undefined as string | undefined,
    };
    
    try {
      // Check if server is reachable
      result.serverReachable = await this.checkServerAvailability(GameConfig.apiUrl);
      
      // If not connected, try to connect
      if (!this.isConnected) {
        const startTime = Date.now();
        
        try {
          await this.connect();
          result.connectionTime = Date.now() - startTime;
          result.status = this.status;
          result.webSocketState = this.socket ? (this.socket.connected ? 'CONNECTED' : 'DISCONNECTED') : null;
        } catch (error) {
          result.error = error instanceof Error ? error.message : 'Unknown error during connection';
        }
      } else if (this.socket) {
        // If connected, send a ping and wait for pong
        const startTime = Date.now();
        
        try {
          await Promise.race([
            this.sendMessage('ping', { timestamp: startTime }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 5000))
          ]);
          
          result.connectionTime = Date.now() - startTime;
        } catch (error) {
          result.error = error instanceof Error ? error.message : 'Unknown error during ping test';
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error during connection test';
    }
    
    return result;
  }
} 