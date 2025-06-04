const { Worker, isMainThread, parentPort } = require('worker_threads');

// TODO: maybe pass as args?
// toggle these
// vvv
const numPlayers = 16;
const numRoundsPerPlayer = 5;
const numPlayersPerRound = 4;

const numThreads = 6;
const evalMax = 1e9;
const timeMaxMinutes = 60;
// ^^^
// toggle these

let evalCount = 0;
let oppScoreGoal;
let maxOppScore = 0;
let maxOppPlayCount;

function generateResults() {
  let result;
  const validOppPlayCounts = getValidPlayCounts();
  while(maxOppScore < oppScoreGoal) {
    runPerformanceTelemetry();
    result = initializeResult();
    while(!checkRoundCount(result.roundsPerPlayer)) {
      generateRound(result);
      if(result.abort) {
        break;
      }
    }
    if(result.abort) continue;
    handleScoring(result, validOppPlayCounts);
  }
}

function getValidPlayCounts() {
  if(((numPlayers * numRoundsPerPlayer) % numPlayersPerRound) != 0) {
    let message = {}
    message.invalidCombination = true;
    parentPort.postMessage(message);
  }

  const totalOpps = numRoundsPerPlayer * (numPlayersPerRound - 1);
  const distinctOpps = Math.min(numPlayers - 1,  totalOpps);
  oppScoreGoal = distinctOpps * numPlayers;
  const validOppPlayCounts = new Set();
  if(totalOpps <= distinctOpps) {
    validOppPlayCounts.add(1);
    maxOppPlayCount = 1;
  } else {
    if(totalOpps % distinctOpps == 0) {
      maxOppPlayCount = totalOpps / distinctOpps;
      validOppPlayCounts.add(maxOppPlayCount);
    } else {
      maxOppPlayCount = Math.ceil(totalOpps / distinctOpps);
      validOppPlayCounts.add(maxOppPlayCount - 1);
      validOppPlayCounts.add(maxOppPlayCount);
    }
  }
  return validOppPlayCounts;
}

function runPerformanceTelemetry() {
  evalCount++;
  if(evalCount % 100000 == 0) {
    let message = {}
    message.evalsPerformed = 100000;
    parentPort.postMessage(message);
  }
}

function initializeResult() {
  result = {};
  result.comment = numPlayers + " PLAYERS - " + numRoundsPerPlayer + " ROUNDS PER PLAYER";
  result.abort = false;
  result.rounds = [];
  result.roundsPerPlayer = [];
  for(let i = 0; i < numPlayers; i++) {
    result.roundsPerPlayer[i] = 0;
  }
  result.opponentMatrix = [];
  for(let i = 0; i < numPlayers; i++) {
    result.opponentMatrix[i] = [];
    for(let j = 0; j < numPlayers; j++) {
      result.opponentMatrix[i][j] = 0;
    }
  }
  return result;
}

function checkRoundCount(roundsPerPlayer) {
  for(let i = 0; i < roundsPerPlayer.length; i++) {
    if(roundsPerPlayer[i] < numRoundsPerPlayer) {
      return false;
    }
  }
  return true;
}

function generateRound(result) {
  let round = [];
  while(round.length < numPlayersPerRound) {
    let p = getPlayer(round, result);
    if(p != -1) {
      let playerRounds = result.roundsPerPlayer[p]++;
      if(playerRounds > numRoundsPerPlayer) {
        result.abort = true;
        return;
      }
      round.push(p);
    } else { // no available players
      result.abort = true;
      return;
    }
  }

  // update opponent matrix
  for(let i = 0; i < numPlayersPerRound; i++) {
    for(let j = 0; j < numPlayersPerRound; j++) {
      let p = round[i];
      let o = round[j];
      if(p != o) {
        let playCount = result.opponentMatrix[p][o]++;
        if(playCount > maxOppPlayCount) {
          result.abort = true;
          break;
        }
      }
    }
  }

  result.rounds.push(round);
}

function getPlayer(round, result) {
  // set players already in the round to unavailable
  let available = new Set();
  let unavailable = new Set(round);

  // set players who have met their max round count to unavailable
  for(let i = 0; i < numPlayers; i++) {
    if(unavailable.has(i)) continue;
    if(result.roundsPerPlayer[i] >= numRoundsPerPlayer) {
      unavailable.add(i);
    } else {
      available.add(i);
    }
  }
  
  // set players to unavailable if they have already reached the limit of playing current payers in the round
  for(let i = 0; i < round.length; i++) {
    let p = round[i];
    for(let j = 0; j < result.opponentMatrix[p].length; j++) {
      if(result.opponentMatrix[p][j] >= maxOppPlayCount) {
        unavailable.add(j);
        available.delete(j);
      }
    }
  }

  // pick a random player if one is available
  let p = -1;
  if(available.size > 0) {
    let a = Array.from(available);
    p = a[Math.floor(Math.random() * a.length)];
  }
  
  return p;
}

function handleScoring(result, validOppPlayCounts) {
  result.oppScore = 0;
  for(let i = 0; i < result.opponentMatrix.length; i++) {
    for(let j = 0; j < result.opponentMatrix[i].length; j++) {
      if(validOppPlayCounts.has(result.opponentMatrix[i][j])) {
        result.oppScore++;
      }
    }
  }
  maxOppScore = Math.max(result.oppScore, maxOppScore);

  if(result.oppScore >= oppScoreGoal) {
    delete result.abort;
    let message = {}
    message.result = result;
    parentPort.postMessage(message);
  }
}

// multi-threading
if(isMainThread) {
  const threads = new Set();
  console.log(`Running with ${numThreads} threads...`);

  const startTime = new Date();

  let totalEvalCount = 0;
  let totalMessageCount = 0;

  for(let i = 0; i < numThreads; i++) {
    threads.add(new Worker(__filename));
  }
  for(let worker of threads) {
    worker.on('error', (err) => { 
      throw err; 
    });
    worker.on('exit', () => {
      threads.delete(worker);
      console.log(`Thread exiting, ${threads.size} running...`);
      if(threads.size == 0) {
        //
      }
    })
    worker.on('message', (msg) => {
      if(msg.evalsPerformed != null) {
        let timeElapsed =  new Date(new Date() - startTime);
        totalEvalCount += msg.evalsPerformed;
        totalMessageCount++;
        if(totalMessageCount % numThreads == 0) {
          let micros = (Math.round((timeElapsed / (totalEvalCount / 1000)) * 100) / 100).toFixed(0);
          console.log("evaluated " + totalEvalCount + " groupings in " + timeElapsed.toISOString().substring(11, 19) + " ("  + micros + " µs per group)");
        }
        if(totalEvalCount >= evalMax || (timeElapsed / (60 * 1000) > timeMaxMinutes)) {
          process.exit();
        }
      } else if(msg.result != null) {
        console.log("found new result:");
        console.log(JSON.stringify(msg.result));
        process.exit();
      } else if(msg.invalidCombination) {
        console.log("invalid combination");
        process.exit();
      }
    });
  }
} else {
  generateResults();
}