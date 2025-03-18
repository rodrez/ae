# Dungeon and Instances Design Document

## 1. Dungeon Transition Mechanism

### 1.1. Dungeon Entrance on the Overworld

Visual Representation:

- Dungeon entrances appear on the Earth map as distinctive images.
- Player Interaction:
  - Players can tap or click on a dungeon entrance to view additional details such as the dungeon’s description, difficulty, and potential rewards.
  - After reviewing the information, players can choose to enter the dungeon.

### 1.2. Entering and Exiting a Dungeon

Entry Process:

- When a player enters a dungeon, they transition from the overworld into a separate dungeon instance.
- Instance Persistence:
  - The dungeon is a self-contained instance that players must complete by clearing each room until they reach and defeat the boss.
- Exit Protocol:
  - Once the boss is defeated, players can exit the dungeon and are returned exactly to the same overworld location from which they entered.

## 2. Dungeon Layout and Generation

### 2.1. Dungeon Structure

Static Main Path:

- Dungeons follow a predetermined, linear path leading to the boss room.
- Exploration Elements:
  - Additional rooms beyond the main path are included for exploration purposes. These extra rooms may include dead ends and side paths.

Room Objectives:

- Players must clear every room they encounter until the boss room is reached. The primary goal is to ensure a sequential progression, without randomized room orders or additional mini-challenges for now.

### 2.2. Entrance Placement

Fixed Locations:

- Initially, dungeon entrances are fixed to specific world map coordinates.

Future Dynamism:

- There is potential to generate additional entrances based on in-game events or player activity as the game evolves.

## 3. Instance Sharing and Party Mechanics

### 3.1. Multiplayer Approach

- Dungeons can be tackled by individual players or by parties.

Party Formation:

- A party leader can invite other players to join. When a player is “attached” to the party leader, they will be automatically moved along as the leader navigates the dungeon.

Chain Attachment:

- If multiple players are attached in a chain (for example, player A attaches player B, and player B attaches player C), the movement of player A will carry the entire chain.

Party Splitting:

- If a party splits mid-dungeon (for example, due to disconnection or a decision to leave), those players are considered normal, separate players and will navigate the dungeon independently.

Solo Players:

- Players not part of a party will navigate the dungeon independently.


## 4. Dungeon State Persistence

### 4.1. Dungeon Completion Reset

Once a dungeon is cleared, it resets after 7 days.

Exit Without Completion:

- If a player exits the dungeon before completing it, no immediate state changes occur. The dungeon remains available for the player to re-enter and complete later.

## 5. Difficulty Scaling and Environmental Hazards

### 5.1. Difficulty Scaling

Dynamic Adjustment:

- Some dungeons will incorporate scaling factors based on player level or regional challenges.

Variable Difficulty:

- While certain dungeons are designed to be more challenging, others will remain on the easier end of the spectrum, allowing for a balanced range of difficulty levels across the game.

### 5.2. Environmental Hazards

Tangible Gameplay Effects:

- Environmental hazards such as poison mist, quicksand, fog, or water will have real gameplay impacts.
Example – The Lost Swamp Dungeon:
In The Lost Swamp, home to the Lizardfolk, players will encounter quicksand and poison mist. These hazards can slow movement or inflict a poison debuff, potentially leading to player death if not managed or avoided.
Strategic Preparation:
Players are encouraged to equip or prepare appropriate countermeasures when entering environments known to feature such hazards.