/**
 * Shared type definitions between client and server
 */

export interface PlayerPosition {
  x: number;
  y: number;
  z?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  position: PlayerPosition;
  lastUpdate: number;
}

export interface WorldUpdate {
  players: Record<string, PlayerState>;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  channel?: string;
}

export type GameEventType = 
  | 'player_join'
  | 'player_leave'
  | 'player_move'
  | 'chat_message'
  | 'world_update';

export interface GameEvent<T = unknown> {
  type: GameEventType;
  data: T;
  timestamp: number;
} 