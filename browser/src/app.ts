
type ChangePaddleDirectionPayloadType = {
  playerId: string;
  direction: Direction;
}

type ChangeBallDirectionPayloadType = {
  playerId: string;
  deltaX: number;
  deltaY: number;
}

type JoinPayloadType = {
  playerId: string;
}

type SocketType = {
  on: (msg: Msg, cb: any) => void;
  emit: (msg: Msg, data: any) => void;
}

var socket: SocketType;
var io: any;

// index.html gives us a socket.io reference
// we can init if the user creates a multiplayer game
function injectSocketIO(io: any) {
  io = io;
}

function initSocket() {
  socket = io();
  subscribe();
}

enum Msg {
  AskJoin = 'ASK_JOIN',
  AcceptJoin = 'ACCEPT_JOIN',
  ChangePaddleDirection = 'CHANGE_PADDLE_DIRECTION',
  ChangeBallDirection = 'CHANGE_BALL_DIRECTION',
}

enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Idle = 'IDLE',
}

class BotSocket {
  on() {

  } 
  emit(msg: Msg, data: any) {
    console.log('BotSocket emit ', msg, data);

    if (msg === Msg.AskJoin) {
      clearInterval(waitingForOpponentIntervalId)
      startGame();
    }
  }
}

function initBotSocket() {
  socket  = new BotSocket()
  subscribe();
}

let playerId: string;
let isPlayerCreator: boolean;
let isMultiplayer: boolean;

// constants
const svgHeight = 400;
const svgWidth = 600;
const paddleDeltaY = 6;
const paddleWidth = 10;
const paddleHeight = 40;

// leftPaddle
let leftX = 50;
let leftY = 100;
let deltaY = 0;
let paddleDirection = Direction.Idle;

// rightPaddle
let rightX = 500;
let rightY = 50;
let rightDeltaY = 0;
let rightPaddleDirection = Direction.Idle;

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

function socketOn<T extends {playerId: string}>(msg: Msg, cb: (data: T) => void): void {
  socket.on(msg, (data: T) => {
    console.log(`received ${msg} message from ${data.playerId}`);

    cb(data);
  })
}
function socketEmit<T>(msg: Msg, data: T): void {
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


const setPaddleDirections = () => {
  // our paddle
  if (isPaddleTooHigh(leftY)) {
    paddleDirection = Direction.Down;
  } else if (isPaddleTooLow(leftY)) {
    paddleDirection = Direction.Up;
  }
  
  // opponent's paddle
  if (isPaddleTooHigh(rightY)) {
    rightPaddleDirection = Direction.Down;
  } else if (isPaddleTooLow(rightY)) {
    rightPaddleDirection = Direction.Up;
  }
}

const setPaddlePositions = () => {
    const isLeftIdle = paddleDirection === Direction.Idle;
    const isRightIdle = rightPaddleDirection === Direction.Idle;

    if (!isLeftIdle) {
      deltaY = paddleDirection === Direction.Down ? paddleDeltaY : -paddleDeltaY; 
      leftY += deltaY;
      leftPaddle.setAttribute('y', s(leftY));
    }

    if (!isRightIdle) {
      rightDeltaY = rightPaddleDirection === Direction.Down ? paddleDeltaY : -paddleDeltaY; 
      rightY += rightDeltaY;
      rightPaddle.setAttribute('y', s(rightY));
    }
}

const setBallPosition = () => {
  const {validDeltaX, validDeltaY} = getValidBallDeltas(ballX, ballY);
  ballDeltaX = validDeltaX;
  ballDeltaY = validDeltaY;
  ballX += ballDeltaX;
  ballY += ballDeltaY;
  ball.setAttribute('cx', s(ballX));
  ball.setAttribute('cy', s(ballY));
}

const enableGameLoop = () => {
  setInterval(function emitMessageLoop() {
    setPaddleDirections();
    setPaddlePositions();
    setBallPosition();

    // const {isCollision} = getIsCollision({ballX, ballY, paddleX: leftX, paddleY: leftY});
    // update ball pos if is creator
    // if (isPlayerCreator && isCollision) {
    //   ballDeltaX = -ballDeltaX;
    //   ballX += ballDeltaX;
    //   ballY += ballDeltaY;
    // } else if (isPlayerCreator) {
    // }

    // socketEmit<WsBallMoveType>('ballMove', {playerId, y: leftY, ballX, ballY});
  }, 50);
}

function subscribe() {
  socketOn<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, function syncServer(data) {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      rightPaddleDirection = data.direction;
    }
  });

  socketOn<ChangeBallDirectionPayloadType>(Msg.ChangeBallDirection, function syncServer(data) {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      ballDeltaX = data.deltaX;
      ballDeltaY = data.deltaY;
    }
  });
  
  socketOn<JoinPayloadType>(Msg.AcceptJoin, (data) => {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
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
  
  socketOn<JoinPayloadType>(Msg.AskJoin, (data) => {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      submitBtn.innerHTML = `Join ${data.playerId}'s Game`
      form.removeEventListener('submit', createNewGame);
      form.addEventListener('submit', joinGame);
    }
  })
}

const enableGameControls = () => {
  document.addEventListener('keydown', function movePaddle(e) {
    e.preventDefault();
    let direction;

    if (e.key === 'w') {
      direction = Direction.Up;
    } else if (e.key === 's') {
      direction = Direction.Down;
    } else if (e.key === 'd') {
      direction = Direction.Idle;
    }

    if (!direction) {
      return;
    }

    const isUpdateDirection = direction !== paddleDirection;

    if (isUpdateDirection) {
      paddleDirection = direction;
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId, direction})
    }
  });
}

const startGame = () => {
  enableGameControls();
  enableGameLoop();
}

function joinGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = s(playerName);
  isPlayerCreator = false;

  socketEmit<JoinPayloadType>(Msg.AcceptJoin, {playerId})
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
  } else {
    initBotSocket();
  }
  // broadcast that we need an opponent for our new game
  waitingForOpponentIntervalId = window.setInterval(() => {
    socketEmit<JoinPayloadType>(Msg.AskJoin, {playerId})
  }, 250);
}