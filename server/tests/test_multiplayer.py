#!/usr/bin/env python3
import requests
import json
import time
import threading
import argparse
import logging
import sys
import random
import os
from pprint import pprint
from requests.exceptions import RequestException, Timeout, ConnectionError

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("multiplayer-test")

class ServerTester:
    """Class to handle server testing in multiple steps"""
    
    def __init__(self, server_url="http://localhost:3000", max_retries=3, retry_delay=2):
        self.server_url = server_url
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session = requests.Session()
        
    def make_request(self, method, endpoint, headers=None, json_data=None, params=None, retries=None):
        """Make a request with retry logic and error handling"""
        if retries is None:
            retries = self.max_retries
        
        url = f"{self.server_url}{endpoint}"
        
        for attempt in range(retries + 1):
            try:
                if attempt > 0:
                    # Add jitter to retry delay to prevent thundering herd
                    jitter = random.uniform(0, self.retry_delay / 2)
                    logger.info(f"Retry attempt {attempt}/{retries} after {self.retry_delay + jitter:.1f}s delay")
                    time.sleep(self.retry_delay + jitter)
                
                response = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                    params=params,
                    timeout=(3.0, 10.0)  # (connect timeout, read timeout)
                )
                
                # For debugging
                if response.status_code >= 400:
                    logger.debug(f"Request failed: {method} {url}, status: {response.status_code}")
                    logger.debug(f"Response: {response.text}")
                    
                return response
                
            except Timeout:
                logger.warning(f"Timeout on {method} {endpoint}")
                if attempt == retries:
                    logger.error(f"Maximum retries reached for {method} {endpoint}")
                    raise
            except ConnectionError:
                logger.warning(f"Connection error on {method} {endpoint}")
                if attempt == retries:
                    logger.error(f"Maximum retries reached for {method} {endpoint}")
                    raise
            except RequestException as e:
                logger.warning(f"Request error on {method} {endpoint}: {str(e)}")
                if attempt == retries:
                    logger.error(f"Maximum retries reached for {method} {endpoint}")
                    raise
        
        # This should never be reached due to the raise in the loop, but just in case
        raise RequestException(f"Failed after {retries} retries")
    
    def check_server_health(self):
        """Check if the server is healthy"""
        logger.info(f"STEP 1: Checking server health at {self.server_url}/health")
        
        try:
            response = self.make_request("GET", "/health")
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                
                if status == "ok":
                    logger.info(f"✅ Server is healthy: {status}")
                    logger.info(f"Database: {data.get('services', {}).get('database', 'unknown')}")
                    logger.info(f"Redis: {data.get('services', {}).get('redis', 'unknown')}")
                    if 'players' in data:
                        logger.info(f"Active players: {data.get('players', {}).get('active', 0)}")
                    return True, data
                else:
                    logger.warning(f"⚠️ Server health check reports degraded status: {status}")
                    logger.warning(f"Health details: {data}")
                    return False, data
            else:
                logger.error(f"❌ Server health check failed with status code: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False, None
                
        except Exception as e:
            logger.error(f"❌ Server health check failed: {str(e)}")
            return False, None
    
    def register_test_user(self, username, email, password):
        """Register a test user"""
        logger.info(f"STEP 2: Registering test user: {username}")
        
        try:
            response = self.make_request(
                "POST",
                "/auth/register",
                json_data={
                    "username": username,
                    "email": email,
                    "password": password
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                user_id = data.get("user", {}).get("id")
                logger.info(f"✅ Registered: {username} (ID: {user_id})")
                return True, token, user_id
            elif response.status_code == 400 and "already exists" in response.text:
                # User already exists, try logging in
                logger.info(f"User {username} already exists, attempting login...")
                return self.login_test_user(email, password)
            else:
                logger.error(f"❌ Registration failed: {response.text}")
                return False, None, None
                
        except Exception as e:
            logger.error(f"❌ Registration failed: {str(e)}")
            return False, None, None
    
    def login_test_user(self, email, password):
        """Login a test user"""
        logger.info(f"STEP 2a: Logging in user: {email}")
        
        try:
            response = self.make_request(
                "POST",
                "/auth/login",
                json_data={
                    "email": email,
                    "password": password
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                user_id = data.get("user", {}).get("id")
                logger.info(f"✅ Logged in user: {email} (ID: {user_id})")
                return True, token, user_id
            else:
                logger.error(f"❌ Login failed: {response.text}")
                return False, None, None
                
        except Exception as e:
            logger.error(f"❌ Login failed: {str(e)}")
            return False, None, None
    
    def create_character(self, token, name):
        """Create a character for a user"""
        logger.info(f"STEP 3: Creating character: {name}")
        
        try:
            response = self.make_request(
                "POST",
                "/characters",
                headers={"Authorization": f"Bearer {token}"},
                json_data={"name": name}
            )
            
            if response.status_code == 200:
                data = response.json()
                character_id = data.get("id")
                logger.info(f"✅ Character created: {name} (ID: {character_id})")
                return True, character_id
            else:
                logger.error(f"❌ Character creation failed: {response.text}")
                return False, None
                
        except Exception as e:
            logger.error(f"❌ Character creation failed: {str(e)}")
            return False, None
    
    def get_user_characters(self, token):
        """Get all characters for a user"""
        logger.info(f"STEP 4: Retrieving user characters")
        
        try:
            response = self.make_request(
                "GET",
                "/characters",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                characters = response.json()
                if characters:
                    logger.info(f"✅ Found {len(characters)} characters")
                    for character in characters:
                        logger.info(f"  - {character.get('name')} (ID: {character.get('id')})")
                    return True, characters
                else:
                    logger.warning("No characters found for user")
                    return True, []
            else:
                logger.error(f"❌ Failed to get characters: {response.text}")
                return False, []
                
        except Exception as e:
            logger.error(f"❌ Failed to get characters: {str(e)}")
            return False, []
    
    def enter_game(self, token, character_id):
        """Enter the game world with a character"""
        logger.info(f"STEP 5: Entering game with character ID: {character_id}")
        
        try:
            response = self.make_request(
                "POST",
                "/game/enter",
                headers={"Authorization": f"Bearer {token}"},
                json_data={"characterId": character_id}
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Entered game with character ID: {character_id}")
                return True
            else:
                logger.error(f"❌ Failed to enter game: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to enter game: {str(e)}")
            return False
    
    def update_position(self, token, character_id, x, y, z=0):
        """Update character position"""
        logger.info(f"STEP 6: Moving character to position ({x}, {y}, {z})")
        
        try:
            response = self.make_request(
                "POST",
                "/game/position",
                headers={"Authorization": f"Bearer {token}"},
                json_data={
                    "characterId": character_id,
                    "position": {"x": x, "y": y, "z": z}
                }
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Moved to position: ({x}, {y}, {z})")
                return True
            else:
                logger.error(f"❌ Failed to move: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to move: {str(e)}")
            return False
    
    def check_nearby_players(self, token, character_id, radius=20):
        """Check for nearby players"""
        logger.info(f"STEP 7: Checking for nearby players (radius: {radius})")
        
        try:
            response = self.make_request(
                "GET",
                "/game/nearby",
                headers={"Authorization": f"Bearer {token}"},
                params={"characterId": character_id, "radius": radius}
            )
            
            if response.status_code == 200:
                data = response.json()
                nearby = data.get("players", [])
                if nearby:
                    logger.info(f"✅ Found {len(nearby)} nearby players:")
                    for player in nearby:
                        pos = player.get("position", {})
                        logger.info(f"  - {player.get('name')} at position ({pos.get('x')}, {pos.get('y')}, {pos.get('z')}), distance: {player.get('distance'):.2f}")
                else:
                    logger.info("No nearby players found")
                return True, nearby
            else:
                logger.error(f"❌ Failed to check nearby players: {response.text}")
                return False, []
                
        except Exception as e:
            logger.error(f"❌ Failed to check nearby players: {str(e)}")
            return False, []
    
    def exit_game(self, token, character_id):
        """Exit the game world"""
        logger.info(f"STEP 8: Exiting game with character ID: {character_id}")
        
        try:
            response = self.make_request(
                "POST",
                "/game/exit",
                headers={"Authorization": f"Bearer {token}"},
                json_data={"characterId": character_id}
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Exited game with character ID: {character_id}")
                return True
            else:
                logger.error(f"❌ Failed to exit game: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to exit game: {str(e)}")
            return False
            
    def run_multiplayer_simulation(self, player_count=2, duration=30):
        """Run a basic multiplayer simulation with multiple players"""
        logger.info(f"STEP 9: Running multiplayer simulation with {player_count} players for {duration} seconds")
        
        # Configure players
        player_configs = []
        for i in range(player_count):
            player_configs.append({
                "username": f"TestPlayer_{i+1}",
                "email": f"player{i+1}@test.com",
                "password": "password123",
                "position": [i*5, i*5, 0],  # Space players out a bit
                "duration": duration,
                "server_url": self.server_url,
                "max_retries": self.max_retries
            })
        
        # Create and start threads for each player
        threads = []
        for config in player_configs:
            thread = threading.Thread(target=self._run_player_simulation, args=(config,))
            threads.append(thread)
            thread.start()
            # Stagger thread starts
            time.sleep(random.uniform(0.1, 0.5))
        
        # Wait for all threads to complete
        try:
            # Print periodic progress updates
            start_time = time.time()
            while any(thread.is_alive() for thread in threads):
                alive_threads = sum(1 for thread in threads if thread.is_alive())
                elapsed = time.time() - start_time
                if elapsed >= duration:
                    logger.info(f"Simulation duration elapsed, waiting for {alive_threads} threads to complete...")
                else:
                    remaining = duration - elapsed
                    logger.info(f"Simulation in progress: {elapsed:.1f}s elapsed, {remaining:.1f}s remaining, {alive_threads}/{len(threads)} players active")
                
                # Check every 5 seconds
                time.sleep(5)
                
        except KeyboardInterrupt:
            logger.warning("⚠️ Simulation interrupted by user")
            logger.info("Waiting for threads to finish cleanup...")
            
            # Wait a bit for threads to handle the cleanup
            for _ in range(5):
                if not any(thread.is_alive() for thread in threads):
                    break
                time.sleep(1)
        
        logger.info("✅ Multiplayer simulation completed")
        return True
    
    def _run_player_simulation(self, config):
        """Run simulation for a single player"""
        username = config.get("username")
        email = config.get("email")
        password = config.get("password")
        position = config.get("position", [0, 0, 0])
        duration = config.get("duration", 30)
        
        # Setup logger for this player
        player_logger = logging.getLogger(f"player.{username}")
        
        try:
            player_logger.info(f"Starting simulation for {username}")
            
            # Register/login
            success, token, user_id = self.register_test_user(username, email, password)
            if not success or not token:
                player_logger.error(f"Failed to register/login {username}")
                return
            
            # Create character
            success, character_id = self.create_character(token, f"{username}_Hero")
            if not success or not character_id:
                # Try getting existing characters
                success, characters = self.get_user_characters(token)
                if success and characters:
                    character_id = characters[0].get("id")
                    player_logger.info(f"Using existing character: {characters[0].get('name')} (ID: {character_id})")
                else:
                    player_logger.error(f"Failed to create/get character for {username}")
                    return
            
            # Enter game
            if not self.enter_game(token, character_id):
                player_logger.error(f"Failed to enter game for {username}")
                return
            
            # Initial position
            if not self.update_position(token, character_id, position[0], position[1], position[2] if len(position) > 2 else 0):
                player_logger.warning(f"Failed to set initial position for {username}, but continuing")
            
            # Main simulation loop
            start_time = time.time()
            last_move_time = start_time
            last_check_time = start_time
            move_interval = 5 + random.uniform(-1, 1)  # Add some variation
            check_interval = 2 + random.uniform(-0.5, 0.5)  # Add some variation
            
            try:
                while time.time() - start_time < duration:
                    current_time = time.time()
                    
                    # Check for nearby players periodically
                    if current_time - last_check_time >= check_interval:
                        self.check_nearby_players(token, character_id)
                        last_check_time = current_time
                    
                    # Move randomly periodically
                    if current_time - last_move_time >= move_interval:
                        # Small random movement around base position
                        dx = (time.time() % 5) - 2.5
                        dy = (time.time() % 7) - 3.5
                        self.update_position(
                            token,
                            character_id,
                            position[0] + dx,
                            position[1] + dy,
                            position[2] if len(position) > 2 else 0
                        )
                        last_move_time = current_time
                    
                    time.sleep(0.5)
                    
            except Exception as e:
                player_logger.error(f"Error during simulation: {str(e)}")
            finally:
                # Exit game
                self.exit_game(token, character_id)
                player_logger.info(f"Simulation for {username} completed")
                
        except Exception as e:
            player_logger.error(f"Unhandled exception in player thread: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description="Alternate Earth MMO Multiplayer Test Script")
    parser.add_argument("--server", type=str, default="http://localhost:3000", help="Server URL")
    parser.add_argument("--step", type=str, default="all", 
                        choices=["all", "health", "user", "character", "enter", "position", "nearby", "exit", "simulate"],
                        help="Run a specific test step")
    parser.add_argument("--players", type=int, default=2, help="Number of players for simulation")
    parser.add_argument("--duration", type=int, default=30, help="Duration of simulation in seconds")
    parser.add_argument("--log-level", type=str, default="INFO", 
                        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="Set the logging level")
    parser.add_argument("--max-retries", type=int, default=3, help="Maximum number of request retries")
    args = parser.parse_args()
    
    # Set logging level
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    logger.info(f"🎮 Alternate Earth MMO Multiplayer Test")
    logger.info(f"🌐 Server: {args.server}")
    logger.info(f"🔍 Step: {args.step}")
    
    # Create tester
    tester = ServerTester(
        server_url=args.server,
        max_retries=args.max_retries
    )
    
    # Test variables to share between steps
    token = None
    user_id = None
    character_id = None
    
    # Run requested step(s)
    if args.step in ["all", "health"]:
        success, _ = tester.check_server_health()
        if not success and args.step == "all":
            logger.error("Health check failed, aborting further tests")
            return 1
    
    if args.step in ["all", "user"]:
        success, token, user_id = tester.register_test_user("TestUser", "testuser@example.com", "password123")
        if not success and args.step == "all":
            logger.error("User registration/login failed, aborting further tests")
            return 1
    
    if args.step in ["all", "character"]:
        if not token and args.step == "all":
            logger.error("No authentication token available, aborting character test")
            return 1
        
        # Use provided token or get a new one
        if not token:
            success, token, user_id = tester.login_test_user("testuser@example.com", "password123")
            if not success:
                logger.error("Login failed, aborting character test")
                return 1
        
        success, character_id = tester.create_character(token, "TestHero")
        if not success and args.step == "all":
            # Try getting existing characters
            success, characters = tester.get_user_characters(token)
            if success and characters:
                character_id = characters[0].get("id")
                logger.info(f"Using existing character: {characters[0].get('name')} (ID: {character_id})")
            else:
                logger.error("Character creation/retrieval failed, aborting further tests")
                return 1
    
    if args.step in ["all", "enter"]:
        if not token or not character_id:
            if args.step == "all":
                logger.error("Missing token or character_id, aborting enter game test")
                return 1
            # Get authentication if running this step directly
            success, token, user_id = tester.login_test_user("testuser@example.com", "password123")
            if not success:
                logger.error("Login failed, aborting enter game test")
                return 1
            
            # Get character if running this step directly
            success, characters = tester.get_user_characters(token)
            if success and characters:
                character_id = characters[0].get("id")
            else:
                success, character_id = tester.create_character(token, "TestHero")
                if not success:
                    logger.error("Character creation failed, aborting enter game test")
                    return 1
        
        success = tester.enter_game(token, character_id)
        if not success and args.step == "all":
            logger.error("Enter game failed, aborting further tests")
            return 1
    
    if args.step in ["all", "position"]:
        if not token or not character_id:
            if args.step == "all":
                logger.error("Missing token or character_id, aborting position test")
                return 1
            # Setup for direct step execution
            success, token, user_id = tester.login_test_user("testuser@example.com", "password123")
            success, characters = tester.get_user_characters(token)
            if success and characters:
                character_id = characters[0].get("id")
                tester.enter_game(token, character_id)
            else:
                logger.error("Failed to get character for position test")
                return 1
        
        success = tester.update_position(token, character_id, 10, 10, 0)
        if not success and args.step == "all":
            logger.warning("Position update failed, but continuing with further tests")
    
    if args.step in ["all", "nearby"]:
        if not token or not character_id:
            if args.step == "all":
                logger.error("Missing token or character_id, aborting nearby test")
                return 1
            # Setup for direct step execution
            success, token, user_id = tester.login_test_user("testuser@example.com", "password123")
            success, characters = tester.get_user_characters(token)
            if success and characters:
                character_id = characters[0].get("id")
                tester.enter_game(token, character_id)
            else:
                logger.error("Failed to get character for nearby test")
                return 1
        
        success, _ = tester.check_nearby_players(token, character_id)
        if not success and args.step == "all":
            logger.warning("Nearby check failed, but continuing with further tests")
    
    if args.step in ["all", "exit"]:
        if not token or not character_id:
            if args.step == "all":
                logger.error("Missing token or character_id, aborting exit test")
                return 1
            # Setup for direct step execution
            success, token, user_id = tester.login_test_user("testuser@example.com", "password123")
            success, characters = tester.get_user_characters(token)
            if success and characters:
                character_id = characters[0].get("id")
            else:
                logger.error("Failed to get character for exit test")
                return 1
        
        success = tester.exit_game(token, character_id)
        if not success and args.step == "all":
            logger.warning("Exit game failed")
    
    if args.step in ["all", "simulate"]:
        logger.info(f"Running multiplayer simulation with {args.players} players for {args.duration} seconds")
        tester.run_multiplayer_simulation(args.players, args.duration)
    
    logger.info("🏁 Test sequence completed!")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 