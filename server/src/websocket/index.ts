import { Server, Socket } from 'socket.io';
import { Redis } from 'ioredis';

// Client structure
interface GameClient {
	id: string;
	socket: Socket;
	characterId?: number;
	lastActivity: number;
}

// Message types
interface GameMessage {
	type: string;
	data?: any;
	clientId?: string;
	timestamp?: number;
}

// Redis pub/sub channels
const GAME_EVENTS = "game:events";
const PLAYER_UPDATES = "player:updates";
const WORLD_UPDATES = "world:updates";

// Keep track of connected clients
const clients = new Map<string, GameClient>();

/**
 * Setup Socket.io handlers for the game server
 */
export function setupSocketHandlers(
	io: Server,
	redisClient: Redis,
	redisPub: Redis,
	redisSub: Redis,
	logger: any
) {
	logger.info("Setting up Socket.io handlers...");

	// Subscribe to Redis channels for broadcasts
	redisSub.subscribe(GAME_EVENTS, PLAYER_UPDATES, WORLD_UPDATES);
	logger.info(`Subscribed to Redis channels: ${GAME_EVENTS}, ${PLAYER_UPDATES}, ${WORLD_UPDATES}`);

	// Handle Redis messages and broadcast to clients
	redisSub.on('message', (channel: string, message: string) => {
		logger.debug(`Received message on channel ${channel}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
		
		try {
			const data = JSON.parse(message);
			// Broadcast to all clients in the appropriate room
			io.to(channel).emit(data.type, data);
		} catch (error) {
			logger.error(`Error broadcasting Redis message: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Socket.io connection handling
	io.on('connection', (socket: Socket) => {
		const clientId = socket.handshake.query.clientId as string || socket.id;
		
		logger.info(`New Socket.io connection: ${clientId} from ${socket.handshake.address}`);
		
		// Create client object
		const client: GameClient = {
			id: clientId,
			socket,
			lastActivity: Date.now()
		};
		
		// Store client in our map
		clients.set(clientId, client);
		logger.info(`Active connections: ${clients.size}`);
		
		// Send welcome message
		socket.emit('connected', {
			message: 'Connected to game server. Authentication required.',
			timestamp: Date.now(),
			clientId,
			activeConnections: clients.size
		});
		
		// Join the global broadcast channels
		socket.join([GAME_EVENTS, PLAYER_UPDATES, WORLD_UPDATES]);
		
		// Handle connect message (typically sent after authentication)
		socket.on('connect_game', async (data: any) => {
			logger.info(`Client ${clientId} confirming connection`);
			client.lastActivity = Date.now();
			
			// If character ID provided, associate it with this client
			if (data && data.characterId) {
				client.characterId = data.characterId;
				logger.info(`Client ${clientId} associated with character ${client.characterId}`);
				
				// Join a room specific to this character
				socket.join(`character:${client.characterId}`);
			}
			
			// Send game state
			sendInitialState(client, socket, redisClient, logger);
		});
		
		// Handle ping/heartbeat
		socket.on('ping', (data: any) => {
			client.lastActivity = Date.now();
			
			// Send back a pong with the same timestamp if provided
			const timestamp = data && data.timestamp ? data.timestamp : Date.now();
			
			socket.emit('pong', {
				timestamp,
				serverTime: Date.now(),
				clientId
			});
		});
		
		// Handle movement updates
		socket.on('move', async (data: any) => {
			client.lastActivity = Date.now();
			
			if (client.characterId) {
				// Publish to Redis for other servers to broadcast
				await redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'move',
						characterId: client.characterId,
						position: data,
						timestamp: Date.now()
					})
				);
			}
		});
		
		// Handle player actions
		socket.on('action', async (data: any) => {
			client.lastActivity = Date.now();
			
			if (client.characterId) {
				await redisPub.publish(
					GAME_EVENTS,
					JSON.stringify({
						type: 'action',
						characterId: client.characterId,
						action: data,
						timestamp: Date.now()
					})
				);
			}
		});
		
		// Handle test messages
		socket.on('test', (data: any) => {
			client.lastActivity = Date.now();
			logger.debug(`Test message from ${clientId}:`, data);
			
			// Echo back the test message
			socket.emit('test_response', {
				echo: data,
				timestamp: Date.now(),
				clientId
			});
		});
		
		// Handle disconnect
		socket.on('disconnect', (reason: string) => {
			logger.info(`Client ${clientId} disconnected: ${reason}`);
			
			// If client had a character, notify other players
			if (client.characterId) {
				redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'disconnect',
						characterId: client.characterId,
						timestamp: Date.now()
					})
				);
			}
			
			// Remove from clients map
			clients.delete(clientId);
			logger.info(`Active connections: ${clients.size}`);
		});
		
		// Handle explicit logout
		socket.on('logout', async () => {
			logger.info(`Client ${clientId} logging out`);
			
			// Similar cleanup as disconnect
			if (client.characterId) {
				redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'disconnect',
						characterId: client.characterId,
						timestamp: Date.now()
					})
				);
			}
			
			// Remove from clients map
			clients.delete(clientId);
			
			// Close socket
			socket.disconnect(true);
		});
		
		// Handle errors
		socket.on('error', (error: Error) => {
			logger.error(`Socket error for client ${clientId}: ${error.message}`);
		});
	});
	
	// Setup periodic check for inactive clients
	setInterval(() => {
		const now = Date.now();
		let activeCount = 0;
		let terminatedCount = 0;
		
		for (const [clientId, client] of clients.entries()) {
			if (now - client.lastActivity > 30000) {
				// Client hasn't been active for 30 seconds
				logger.info(`Terminating inactive connection: ${clientId}`);
				client.socket.disconnect(true);
				clients.delete(clientId);
				terminatedCount++;
			} else {
				activeCount++;
			}
		}
		
		if (clients.size > 0) {
			logger.info(`Activity check: ${activeCount} active, ${terminatedCount} terminated`);
		}
	}, 30000);
	
	logger.info("Socket.io setup complete");
}

/**
 * Send initial game state to a newly connected client
 */
async function sendInitialState(
	client: GameClient,
	socket: Socket,
	redis: Redis,
	logger: any
) {
	try {
		// For now, just send a simple message
		// In a real implementation, you would load game state from Redis/DB
		socket.emit('game_state', {
			type: 'initial_state',
			timestamp: Date.now(),
			gameTime: new Date().toISOString(),
			clientId: client.id,
			players: {
				count: clients.size,
				nearby: []  // Would be populated with actual nearby players
			}
		});
		
		logger.debug(`Sent initial state to client ${client.id}`);
	} catch (error) {
		logger.error(`Error sending initial state to client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
