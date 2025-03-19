import type { Server, Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

// Types for better structure and type safety
type Position = {
	x: number;
	y: number;
	z?: number;
	rotation?: number;
};

type GridCell = string; // Format: "x:y"

type Vector = {
	x: number;
	y: number;
	z?: number;
};

type Region = {
	id: string;
	name: string;
	maxPlayers: number;
};

interface Logger {
	info: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
	debug: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
}

// Client structure
interface GameClient {
	id: string;
	socket: Socket;
	characterId?: number;
	lastActivity: number;
	position?: Position;
	currentRegion?: string;
	currentCell?: GridCell;
	lastMessageTimestamps: Record<string, number>;
	messageCount: Record<string, number>;
	isAuthenticated: boolean;
}

// Server statistics
interface ServerStats {
	totalConnections: number;
	authenticatedConnections: number;
	messagesSent: number;
	messagesReceived: number;
	activeRegions: Map<string, number>;
	activeCells: Map<string, number>;
	lastUpdated: number;
	activeCellList?: string[]; // Added for the minimap display
}

// Message types
interface GameMessage {
	type: string;
	data?: Record<string, unknown>;
	clientId?: string;
	timestamp?: number;
}

interface MovementData {
	position: Position;
	velocity?: Vector;
	animation?: string;
}

interface ActionData {
	type: string;
	targetId?: number;
	parameters?: Record<string, unknown>;
}

interface PingData {
	timestamp?: number;
}

interface ConnectData {
	characterId?: number;
	characterName?: string;
	token?: string;
}

// Add more channels for our world events
const GAME_EVENTS = "game:events";
const PLAYER_UPDATES = "player:updates";
const WORLD_UPDATES = "world:updates";
const SERVER_STATS = "server:stats";
const REGION_PREFIX = "region:";
const GRID_PREFIX = "grid:";
const WORLD_STATE = "world:state"; // New channel for world state updates

// Configuration
const CONFIG = {
	INACTIVE_TIMEOUT: 30000, // 30 seconds
	GRID_SIZE: 100, // World divided into 100x100 unit cells
	MESSAGE_RATE_LIMIT: {
		move: { max: 20, window: 1000 }, // 20 messages per second
		action: { max: 5, window: 1000 }, // 5 messages per second
		chat: { max: 3, window: 5000 },   // 3 messages per 5 seconds
	},
	BROADCAST_RADIUS: 1, // How many grid cells in each direction to broadcast to
	STATS_INTERVAL: 5000, // How often to broadcast server stats (5 seconds)
};

// Keep track of connected clients
const clients = new Map<string, GameClient>();

// Server statistics
const serverStats: ServerStats = {
	totalConnections: 0,
	authenticatedConnections: 0,
	messagesSent: 0,
	messagesReceived: 0,
	activeRegions: new Map<string, number>(),
	activeCells: new Map<string, number>(),
	lastUpdated: Date.now()
};

// Spatial partitioning - track which clients are in which grid cells
const grid = new Map<GridCell, Set<string>>();

// Types for world system
interface WorldPlayerState {
	id: string;
	name: string;
	position: Position;
	lastUpdate: number;
}

interface WorldState {
	players: Record<string, WorldPlayerState>;
	timestamp: number;
}

// Track players in the world
const worldState: WorldState = {
	players: {},
	timestamp: Date.now()
};

/**
 * Calculate grid cell from position
 */
function getGridCell(position: Position): GridCell {
	const cellX = Math.floor(position.x / CONFIG.GRID_SIZE);
	const cellY = Math.floor(position.y / CONFIG.GRID_SIZE);
	return `${cellX}:${cellY}`;
}

/**
 * Get neighboring cells around a grid cell
 */
function getNeighboringCells(cell: GridCell, radius = CONFIG.BROADCAST_RADIUS): GridCell[] {
	const [cellX, cellY] = cell.split(':').map(Number);
	const neighbors: GridCell[] = [];
	
	for (let x = cellX - radius; x <= cellX + radius; x++) {
		for (let y = cellY - radius; y <= cellY + radius; y++) {
			neighbors.push(`${x}:${y}`);
		}
	}
	
	return neighbors;
}

/**
 * Check if a client is rate limited for a specific message type
 */
function isRateLimited(client: GameClient, messageType: string): boolean {
	const now = Date.now();
	const limits = CONFIG.MESSAGE_RATE_LIMIT[messageType as keyof typeof CONFIG.MESSAGE_RATE_LIMIT];
	
	if (!limits) return false;
	
	if (!client.lastMessageTimestamps[messageType]) {
		client.lastMessageTimestamps[messageType] = now;
		client.messageCount[messageType] = 1;
		return false;
	}
	
	const timeSinceWindow = now - client.lastMessageTimestamps[messageType];
	
	if (timeSinceWindow > limits.window) {
		// Reset the window
		client.lastMessageTimestamps[messageType] = now;
		client.messageCount[messageType] = 1;
		return false;
	}
	
	if (client.messageCount[messageType] >= limits.max) {
		return true;
	}
	
	// Increment count
	client.messageCount[messageType]++;
	return false;
}

/**
 * Update server statistics
 */
function updateServerStats(): void {
	// Count authenticated connections
	serverStats.totalConnections = clients.size;
	
	let authenticatedCount = 0;
	const regionCounts = new Map<string, number>();
	const cellCounts = new Map<string, number>();
	
	for (const client of clients.values()) {
		if (client.isAuthenticated) {
			authenticatedCount++;
			
			// Count by region
			if (client.currentRegion) {
				const regionCount = regionCounts.get(client.currentRegion) || 0;
				regionCounts.set(client.currentRegion, regionCount + 1);
			}
			
			// Count by cell
			if (client.currentCell) {
				const cellCount = cellCounts.get(client.currentCell) || 0;
				cellCounts.set(client.currentCell, cellCount + 1);
			}
		}
	}
	
	serverStats.authenticatedConnections = authenticatedCount;
	serverStats.activeRegions = regionCounts;
	serverStats.activeCells = cellCounts;
	serverStats.lastUpdated = Date.now();
}

/**
 * Broadcast server stats to all clients and Redis
 */
async function broadcastServerStats(io: Server, redisPub: Redis, logger: Logger): Promise<void> {
	updateServerStats();
	
	// Convert Map to array for the monitor
	const activeCellList = Array.from(serverStats.activeCells.keys());
	
	io.to('monitor').emit('server_stats', {
		type: 'server_stats',
		timestamp: Date.now(),
		totalConnections: serverStats.totalConnections,
		authenticatedConnections: serverStats.authenticatedConnections,
		messagesSent: serverStats.messagesSent,
		messagesReceived: serverStats.messagesReceived,
		activeRegions: Object.fromEntries(serverStats.activeRegions),
		activeCells: Object.fromEntries(serverStats.activeCells),
		activeCellList // Send the list format for easier display
	});
	
	// Publish to Redis for other services
	await redisPub.publish(
		SERVER_STATS,
		JSON.stringify({
			totalConnections: serverStats.totalConnections,
			authenticatedConnections: serverStats.authenticatedConnections,
			messagesSent: serverStats.messagesSent,
			messagesReceived: serverStats.messagesReceived,
			activeRegions: Object.fromEntries(serverStats.activeRegions),
			activeCells: Object.fromEntries(serverStats.activeCells),
			activeCellList,
			timestamp: Date.now()
		})
	);
	
	logger.debug(`Broadcast server stats: ${serverStats.totalConnections} total, ${serverStats.authenticatedConnections} authenticated`);
}

/**
 * Track message counts
 */
function trackMessageSent(): void {
	serverStats.messagesSent++;
}

function trackMessageReceived(): void {
	serverStats.messagesReceived++;
}

/**
 * Update client's position in the spatial grid
 */
function updateClientGrid(client: GameClient, position: Position, logger: Logger): void {
	if (!position) return;
	
	const newCell = getGridCell(position);
	
	// Update client position
	client.position = position;
	
	// If client is already in this cell, no need to update
	if (client.currentCell === newCell) return;
	
	// Remove from old cell
	if (client.currentCell && grid.has(client.currentCell)) {
		const cellClients = grid.get(client.currentCell);
		if (cellClients) {
			cellClients.delete(client.id);
			if (cellClients.size === 0) {
				grid.delete(client.currentCell);
			}
		}
	}
	
	// Add to new cell
	if (!grid.has(newCell)) {
		grid.set(newCell, new Set<string>());
	}
	
	grid.get(newCell)?.add(client.id);
	client.currentCell = newCell;
	
	logger.debug(`Client ${client.id} moved to grid cell ${newCell}`);
	
	// Join socket rooms for this cell and neighbors
	const socket = client.socket;
	
	// Leave old cell rooms if needed
	if (client.currentCell && client.currentCell !== newCell) {
		socket.leave(`${GRID_PREFIX}${client.currentCell}`);
	}
	
	// Join new cell room
	socket.join(`${GRID_PREFIX}${newCell}`);
	
	// Subscribe to neighboring cells
	const neighbors = getNeighboringCells(newCell);
	for (const cell of neighbors) {
		socket.join(`${GRID_PREFIX}${cell}`);
	}
}

/**
 * Setup Socket.io handlers for the game server
 */
export function setupSocketHandlers(
	io: Server,
	redis: Redis
) {
	// Create Redis pub/sub clients for Socket.io
	const redisPub = redis;
	const redisSub = redis.duplicate();

	// Set up logger
	const logger = {
		info: (...args: unknown[]) => console.log(new Date().toISOString(), "[SOCKET:INFO]", ...args),
		error: (...args: unknown[]) => console.error(new Date().toISOString(), "[SOCKET:ERROR]", ...args),
		debug: (...args: unknown[]) => {
			if (process.env.DEBUG === 'true') {
				console.debug(new Date().toISOString(), "[SOCKET:DEBUG]", ...args)
			}
		},
		warn: (...args: unknown[]) => console.warn(new Date().toISOString(), "[SOCKET:WARN]", ...args),
	};

	// Setup Redis adapter for Socket.io
	io.adapter(createAdapter(redisPub, redisSub));

	// Subscribe to Redis channels for broadcasts
	redisSub.subscribe(GAME_EVENTS, PLAYER_UPDATES, WORLD_UPDATES, SERVER_STATS);
	logger.info(`Subscribed to Redis channels: ${GAME_EVENTS}, ${PLAYER_UPDATES}, ${WORLD_UPDATES}, ${SERVER_STATS}`);

	// Handle Redis messages and broadcast to clients
	redisSub.on('message', (channel: string, message: string) => {
		logger.debug(`Received message on channel ${channel}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
		trackMessageReceived();
		
		try {
			const data = JSON.parse(message);
			
			// If message has grid cell info, only broadcast to that cell
			if (data.gridCell) {
				io.to(`${GRID_PREFIX}${data.gridCell}`).emit(data.type, data);
				trackMessageSent();
				return;
			}
			
			// If message has region info, only broadcast to that region
			if (data.regionId) {
				io.to(`${REGION_PREFIX}${data.regionId}`).emit(data.type, data);
				trackMessageSent();
				return;
			}
			
			// Broadcast to all clients in the appropriate channel
			io.to(channel).emit(data.type, data);
			trackMessageSent();
		} catch (error) {
			logger.error(`Error broadcasting Redis message: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Handle Redis messages from other instances
	redisSub.on('message', (channel, message) => {
		try {
			if (channel === WORLD_UPDATES) {
				const data = JSON.parse(message);
				
				// Handle player join
				if (data.type === 'player_join' && data.player) {
					if (!worldState.players[data.player.id]) {
						worldState.players[data.player.id] = data.player;
						worldState.timestamp = Date.now();
						
						// Broadcast to clients
						io.to(WORLD_STATE).emit('player_join', data.player);
						trackMessageSent();
					}
				}
				// Handle player move
				else if (data.type === 'player_move' && data.id && data.position) {
					if (worldState.players[data.id]) {
						// Only accept newer updates
						if (!data.timestamp || data.timestamp >= worldState.players[data.id].lastUpdate) {
							worldState.players[data.id].position = data.position;
							worldState.players[data.id].lastUpdate = data.timestamp || Date.now();
							
							// Only broadcast to clients in relevant cells
							const cell = getGridCell(data.position);
							const neighborCells = getNeighboringCells(cell);
							
							for (const neighborCell of neighborCells) {
								io.to(`${GRID_PREFIX}${neighborCell}`).emit('player_move', {
									id: data.id,
									position: data.position,
									timestamp: data.timestamp
								});
							}
							trackMessageSent();
						}
					}
				}
				// Handle player leave
				else if (data.type === 'player_leave' && data.id) {
					if (worldState.players[data.id]) {
						delete worldState.players[data.id];
						worldState.timestamp = Date.now();
						
						// Broadcast to clients
						io.to(WORLD_STATE).emit('player_leave', { id: data.id });
						trackMessageSent();
					}
				}
				// Handle full world state update
				else if (data.type === 'world_update' && data.state) {
					// Merge the received state with our local state
					const receivedState = data.state as WorldState;
					
					if (receivedState.timestamp > worldState.timestamp) {
						// Only adopt newer state
						for (const [playerId, playerData] of Object.entries(receivedState.players)) {
							// Only update if we don't have this player or if their update is newer
							if (!worldState.players[playerId] || 
								playerData.lastUpdate > worldState.players[playerId].lastUpdate) {
								worldState.players[playerId] = playerData;
							}
						}
						
						// Timestamp of our state is the latest we processed
						worldState.timestamp = Date.now();
					}
				}
			}
			// ... handle other channels ...
		} catch (error) {
			logger.error(`Error handling Redis message: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Socket.io connection handling
	io.on('connection', (socket: Socket) => {
		const clientId = socket.handshake.query.clientId as string || socket.id;
		
		logger.info(`New Socket.io connection: ${clientId} from ${socket.handshake.address}`);
		
		// Create client object with rate limiting setup
		const client: GameClient = {
			id: clientId,
			socket,
			lastActivity: Date.now(),
			lastMessageTimestamps: {},
			messageCount: {},
			isAuthenticated: false
		};
		
		// Store client in our map
		clients.set(clientId, client);
		
		// Update statistics
		updateServerStats();
		logger.info(`Active connections: ${serverStats.totalConnections}`);
		
		// Send welcome message with current stats
		socket.emit('connected', {
			message: 'Connected to game server. Authentication required.',
			timestamp: Date.now(),
			clientId,
			activeConnections: serverStats.totalConnections,
			authenticatedPlayers: serverStats.authenticatedConnections
		});
		trackMessageSent();
		
		// Join the global broadcast channels
		socket.join([GAME_EVENTS, WORLD_UPDATES, SERVER_STATS, WORLD_STATE]);
		
		// Handle connect message (typically sent after authentication)
		socket.on('connect_game', async (data: ConnectData) => {
			trackMessageReceived();
			logger.info(`Client ${clientId} confirming connection`);
			client.lastActivity = Date.now();
			
			// If character ID provided, associate it with this client
			if (data?.characterId) {
				client.characterId = data.characterId;
				client.isAuthenticated = true;
				logger.info(`Client ${clientId} associated with character ${client.characterId}`);
				
				// Join rooms specific to this character
				socket.join([
					PLAYER_UPDATES,
					`character:${client.characterId}`
				]);
				
				// Update server stats now that we have a new authenticated client
				updateServerStats();
				
				// Notify other servers/clients this player is online
				await redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'player_connected',
						characterId: client.characterId,
						characterName: data.characterName,
						timestamp: Date.now(),
						totalConnections: serverStats.totalConnections,
						authenticatedConnections: serverStats.authenticatedConnections
					})
				);
				trackMessageSent();
				
				// Broadcast updated stats immediately
				await broadcastServerStats(io, redisPub, logger);
			}
			
			// Send game state
			sendInitialState(client, socket, redisPub, logger);
		});
		
		// Handle ping/heartbeat
		socket.on('ping', (data: PingData) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Send back a pong with the same timestamp if provided
			const timestamp = data?.timestamp ?? Date.now();
			
			socket.emit('pong', {
				timestamp,
				serverTime: Date.now(),
				clientId,
				latency: data?.timestamp ? Date.now() - data.timestamp : undefined
			});
			trackMessageSent();
		});
		
		// Handle movement updates
		socket.on('move', async (data: MovementData) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Rate limit movement messages
			if (isRateLimited(client, 'move')) {
				socket.emit('error', {
					code: 'RATE_LIMIT',
					message: 'Too many movement updates. Slow down.',
					type: 'move'
				});
				trackMessageSent();
				return;
			}
			
			if (!client.characterId || !client.isAuthenticated) {
				socket.emit('error', {
					code: 'NOT_AUTHENTICATED',
					message: 'You must authenticate first'
				});
				trackMessageSent();
				return;
			}
			
			// Update client's position in our spatial grid
			updateClientGrid(client, data.position, logger);
			
			// Publish to Redis for other servers to broadcast
			await redisPub.publish(
				PLAYER_UPDATES,
				JSON.stringify({
					type: 'move',
					characterId: client.characterId,
					position: data.position,
					velocity: data.velocity,
					animation: data.animation,
					gridCell: client.currentCell,
					timestamp: Date.now()
				})
			);
			trackMessageSent();
		});
		
		// Handle joining the world
		socket.on('join_world', async (playerData: WorldPlayerState) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			if (!playerData.id) {
				socket.emit('error', {
					code: 'INVALID_DATA',
					message: 'Player ID is required to join the world'
				});
				trackMessageSent();
				return;
			}
			
			try {
				logger.info(`Player ${playerData.id} (${playerData.name}) joined the world`);
				
				// Store player data
				worldState.players[playerData.id] = {
					...playerData,
					lastUpdate: Date.now()
				};
				
				// Update world state timestamp
				worldState.timestamp = Date.now();
				
				// Set client position for spatial partitioning
				client.position = playerData.position;
				updateClientGrid(client, playerData.position, logger);
				
				// Add an initial position to the grid
				if (playerData.position) {
					updateClientGrid(client, playerData.position, logger);
				}
				
				// Broadcast to all clients that a new player joined
				io.to(WORLD_STATE).emit('player_join', worldState.players[playerData.id]);
				trackMessageSent();
				
				// Send the current world state to the joining player
				socket.emit('world_update', worldState);
				trackMessageSent();
				
				// Publish to Redis for other servers
				await redisPub.publish(
					WORLD_UPDATES,
					JSON.stringify({
						type: 'player_join',
						player: worldState.players[playerData.id],
						timestamp: Date.now()
					})
				);
			} catch (error) {
				logger.error(`Error processing join_world: ${error instanceof Error ? error.message : 'Unknown error'}`);
				socket.emit('error', {
					code: 'JOIN_FAILED',
					message: 'Failed to join the world'
				});
				trackMessageSent();
			}
		});
		
		// Handle player movement in the world
		socket.on('player_move', async (data: { id: string; position: Position; timestamp: number }) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Rate limit movement messages
			if (isRateLimited(client, 'move')) {
				socket.emit('error', {
					code: 'RATE_LIMIT',
					message: 'Too many movement updates. Slow down.'
				});
				trackMessageSent();
				return;
			}
			
			if (!data.id || !data.position) {
				return;
			}
			
			try {
				// Only update if player exists in world state
				if (worldState.players[data.id]) {
					// Only accept newer updates
					if (!data.timestamp || data.timestamp >= worldState.players[data.id].lastUpdate) {
						// Update position and timestamp
						worldState.players[data.id].position = data.position;
						worldState.players[data.id].lastUpdate = data.timestamp || Date.now();
						worldState.timestamp = Date.now();
						
						// Update client position for spatial grid
						client.position = data.position;
						updateClientGrid(client, data.position, logger);
						
						// Broadcast to nearby players only
						if (client.currentCell) {
							const neighborCells = getNeighboringCells(client.currentCell);
							
							// Broadcast to each nearby cell
							for (const cell of neighborCells) {
								io.to(`${GRID_PREFIX}${cell}`).emit('player_move', {
									id: data.id,
									position: data.position,
									timestamp: data.timestamp || Date.now()
								});
							}
							trackMessageSent();
						}
						
						// Publish to Redis every few updates
						if (data.id && Math.random() < 0.2) { // 20% chance to sync with other servers
							await redisPub.publish(
								WORLD_UPDATES,
								JSON.stringify({
									type: 'player_move',
									id: data.id,
									position: data.position,
									timestamp: data.timestamp || Date.now()
								})
							);
						}
					}
				}
			} catch (error) {
				logger.error(`Error processing player_move: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});
		
		// Handle leaving the world
		socket.on('leave_world', async (data: { id: string }) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			if (!data.id) {
				return;
			}
			
			try {
				// Remove player from world state
				if (worldState.players[data.id]) {
					logger.info(`Player ${data.id} left the world`);
					
					// Remove from grid
					if (client.currentCell) {
						const cellPlayers = grid.get(client.currentCell);
						if (cellPlayers) {
							cellPlayers.delete(client.id);
							if (cellPlayers.size === 0) {
								grid.delete(client.currentCell);
							} else {
								grid.set(client.currentCell, cellPlayers);
							}
						}
						client.currentCell = undefined;
					}
					
					// Delete from world state
					delete worldState.players[data.id];
					worldState.timestamp = Date.now();
					
					// Broadcast to all clients
					io.to(WORLD_STATE).emit('player_leave', { id: data.id });
					trackMessageSent();
					
					// Publish to Redis for other servers
					await redisPub.publish(
						WORLD_UPDATES,
						JSON.stringify({
							type: 'player_leave',
							id: data.id,
							timestamp: Date.now()
						})
					);
				}
			} catch (error) {
				logger.error(`Error processing leave_world: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});
		
		// Handle player actions
		socket.on('action', async (data: ActionData) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Rate limit action messages
			if (isRateLimited(client, data.type)) {
				socket.emit('error', {
					code: 'RATE_LIMIT',
					message: `Too many ${data.type} actions. Slow down.`,
					type: data.type
				});
				trackMessageSent();
				return;
			}
			
			if (!client.characterId || !client.isAuthenticated) {
				socket.emit('error', {
					code: 'NOT_AUTHENTICATED',
					message: 'You must authenticate first'
				});
				trackMessageSent();
				return;
			}
			
			// Publish to Redis for other servers to broadcast
			await redisPub.publish(
				GAME_EVENTS,
				JSON.stringify({
					type: 'action',
					actionType: data.type,
					characterId: client.characterId,
					targetId: data.targetId,
					parameters: data.parameters,
					gridCell: client.currentCell,
					timestamp: Date.now()
				})
			);
			trackMessageSent();
		});
		
		// Handle chat messages
		socket.on('chat', async (data: {message: string, channel?: string}) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Rate limit chat messages
			if (isRateLimited(client, 'chat')) {
				socket.emit('error', {
					code: 'RATE_LIMIT',
					message: 'Too many chat messages. Slow down.',
					type: 'chat'
				});
				trackMessageSent();
				return;
			}
			
			if (!client.characterId || !client.isAuthenticated) {
				socket.emit('error', {
					code: 'NOT_AUTHENTICATED',
					message: 'You must authenticate first'
				});
				trackMessageSent();
				return;
			}
			
			// Determine chat channel
			const channel = data.channel || (client.currentCell ? `${GRID_PREFIX}${client.currentCell}` : 'global');
			
			// Publish to Redis for other servers to broadcast
			await redisPub.publish(
				channel,
				JSON.stringify({
					type: 'chat',
					characterId: client.characterId,
					message: data.message,
					channel: data.channel,
					gridCell: client.currentCell,
					timestamp: Date.now()
				})
			);
			trackMessageSent();
		});
		
		// Handle test messages
		socket.on('test', (data: Record<string, unknown>) => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			logger.debug(`Test message from ${clientId}:`, data);
			
			// Echo back the test message
			socket.emit('test_response', {
				echo: data,
				timestamp: Date.now(),
				clientId
			});
			trackMessageSent();
		});
		
		// Handle stats request
		socket.on('get_stats', () => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			
			// Update stats and send them to the requesting client
			updateServerStats();
			socket.emit('server_stats', {
				type: 'server_stats',
				timestamp: Date.now(),
				stats: {
					totalConnections: serverStats.totalConnections,
					authenticatedConnections: serverStats.authenticatedConnections,
					messagesSent: serverStats.messagesSent,
					messagesReceived: serverStats.messagesReceived,
					activeRegions: Object.fromEntries(serverStats.activeRegions),
					activeCells: Object.fromEntries(serverStats.activeCells),
					activeCellList: Array.from(serverStats.activeCells.keys()) // Send the list format for easier display
				}
			});
			trackMessageSent();
		});
		
		// Handle request_stats (new method with simplified response format)
		socket.on('request_stats', () => {
			trackMessageReceived();
			client.lastActivity = Date.now();
			logger.info(`Stats requested by client ${clientId}`);
			
			// Update stats and send them to the requesting client
			updateServerStats();
			
			// Convert Map to array for the monitor
			const activeCellList = Array.from(serverStats.activeCells.keys());
			
			socket.emit('server_stats', {
				totalConnections: serverStats.totalConnections,
				authenticatedConnections: serverStats.authenticatedConnections,
				messagesSent: serverStats.messagesSent,
				messagesReceived: serverStats.messagesReceived,
				activeCells: activeCellList // Send the array format for easier display on minimap
			});
			trackMessageSent();
		});
		
		// Handle disconnect
		socket.on('disconnect', async (reason: string) => {
			logger.info(`Client ${clientId} disconnected: ${reason}`);
			
			// If client had a character, notify other players
			if (client.characterId) {
				await redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'player_disconnected',
						characterId: client.characterId,
						gridCell: client.currentCell,
						reason,
						timestamp: Date.now()
					})
				);
				trackMessageSent();
				
				// Remove from grid
				if (client.currentCell && grid.has(client.currentCell)) {
					const cellClients = grid.get(client.currentCell);
					if (cellClients) {
						cellClients.delete(client.id);
						if (cellClients.size === 0) {
							grid.delete(client.currentCell);
						}
					}
				}
			}
			
			// Remove from clients map
			clients.delete(clientId);
			
			// Update server stats
			updateServerStats();
			logger.info(`Active connections: ${serverStats.totalConnections}, Characters online: ${serverStats.authenticatedConnections}`);
			
			// Broadcast updated stats immediately after disconnect
			await broadcastServerStats(io, redisPub, logger);
		});
		
		// Handle explicit logout
		socket.on('logout', async () => {
			trackMessageReceived();
			logger.info(`Client ${clientId} logging out`);
			
			// Similar cleanup as disconnect
			if (client.characterId) {
				await redisPub.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: 'player_disconnected',
						characterId: client.characterId,
						gridCell: client.currentCell,
						reason: 'logout',
						timestamp: Date.now()
					})
				);
				trackMessageSent();
				
				// Remove from grid
				if (client.currentCell && grid.has(client.currentCell)) {
					const cellClients = grid.get(client.currentCell);
					if (cellClients) {
						cellClients.delete(client.id);
						if (cellClients.size === 0) {
							grid.delete(client.currentCell);
						}
					}
				}
			}
			
			// Remove from clients map
			clients.delete(clientId);
			
			// Update server stats
			updateServerStats();
			logger.info(`Active connections: ${serverStats.totalConnections}, Characters online: ${serverStats.authenticatedConnections}`);
			
			// Broadcast updated stats immediately after logout
			await broadcastServerStats(io, redisPub, logger);
			
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
			if (now - client.lastActivity > CONFIG.INACTIVE_TIMEOUT) {
				// Client hasn't been active for the timeout period
				logger.info(`Terminating inactive connection: ${clientId}`);
				client.socket.disconnect(true);
				clients.delete(clientId);
				terminatedCount++;
			} else {
				activeCount++;
			}
		}
		
		if (clients.size > 0) {
			logger.debug(`Activity check: ${activeCount} active, ${terminatedCount} terminated`);
		}
		
		// If any clients were terminated, update and broadcast server stats
		if (terminatedCount > 0) {
			updateServerStats();
		}
	}, CONFIG.INACTIVE_TIMEOUT);
	
	// Setup periodic stats broadcasting
	setInterval(async () => {
		await broadcastServerStats(io, redisPub, logger);
	}, CONFIG.STATS_INTERVAL);
	
	// Add a function to broadcast world state
	async function broadcastWorldState(io: Server, redisPub: Redis, logger: Logger): Promise<void> {
		try {
			// Update timestamp
			worldState.timestamp = Date.now();
			
			// Broadcast to all clients
			io.to(WORLD_STATE).emit('world_update', worldState);
			trackMessageSent();
			
			// Publish to Redis for other servers
			await redisPub.publish(
				WORLD_UPDATES,
				JSON.stringify({
					type: 'world_update',
					state: worldState,
					timestamp: Date.now()
				})
			);
		} catch (error) {
			logger.error(`Error broadcasting world state: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Every 5 seconds, broadcast full world state
	setInterval(() => {
		broadcastWorldState(io, redisPub, logger).catch(error => 
			logger.error(`Failed to broadcast world state: ${error instanceof Error ? error.message : 'Unknown error'}`)
		);
	}, 5000);
	
	logger.info("Socket.io setup complete");
}

/**
 * Send initial game state to a newly connected client
 */
async function sendInitialState(
	client: GameClient,
	socket: Socket,
	redis: Redis,
	logger: Logger
) {
	try {
		// Update server stats before sending
		updateServerStats();
		
		// First, send basic connection info
		socket.emit('game_state', {
			type: 'initial_state',
			timestamp: Date.now(),
			gameTime: new Date().toISOString(),
			clientId: client.id,
			totalConnections: serverStats.totalConnections,
			authenticatedConnections: serverStats.authenticatedConnections,
			players: {
				count: serverStats.authenticatedConnections,
				nearby: []  // Will be populated below
			}
		});
		trackMessageSent();
		
		// If client has character ID, load additional data
		if (client.characterId) {
			// Attempt to fetch character data from Redis
			try {
				const characterData = await redis.get(`character:${client.characterId}`);
				if (characterData) {
					const parsedData = JSON.parse(characterData);
					
					// If character has position, update grid
					if (parsedData.position) {
						updateClientGrid(client, parsedData.position, logger);
						
						// Get nearby players
						const nearbyPlayers = [];
						if (client.currentCell) {
							const neighborCells = getNeighboringCells(client.currentCell);
							for (const cell of neighborCells) {
								const cellClients = grid.get(cell);
								if (cellClients) {
									for (const nearbyClientId of cellClients) {
										if (nearbyClientId === client.id) continue;
										
										const nearbyClient = clients.get(nearbyClientId);
										if (nearbyClient?.characterId && nearbyClient.position) {
											nearbyPlayers.push({
												characterId: nearbyClient.characterId,
												position: nearbyClient.position
											});
										}
									}
								}
							}
						}
						
						// Send additional state with nearby players
						socket.emit('game_state', {
							type: 'world_state',
							playerData: parsedData,
							nearbyPlayers,
							totalConnections: serverStats.totalConnections,
							authenticatedConnections: serverStats.authenticatedConnections,
							gridCell: client.currentCell,
							timestamp: Date.now()
						});
						trackMessageSent();
					}
				}
			} catch (error) {
				logger.error(`Error fetching character data: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
		
		logger.debug(`Sent initial state to client ${client.id}`);
	} catch (error) {
		logger.error(`Error sending initial state to client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
