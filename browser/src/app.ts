
type ChangePaddleDirectionPayloadType = {
  playerId: string;
  direction: Direction;
}

type CollisionPayloadType = {
  playerId: string;
  paddleY: number;
  ballX: number;
  ballY: number;
  deltaX: number;
  deltaY: number;
}

type JoinPayloadType = {
  playerId: string;
}

type MsgPayload = CollisionPayloadType | ChangePaddleDirectionPayloadType | JoinPayloadType;

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

function initBotSocket() {
  socket  = new BotSocket()
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

type MsgCbType = (data: MsgPayload) => void;
type MsgCbMapType = {
  [key in Msg]?: MsgCbType;
};

class BotSocket {
  onHandlerMap: MsgCbMapType= {};

  on(msg: Msg, cb: MsgCbType) {
    this.onHandlerMap[msg] = cb;
  } 
  emit(msg: Msg, data: any) {
    console.log('BotSocket emit ', msg, data);

    // single player doesn't use AcceptJoin or AskJoin skip on() call
    if (msg === Msg.AcceptJoin) {
      return;
    } else if (msg === Msg.AskJoin) {
      clearInterval(waitingForOpponentIntervalId)
      startGame();
    }

    const cb = this.onHandlerMap[msg];
    if (cb) {
      cb(data);
    }
  }
}

const BOT_ID = 'BOT_ID'
let playerId: string;
let isPlayerCreator: boolean;

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
  const doesBallTopOverlap = isPointWithinRange(ballTopMost, paddleTopMost, paddleBottomMost);
  const doesBallBottomOverlap = isPointWithinRange(ballBottomMost, paddleTopMost, paddleBottomMost);
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
  setInterval(function updateGameBoard() {
    setPaddleDirections();
    setPaddlePositions();
    
    const {isCollision} = getIsCollision({ballX, ballY, paddleX: leftX, paddleY: leftY});
    const {isCollision: isBotCollision} = getIsCollision({ballX, ballY, paddleX: rightX, paddleY: rightY});

    // we always broadcast our collisions. if it's singlePlayer we also broadcast bot collisions
    if (isCollision) {
      ballDeltaX = -ballDeltaX;
      socketEmit<CollisionPayloadType>(Msg.ChangeBallDirection, {playerId, deltaX: ballDeltaX, deltaY: ballDeltaY, ballX, ballY, paddleY: leftY});
    } else if (!isMultiplayer && isBotCollision) {
      ballDeltaX = -ballDeltaX;
      socketEmit<CollisionPayloadType>(Msg.ChangeBallDirection, {playerId: BOT_ID, deltaX: ballDeltaX, deltaY: ballDeltaY, ballX, ballY, paddleY: rightY});
    }
    setBallPosition();
  }, 50);
}

const enableBotLoop = () => {
  let rateLimiter = 0;
  setInterval(function emitBotMsgs() {
    if (rateLimiter > 0) {
      rateLimiter -= 50;
      return;
    }

    // limit direction changes to once every 1.5 seconds
    rateLimiter = 1000 * 1.5;
    const isBallGoingUp = ballDeltaY < 0;
    const isBallGoingDown = !isBallGoingUp;
    const isPaddleIdle = rightPaddleDirection === Direction.Idle;
    const isPaddleGoingDown = rightPaddleDirection === Direction.Down;
    const isPaddleGoingUp = rightPaddleDirection === Direction.Up;

    if (isBallGoingUp && (isPaddleIdle || isPaddleGoingDown)) {
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId: BOT_ID, direction: Direction.Up})
    } else if (isBallGoingDown && (isPaddleIdle || isPaddleGoingUp)) {
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId: BOT_ID, direction: Direction.Down})
    }
  }, 50);
}

function subscribe() {
  socketOn<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, function syncServer(data) {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      rightPaddleDirection = data.direction;
    }
  });

  socketOn<CollisionPayloadType>(Msg.ChangeBallDirection, function syncServer(data) {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    // whenever there's a collision we update our board to reflect the opponent's state
    if (isFromOtherPlayer) {
      ballDeltaX = data.deltaX;
      ballDeltaY = data.deltaY;
      ballX = data.ballX;
      ballY = data.ballY;
      rightY = data.paddleY;
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
  if (!isMultiplayer) {
    enableBotLoop();
  }
}

function joinGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = s(playerName);
  isPlayerCreator = false;

  socketEmit<JoinPayloadType>(Msg.AcceptJoin, {playerId})
}

// TODO hardcode this for now
const isMultiplayer = false;

function createNewGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')
  const isMultiplayer = formData.get('is-multiplayer')

  playerId = s(playerName);
  isPlayerCreator = true;

  if (socket) {
    return;
  }

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