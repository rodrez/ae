import { LogLevel, LogCategory } from '../../../shared/types';
import type { LogMessage, LoggerConfig, LoggerInterface } from '../../../shared/types';

/**
 * Core logger implementation that provides configurable logging with category filtering
 */
class Logger implements LoggerInterface {
  private static instance: Logger;
  private logs: LogMessage[] = [];
  private subscribers: Set<(message: LogMessage) => void> = new Set();
  private config: LoggerConfig = {
    enabled: true,
    minLevel: LogLevel.DEBUG,
    enabledCategories: new Set(Object.values(LogCategory)),
    maxLogSize: 1000,
    persistToStorage: true
  };

  private constructor() {
    this.loadFromStorage();
  }

  /**
   * Get the singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Create a log entry with DEBUG level
   */
  public debug(category: LogCategory | string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  /**
   * Create a log entry with INFO level
   */
  public info(category: LogCategory | string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  /**
   * Create a log entry with WARN level
   */
  public warn(category: LogCategory | string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  /**
   * Create a log entry with ERROR level
   */
  public error(category: LogCategory | string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * Create a log entry with FATAL level
   */
  public fatal(category: LogCategory | string, message: string, data?: unknown): void {
    this.log(LogLevel.FATAL, category, message, data);
  }

  /**
   * Internal method for creating log entries
   */
  public log(level: LogLevel, category: LogCategory | string, message: string, data?: unknown): void {
    if (!this.config.enabled) return;
    if (!this.isCategoryEnabled(category)) return;
    if (!this.isLevelEnabled(level)) return;

    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      source: this.getCallerInfo()
    };

    this.addLogMessage(logMessage);
  }

  /**
   * Add a new log message to the history and notify subscribers
   */
  private addLogMessage(message: LogMessage): void {
    // Add to logs array
    this.logs.push(message);
    
    // Trim logs if they exceed max size
    if (this.config.maxLogSize && this.logs.length > this.config.maxLogSize) {
      this.logs = this.logs.slice(this.logs.length - this.config.maxLogSize);
    }
    
    // Save to storage if enabled
    if (this.config.persistToStorage) {
      this.saveToStorage();
    }
    
    // Log to browser console
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const logText = `[${timestamp}] [${message.level}] [${message.category}]:`;
    
    // Colors for console logs
    const levelColors = {
      [LogLevel.DEBUG]: 'color: #4CAF50', // Green
      [LogLevel.INFO]: 'color: #2196F3',  // Blue
      [LogLevel.WARN]: 'color: #FF9800',  // Orange
      [LogLevel.ERROR]: 'color: #F44336', // Red
      [LogLevel.FATAL]: 'color: #9C27B0; font-weight: bold'  // Purple bold
    };
    
    const levelStyle = levelColors[message.level] || '';
    
    switch (message.level) {
      case LogLevel.DEBUG:
        console.debug(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
        break;
      case LogLevel.INFO:
        console.info(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
        break;
      case LogLevel.FATAL:
        console.error(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
        break;
      default:
        console.log(`%c${logText}%c ${message.message}`, levelStyle, 'color: inherit', message.data || '');
    }
    
    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(message);
      } catch (e) {
        console.error('Error in log subscriber:', e);
      }
    }
  }

  /**
   * Get stack trace info to determine where the log was called from
   */
  private getCallerInfo(): string {
    try {
      const err = new Error();
      const stack = err.stack?.split('\n') || [];
      // The 4th line typically contains the caller info (after Error, getCallerInfo, log, and the log level method)
      const callerLine = stack[4] || '';
      const match = callerLine.match(/at\s+(.*)\s+\((.*):\d+:\d+\)/) || 
                    callerLine.match(/at\s+(.*):\d+:\d+/);
      
      if (match) {
        return match[1] || 'unknown';
      }
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Check if a category is enabled for logging
   */
  private isCategoryEnabled(category: LogCategory | string): boolean {
    return this.config.enabledCategories.has(category);
  }

  /**
   * Check if a log level is enabled
   */
  private isLevelEnabled(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Update logger configuration
   */
  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If we're changing persistence, save current state
    if (config.persistToStorage !== undefined && config.persistToStorage) {
      this.saveToStorage();
    }
  }

  /**
   * Get current logger configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Get all log messages in the history
   */
  public getLogHistory(): LogMessage[] {
    return [...this.logs];
  }

  /**
   * Clear all logs from the history
   */
  public clearLogs(): void {
    this.logs = [];
    if (this.config.persistToStorage) {
      this.saveToStorage();
    }
  }

  /**
   * Register a subscriber to be notified when new logs are added
   * Returns an unsubscribe function
   */
  public subscribe(callback: (message: LogMessage) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Persist logs to local storage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem('game-logs', JSON.stringify(this.logs));
      localStorage.setItem('game-logs-config', JSON.stringify({
        ...this.config,
        // Convert Set to array for storage
        enabledCategories: Array.from(this.config.enabledCategories)
      }));
    } catch (e) {
      console.error('Failed to save logs to storage:', e);
    }
  }

  /**
   * Load logs from local storage
   */
  private loadFromStorage(): void {
    try {
      // Load logs
      const savedLogs = localStorage.getItem('game-logs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
      }
      
      // Load config
      const savedConfig = localStorage.getItem('game-logs-config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        // Convert array back to Set
        if (Array.isArray(parsedConfig.enabledCategories)) {
          parsedConfig.enabledCategories = new Set(parsedConfig.enabledCategories);
        }
        this.config = { ...this.config, ...parsedConfig };
      }
    } catch (e) {
      console.error('Failed to load logs from storage:', e);
    }
  }
}

// Create named exports for easier importing
export const logger = Logger.getInstance();

// Export types for convenience
export { LogLevel, LogCategory };
export type { LogMessage, LoggerConfig, LoggerInterface };

// Default export for backward compatibility
export default logger;
