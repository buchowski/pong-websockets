type WsBaseDataType = {
  playerId: string;
}

type WsBallMoveType = WsBaseDataType & {
  y: number;
  ballX: number;
  ballY: number;
}

type SocketType = {
  on: any;
  emit: any;
}

var socket: SocketType;
var io: any;

// index.html gives us a socket.io reference
// we can init if the user creates a multiplayer game
function injectSocketIO(io: any) {
  io = io;
}

function initSocket() {
  var socket = io();
  subscribe();
}

let playerId: string;
let isPlayerCreator: boolean;
let isMultiplayer: boolean;

// constants
const UP = 'UP';
const DOWN = 'DOWN';
const IDLE = 'IDLE';
const svgHeight = 400;
const svgWidth = 600;
const paddleDeltaY = 6;
const paddleWidth = 10;
const paddleHeight = 40;

// leftPaddle
let leftX = 50;
let leftY = 100;
let deltaY = 0;
let paddleDirection = IDLE;

// rightPaddle
let rightX = 500;
let rightY = 50;

// ball = radius should match what's inside index.html
let ballRadius = 6;
let ballX = 225;
let ballY = 50;
let ballDeltaX = 7;
let ballDeltaY = 5;

// dom elements
const dummy = document.createElement('form')
const form = document.querySelector('form') || dummy;
const submitBtn = document.querySelector('button[type=submit]') || dummy;
const board = document.getElementById('board') || dummy;
let leftPaddle = document.getElementById('left-paddle') || dummy;
let rightPaddle = document.getElementById('right-paddle') || dummy;
let ball = document.getElementById('ball') || dummy;

// helpers
const s = (n: any) => String(n)
const isPaddleTooHigh = (y: number) => y <= 0;
const isPaddleTooLow = (y: number) => y + 40 >= svgHeight;
const isBallTooHigh = (y: number) => y - ballRadius <= 0;
const isBallTooLow = (y: number) => y + ballRadius >= svgHeight;
const isTooLeft = (x: number) => x - ballRadius <= 0;
const isTooRight = (x: number) => x + ballRadius >= svgWidth;
const getValidBallDeltas = (ballX: number, ballY: number) => {
  let validDeltaX = ballDeltaX;
  let validDeltaY = ballDeltaY;

  if (isBallTooHigh(ballY) || isBallTooLow(ballY)) {
    validDeltaY = -ballDeltaY;
  }
  if (isTooLeft(ballX) || isTooRight(ballX)) {
    validDeltaX = -ballDeltaX;
  }

  return {validDeltaX, validDeltaY};
}
const isPointWithinRange = (point: number, startRange: number, endRange: number) => {
  return point >= startRange && point <= endRange;
}
type GetIsCollisionArgType = {ballX: number, ballY: number, paddleX: number, paddleY: number};
const getIsCollision = ({ballX, ballY, paddleX, paddleY}: GetIsCollisionArgType) => {
  const ballLeftMost = ballX - ballRadius;
  const ballRightMost = ballX + ballRadius;
  const ballTopMost = ballY + ballRadius;
  const ballBottomMost = ballY - ballRadius;
  const paddleLeftMost = paddleX;
  const paddleRightMost = paddleX + paddleWidth;
  const paddleTopMost = paddleY;
  const paddleBottomMost = paddleY + paddleHeight;
  const doesBallRightOverlap = isPointWithinRange(ballRightMost, paddleLeftMost, paddleRightMost);
  const doesBallLeftOverlap = isPointWithinRange(ballLeftMost, paddleLeftMost, paddleRightMost);
  const doesBallTopOverlap = isPointWithinRange(ballTopMost, paddleBottomMost, paddleTopMost);
  const doesBallBottomOverlap = isPointWithinRange(ballBottomMost, paddleBottomMost, paddleTopMost);
  const doesXOverlap = doesBallRightOverlap || doesBallLeftOverlap;
  const doesYOverlap = doesBallBottomOverlap || doesBallTopOverlap;

  if (doesXOverlap && doesYOverlap) {
    return {isCollision: true}
  }

  return {isCollision: false}
}

function socketOn<T extends {playerId: string}>(msg: string, cb: (data: T) => void): void {
  socket.on(msg, (data: T) => {
    console.log(`received ${msg} message from ${data.playerId}`);

    cb(data);
  })
}
function socketEmit<T>(msg: string, data: T): void {
  socket.emit(msg, data)
}

// other
let waitingForOpponentIntervalId: number;

// initialize
board.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
leftPaddle.setAttribute('x', s(leftX));
leftPaddle.setAttribute('y', s(leftY));
rightPaddle.setAttribute('x', s(rightX));
rightPaddle.setAttribute('y', s(rightY));
ball.setAttribute('cx', s(ballX));
ball.setAttribute('cy', s(ballY));
form.addEventListener('submit', createNewGame);

