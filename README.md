# tournament-generator

## Description
This project was created to generate tournament formats for Mario Kart 64 but should be generic enough to generate formats for a wide variety of tournaments.

## Valid Format Assumptions
This project makes the following assumptions regarding format validity:
- Every player should play the same number of rounds
- The number of players per round should be the same for all rounds
- The difference between the maximum times a player should play one opponent and the minimum times a player should play a different opponent should never exceed 1 (e.g., Assuming numPlayers=4, Player A should never play Player B twice until they have also played Player C and Player D once).

## Variables
The following can be adjusted to generate different formats:
- numPlayers: total number of players in the tournament
- numRoundsPerPlayer: number of rounds each player will play in the tournament
- numPlayersPerRound: number of players in each round
- numThreads: number of threads to use (suggest using a max of numCores - 2 as running at numCores showed diminishing returns)
- evalMax: maximum number of evaluations to perform before terminating
- timeMaxMinutes: maximum number of minutes to run before terminating

## Requirements
NodeJS 12 or higher