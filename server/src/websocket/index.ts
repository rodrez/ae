import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import type { FastifyRedis } from "@fastify/redis";

interface GameClient {
	id: string;
	ws: WebSocket;
	characterId?: number;
	lastPing: number;
}

const clients = new Map<string, GameClient>();

// Redis pub/sub channels
const GAME_EVENTS = "game:events";
const PLAYER_UPDATES = "player:updates";
const WORLD_UPDATES = "world:updates";

export async function setupWebSocketHandlers(app: FastifyInstance) {
	app.log.info("Starting WebSocket setup...");
	
	// Wait for Redis to be ready
	app.log.info("Waiting for app to be ready...");
	await app.ready();
	app.log.info("App ready, proceeding with WebSocket setup");

	// Retry Redis connection
	let retries = 0;
	const maxRetries = 5;
	let redis: FastifyRedis | null = null;
	
	app.log.info("Attempting to connect to Redis for WebSocket...");
	while (retries < maxRetries) {
		try {
			redis = app.redis;
			if (redis) {
				// Test the connection
				app.log.info("Testing Redis connection with PING...");
				await redis.ping();
				app.log.info("Redis PING successful");
				break;
			}
			throw new Error("Redis not initialized");
		} catch (error) {
			retries++;
			app.log.warn(`Redis connection attempt ${retries}/${maxRetries} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			if (retries === maxRetries) {
				const errorMsg = `Failed to connect to Redis after ${maxRetries} attempts`;
				app.log.error(errorMsg);
				throw new Error(errorMsg);
			}
			app.log.info('Waiting 1 second before retrying...');
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}

	if (!redis) {
		const errorMsg = "Redis connection failed";
		app.log.error(errorMsg);
		throw new Error(errorMsg);
	}

	// Subscribe to Redis channels
	app.log.info(`Subscribing to Redis channels: ${GAME_EVENTS}, ${PLAYER_UPDATES}, ${WORLD_UPDATES}`);
	const subscriber = redis.duplicate();
	await subscriber.subscribe(GAME_EVENTS, PLAYER_UPDATES, WORLD_UPDATES);
	app.log.info("Successfully subscribed to Redis channels");

	subscriber.on("message", (channel: string, message: string) => {
		app.log.debug(`Received message on channel ${channel}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
		// Broadcast to all connected clients
		broadcastMessage(channel, message);
	});

	app.log.info("Registering WebSocket route at /ws");
	app.get("/ws", { websocket: true }, (connection, req) => {
		const clientId = req.headers["x-client-id"] as string || Math.random().toString(36).substring(7);
		app.log.info(`New WebSocket connection: ${clientId}`);
		
		const client: GameClient = {
			id: clientId,
			ws: connection.socket,
			lastPing: Date.now(),
		};

		clients.set(clientId, client);
		app.log.info(`Active connections: ${clients.size}`);

		connection.socket.on("message", async (message: Buffer) => {
			try {
				const data = JSON.parse(message.toString());
				app.log.debug(`Received message from client ${clientId}: ${JSON.stringify(data).substring(0, 100)}`);
				await handleClientMessage(client, data, app);
			} catch (error) {
				app.log.error(`Error handling message from ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				connection.socket.send(JSON.stringify({ error: "Invalid message format" }));
			}
		});

		connection.socket.on("close", () => {
			app.log.info(`WebSocket connection closed: ${clientId}`);
			handleClientDisconnect(client);
			clients.delete(clientId);
			app.log.info(`Active connections: ${clients.size}`);
		});

		// Send initial state
		app.log.debug(`Sending initial state to client ${clientId}`);
		void sendInitialState(client);
	});

	// Setup periodic ping to keep connections alive
	app.log.info("Setting up periodic ping for WebSocket connections");
	setInterval(() => {
		const now = Date.now();
		let activeCount = 0;
		let terminatedCount = 0;
		
		for (const client of clients.values()) {
			if (now - client.lastPing > 30000) {
				// Client hasn't responded for 30 seconds
				app.log.info(`Terminating inactive connection: ${client.id}`);
				client.ws.terminate();
				clients.delete(client.id);
				terminatedCount++;
			} else {
				client.ws.ping();
				activeCount++;
			}
		}
		
		if (clients.size > 0) {
			app.log.info(`Ping status: ${activeCount} active, ${terminatedCount} terminated`);
		}
	}, 15000);
	
	app.log.info("WebSocket setup complete");
}

interface GameMessage {
	type: "pong" | "move" | "action";
	data?: unknown;
}

async function handleClientMessage(
	client: GameClient,
	message: GameMessage,
	app: FastifyInstance,
) {
	const { type, data } = message;

	switch (type) {
		case "pong":
			client.lastPing = Date.now();
			break;

		case "move":
			// Validate and broadcast player movement
			if (client.characterId) {
				await app.redis?.publish(
					PLAYER_UPDATES,
					JSON.stringify({
						type: "move",
						characterId: client.characterId,
						position: data,
					}),
				);
			}
			break;

		case "action":
			// Handle player actions (combat, interaction, etc.)
			if (client.characterId) {
				await app.redis?.publish(
					GAME_EVENTS,
					JSON.stringify({
						type: "action",
						characterId: client.characterId,
						action: data,
					}),
				);
			}
			break;

		default:
			client.ws.send(JSON.stringify({ error: "Unknown message type" }));
	}
}

function handleClientDisconnect(client: GameClient) {
	// Cleanup and notify other players
	if (client.characterId) {
		broadcastMessage(
			PLAYER_UPDATES,
			JSON.stringify({
				type: "disconnect",
				characterId: client.characterId,
			}),
		);
	}
}

function broadcastMessage(channel: string, message: string) {
	for (const client of clients.values()) {
		if (client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(message);
		}
	}
}

async function sendInitialState(client: GameClient) {
	// Send current world state, nearby players, etc.
	const initialState = {
		type: "init",
		timestamp: Date.now(),
		// Add more initial state data as needed
	};

	client.ws.send(JSON.stringify(initialState));
}