// emit websocket msg if ball pos has changed
const enableGameLoop = () => {
  setInterval(function emitMessageLoop() {
    const isIdle = paddleDirection === IDLE;
    // always update the ball && the opponent's paddle pos
    rightPaddle.setAttribute('y', s(rightY));
    ball.setAttribute('cx', s(ballX));
    ball.setAttribute('cy', s(ballY));

    // only creator broadcasts ball pos so nothing to broadcast if non-creator is idle
    if (!isPlayerCreator && isIdle) {
      return;
    }

    if (isPaddleTooHigh(leftY)) {
      paddleDirection = DOWN;
    } else if (isPaddleTooLow(leftY)) {
      paddleDirection = UP;
    }

    // set paddle pos
    if (!isIdle) {
      deltaY = paddleDirection === DOWN ? paddleDeltaY : -paddleDeltaY; 
      leftY += deltaY;
      leftPaddle.setAttribute('y', s(leftY));
    }

    const {isCollision} = getIsCollision({ballX, ballY, paddleX: leftX, paddleY: leftY});
    // update ball pos if is creator
    if (isPlayerCreator && isCollision) {
      ballDeltaX = -ballDeltaX;
      ballX += ballDeltaX;
      ballY += ballDeltaY;
    } else if (isPlayerCreator) {
      const {validDeltaX, validDeltaY} = getValidBallDeltas(ballX, ballY);
      ballDeltaX = validDeltaX;
      ballDeltaY = validDeltaY;
      ballX += ballDeltaX;
      ballY += ballDeltaY;
    }

    socketEmit<WsBallMoveType>('ballMove', {playerId, y: leftY, ballX, ballY});
  }, 50);
}

const enableSinglePlayerGameLoop = () => {
  setInterval(function emitMessageLoop() {
    const isIdle = paddleDirection === IDLE;
    // always update the ball && the opponent's paddle pos
    // rightPaddle.setAttribute('y', s(rightY));
    ball.setAttribute('cx', s(ballX));
    ball.setAttribute('cy', s(ballY));

    if (isPaddleTooHigh(leftY)) {
      paddleDirection = DOWN;
    } else if (isPaddleTooLow(leftY)) {
      paddleDirection = UP;
    }

    // set paddle pos
    if (!isIdle) {
      deltaY = paddleDirection === DOWN ? paddleDeltaY : -paddleDeltaY; 
      leftY += deltaY;
      leftPaddle.setAttribute('y', s(leftY));
    }

    const {isCollision} = getIsCollision({ballX, ballY, paddleX: leftX, paddleY: leftY});
    const {validDeltaX, validDeltaY} = getValidBallDeltas(ballX, ballY);
    ballDeltaX = validDeltaX;
    ballDeltaY = validDeltaY;
    ballX += ballDeltaX;
    ballY += ballDeltaY;
  }, 50);
}

function subscribe() {
  let isFromOtherPlayer;
  socketOn<WsBallMoveType>('ballMove', function syncServer(data) {
    isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      rightY = data.y;
    }
    if (!isPlayerCreator) {
      ballX = data.ballX;
      ballY = data.ballY;
    }
  });
  
  let beginGameWithOpponent;
  socketOn<WsBaseDataType>('joinGame', (data) => {
    beginGameWithOpponent = data.playerId !== playerId;
  
    if (beginGameWithOpponent) {
      clearInterval(waitingForOpponentIntervalId)
    } else {
      // since we joined the game. give us control of the right paddle
      // TODO use better names for paddle vars
      const tempPaddle = leftPaddle;
      leftPaddle = rightPaddle;
      rightPaddle = tempPaddle
    }
  
    startGame();
  });
  
  let isAskToJoin;
  socketOn<WsBaseDataType>('waitingForOpponent', (data) => {
    isAskToJoin = data.playerId !== playerId;
  
    if (isAskToJoin) {
      submitBtn.innerHTML = `Join ${data.playerId}'s Game`
      form.removeEventListener('submit', createNewGame);
      form.addEventListener('submit', joinGame);
    }
  })
}

const enableGameControls = () => {
  document.addEventListener('keydown', function movePaddle(e) {
    e.preventDefault();

    switch (e.key) {
      case 'w':
        paddleDirection = UP;
        break;
      case 's':
        paddleDirection = DOWN;
        break;
      case 'd':
        paddleDirection = IDLE;
    }
  });
}

const startGame = () => {
  enableGameControls();
  enableGameLoop();
}
const startSinglePlayerGame = () => {
  enableGameControls();
  enableSinglePlayerGameLoop();
}

function joinGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = s(playerName);
  isPlayerCreator = false;

  socketEmit<WsBaseDataType>('joinGame', {playerId})
}

function createNewGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')
  isMultiplayer = Boolean(formData.get('is-multiplayer'));

  playerId = s(playerName);
  isPlayerCreator = true;

  if (isMultiplayer) {
    initSocket();
    // broadcast that we need an opponent for our new game
    waitingForOpponentIntervalId = window.setInterval(() => {
      socketEmit<WsBaseDataType>('waitingForOpponent', {playerId})
    }, 250);
  } else {
    startSinglePlayerGame();
  }
}