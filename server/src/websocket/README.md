# WebSocket API Documentation

This document describes the WebSocket API for the Alternate Earth MMO game server.

## Connecting to the Server

Connect to the WebSocket server using socket.io client:

```javascript
import { io } from 'socket.io-client';

const socket = io('https://your-server-url', {
  query: {
    clientId: 'optional-custom-client-id', // If omitted, server will generate one
  },
  transports: ['websocket'],
  autoConnect: true
});
```

## Authentication Flow

1. When you first connect, you'll receive a `connected` event
2. Authenticate by sending a `connect_game` event with character information
3. After authentication, you'll receive initial game state

```javascript
// Listen for connection confirmation
socket.on('connected', (data) => {
  console.log('Connected to server', data);
  
  // Authenticate with character data
  socket.emit('connect_game', {
    characterId: 12345,
    characterName: 'PlayerName',
    token: 'authentication-token'  // If your server requires it
  });
});

// Listen for initial game state
socket.on('game_state', (data) => {
  if (data.type === 'initial_state') {
    console.log('Received initial state', data);
  } else if (data.type === 'world_state') {
    console.log('Received world state with nearby players', data);
  }
});
```

## Core Events

### Client → Server

| Event | Description | Data Structure |
|-------|-------------|----------------|
| `connect_game` | Authenticate and join the game | `{ characterId, characterName, token }` |
| `ping` | Keep connection alive and measure latency | `{ timestamp }` |
| `move` | Update player position | `{ position: { x, y, z, rotation }, velocity: { x, y, z }, animation }` |
| `action` | Perform game action | `{ type, targetId, parameters }` |
| `chat` | Send chat message | `{ message, channel }` |
| `test` | Test the connection | Any data |
| `logout` | Explicitly disconnect | None |

### Server → Client

| Event | Description | Data Structure |
|-------|-------------|----------------|
| `connected` | Initial connection established | `{ message, timestamp, clientId, activeConnections }` |
| `pong` | Response to ping | `{ timestamp, serverTime, clientId, latency }` |
| `game_state` | Game state updates | Various, see below |
| `move` | Player movement updates | `{ characterId, position, velocity, animation, timestamp }` |
| `action` | Game action notifications | `{ characterId, actionType, targetId, parameters, timestamp }` |
| `chat` | Chat messages | `{ characterId, message, channel, timestamp }` |
| `error` | Error notifications | `{ code, message, type }` |
| `test_response` | Test response | `{ echo, timestamp, clientId }` |

## Game State Updates

The server sends game state in two main formats:

1. **Initial State**:
```json
{
  "type": "initial_state",
  "timestamp": 1621234567890,
  "gameTime": "2023-04-01T12:34:56.789Z",
  "clientId": "client-123",
  "players": {
    "count": 42,
    "nearby": []
  }
}
```

2. **World State**:
```json
{
  "type": "world_state",
  "playerData": {
    "characterId": 12345,
    "position": { "x": 100, "y": 200, "z": 0 },
    "stats": { /* player stats */ }
  },
  "nearbyPlayers": [
    {
      "characterId": 54321,
      "position": { "x": 120, "y": 180, "z": 0 }
    }
  ],
  "timestamp": 1621234567890
}
```

## Movement Updates

Send player movement with:

```javascript
socket.emit('move', {
  position: { x: 100, y: 200, z: 0, rotation: 1.5 },
  velocity: { x: 1, y: 0, z: 0 },
  animation: 'run'
});
```

Receive other players' movements:

```javascript
socket.on('move', (data) => {
  console.log(`Player ${data.characterId} moved to`, data.position);
});
```

## Player Actions

Send actions with:

```javascript
socket.emit('action', {
  type: 'attack',
  targetId: 54321,
  parameters: {
    weapon: 'sword',
    strength: 10
  }
});
```

## Chat System

Send chat messages:

```javascript
socket.emit('chat', {
  message: 'Hello, world!',
  channel: 'global'  // Optional, defaults to area-based chat
});
```

Receive chat messages:

```javascript
socket.on('chat', (data) => {
  console.log(`${data.characterId}: ${data.message}`);
});
```

## Error Handling

Listen for server error messages:

```javascript
socket.on('error', (data) => {
  console.error(`Error: ${data.code} - ${data.message}`);
  
  // Handle specific errors
  if (data.code === 'RATE_LIMIT') {
    console.warn('Sending too many messages, slowing down');
  } else if (data.code === 'NOT_AUTHENTICATED') {
    // Trigger reauthentication
  }
});
```

## Rate Limiting

The server enforces rate limits to prevent spam:
- Movement: 20 messages per second
- Actions: 5 messages per second
- Chat: 3 messages per 5 seconds

If you exceed these limits, you'll receive an error event with code `RATE_LIMIT`.

## Connection Maintenance

The server expects regular activity. Send ping messages to keep your connection alive:

```javascript
// Set up regular ping (every 10 seconds)
setInterval(() => {
  socket.emit('ping', { timestamp: Date.now() });
}, 10000);

// Listen for pong responses to calculate latency
socket.on('pong', (data) => {
  const latency = Date.now() - data.timestamp;
  console.log(`Current latency: ${latency}ms`);
});
```

Connections inactive for 30 seconds will be automatically terminated. 