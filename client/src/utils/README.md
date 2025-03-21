# Logger System

This directory contains a configurable logging system that allows for selective logging of different parts of the application.

## Features

- Category-based filtering
- Log level filtering (DEBUG, INFO, WARN, ERROR, FATAL)
- Visual logger panel for in-game debugging
- Persistent storage of logs
- Subscription system for real-time log monitoring

## Basic Usage

```typescript
import { logger, LogCategory } from './utils/logger';

// Basic logging
logger.debug(LogCategory.GAME, 'Debug message', { optional: 'data' });
logger.info(LogCategory.NETWORK, 'Info message', { user: 'id123' });
logger.warn(LogCategory.PHYSICS, 'Warning message');
logger.error(LogCategory.UI, 'Error message', { error: new Error('Something went wrong') });
logger.fatal(LogCategory.SYSTEM, 'Fatal error', { critical: true });

// Using category-specific loggers
import { createCategoryLogger } from './utils/logger';

const gameLogger = createCategoryLogger(LogCategory.GAME);
gameLogger.debug('Game debug message');
gameLogger.info('Game info message');
// No need to specify category each time
```

## Log Categories

The logger supports the following categories:

- `SYSTEM`: System-level logs
- `GAME`: General game logic
- `PHYSICS`: Physics engine and collision
- `NETWORK`: Network and multiplayer
- `INPUT`: User input and controls
- `RENDERING`: Graphics and rendering
- `AI`: Artificial intelligence
- `AUDIO`: Sound and music
- `UI`: User interface
- `PERFORMANCE`: Performance metrics
- `DATABASE`: Database operations
- `AUTH`: Authentication and authorization

## Visual Logger Panel

The logger comes with a visual panel for debugging in-game:

```typescript
import { LoggerPanel } from './ui/debug/logger-panel';

// In your Phaser scene:
create() {
  // Create logger panel
  this.loggerPanel = new LoggerPanel(this, 50, 50);
  
  // Show the panel
  this.loggerPanel.show();
  
  // Toggle visibility
  this.loggerPanel.toggle();
}
```

## Configuration

You can configure the logger behavior:

```typescript
import { logger, LogLevel } from './utils/logger';

// Configure logger
logger.setConfig({
  enabled: true,
  minLevel: LogLevel.INFO, // Only show INFO and above
  enabledCategories: new Set(['game', 'network']), // Only show these categories
  maxLogSize: 500, // Keep only the last 500 log entries
  persistToStorage: true // Save logs to localStorage
});
```

## Subscribing to Logs

You can subscribe to receive new log messages:

```typescript
const unsubscribe = logger.subscribe((logMessage) => {
  console.log('New log:', logMessage);
  // Do something with the log message
});

// Later, to unsubscribe:
unsubscribe();
```

## Log Message Format

Each log message has the following structure:

```typescript
interface LogMessage {
  timestamp: string;    // ISO timestamp
  level: LogLevel;      // DEBUG, INFO, WARN, ERROR, FATAL
  category: string;     // The log category
  message: string;      // The log message
  data?: unknown;       // Optional data
  source?: string;      // Source location (automatically added)
}
``` 