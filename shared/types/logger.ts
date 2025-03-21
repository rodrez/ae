export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum LogCategory {
  MAP = 'map',
  SYSTEM = 'system',
  GAME = 'game',
  NETWORK = 'network',
  INPUT = 'input',
  RENDERING = 'rendering',
  UI = 'ui',
  PERFORMANCE = 'performance',
  DATABASE = 'database',
  AUTH = 'auth',
  PLAYER = 'player',
  MONSTER = 'monster',
  DUNGEON = 'dungeon',
  ITEM = 'item',
  EQUIPMENT = 'equipment',
  CRAFTING = 'crafting',
  INVENTORY = 'inventory',
  CHAT = 'chat',
}

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  category: LogCategory | string;
  message: string;
  data?: unknown;
  source?: string;
}

export interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  enabledCategories: Set<string>;
  maxLogSize?: number;
  persistToStorage?: boolean;
}

export interface LoggerInterface {
  debug(category: LogCategory | string, message: string, data?: unknown): void;
  info(category: LogCategory | string, message: string, data?: unknown): void;
  warn(category: LogCategory | string, message: string, data?: unknown): void;
  error(category: LogCategory | string, message: string, data?: unknown): void;
  fatal(category: LogCategory | string, message: string, data?: unknown): void;
  setConfig(config: Partial<LoggerConfig>): void;
  getConfig(): LoggerConfig;
  getLogHistory(): LogMessage[];
  clearLogs(): void;
  subscribe(callback: (message: LogMessage) => void): () => void;
} 