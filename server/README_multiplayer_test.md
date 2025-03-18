# Alternate Earth MMO Multiplayer Test Script

This Python script helps you test the multiplayer functionality of the Alternate Earth MMO server by simulating multiple players connecting and interacting with the game world.

## Features

- Simulates multiple players simultaneously using threads
- Automatically registers users, creates characters, and enters the game
- Players move around and check for nearby players
- Configurable number of players, duration, and server URL
- Handles player lifecycle (registration, character creation, movement, exit)
- **Robust error handling** with automatic retries and graceful degradation
- **Server health checks** to verify server is running properly before testing
- **Dynamic backoff** when server is struggling
- **Detailed logging** with configurable log levels
- **Thread safety** improvements with staggered starts and jitter

## Requirements

- Python 3.6+
- `requests` library

## Installation

Make sure you have Python installed and the required dependencies:

```bash
pip install requests
```

## Usage

Run the script with default settings (2 players for 60 seconds):

```bash
cd server/tests
./test_multiplayer.py
```

### Command Line Options

- `--players N`: Simulate N players (default: 2)
- `--duration N`: Run simulation for N seconds (default: 60)
- `--server URL`: Connect to a specific server URL (default: http://localhost:3000)
- `--log-level LEVEL`: Set logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `--skip-health-check`: Skip initial server health check
- `--max-retries N`: Maximum number of request retries (default: 3)

Examples:

```bash
# Simulate 5 players for 2 minutes
./test_multiplayer.py --players 5 --duration 120

# Connect to a remote server with more detailed logging
./test_multiplayer.py --server http://game-server.example.com:3000 --log-level DEBUG

# Skip health check and use more aggressive retries
./test_multiplayer.py --skip-health-check --max-retries 5
```

## Error Handling Features

The script includes several error handling mechanisms:

1. **Automatic retries** for failed requests with exponential backoff
2. **Connection timeouts** to prevent hanging on unresponsive servers
3. **Graceful degradation** with increased intervals when consistent failures occur
4. **Automatic re-authentication** when token issues are detected
5. **Circuit breaker patterns** to avoid overwhelming a failing server

## What to Expect

When you run the script, it will:

1. Check server health (unless skipped)
2. Register player accounts (or log in if they already exist)
3. Create characters for each player
4. Enter the game world
5. Move players to starting positions
6. Periodically check for nearby players and report findings
7. Move players randomly around their starting positions
8. Handle any errors that occur with appropriate retries and fallbacks
9. Exit the game gracefully after the specified duration
10. Provide a summary of the test results

Each player runs in its own thread, and you'll see detailed logs showing their actions and interactions.

## Troubleshooting

- Make sure the server is running and accessible at the specified URL
- If the health check fails, verify server status or use `--skip-health-check`
- If you see authentication errors, the server might have cached sessions - restart the server
- If players can't find each other, check that the server's nearby player functionality is working correctly
- For more detailed error information, use `--log-level DEBUG`

## Extending the Script

You can modify the `GameClient` class to add more functionality:
- Add chat messages between players
- Implement combat or other interactions
- Add custom movement patterns
- Add more sophisticated player behavior
- Implement additional error handling strategies

Feel free to expand and modify this script to suit your testing needs! 