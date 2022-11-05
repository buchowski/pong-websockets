
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

    // single player doesn't use AcceptJoin or AskJoin
    if (msg === Msg.AcceptJoin || msg === Msg.AskJoin) {
      return;
    }

    const cb = this.onHandlerMap[msg];
    if (cb) {
      cb(data);
    }
  }
}

class Paddle {
  x: number;
  y: number;
  deltaY: number;
  direction: Direction;
  el: HTMLElement;

  constructor(x: number, y: number, deltaY: number, direction: Direction, id: string) {
    this.x = x;
    this.y = y;
    this.deltaY = deltaY;
    this.direction = direction;
    this.el = document.getElementById(id) || dummy;
  }

  get isIdle() : boolean {
    return this.direction === Direction.Idle;
  }
  get isGoingUp() : boolean {
    return this.direction === Direction.Up;
  }
  get isGoingDown() : boolean {
    return this.direction === Direction.Down;
  }
  get leftBorder() : number { return this.x; }
  get rightBorder() : number { return this.x + paddleWidth; }
  get topBorder() : number { return this.y; }
  get bottomBorder() : number { return this.y + paddleHeight; }

  updatePosition() {
    if (this.isIdle) {
      return;
    }

    const deltaY = this.isGoingDown ? paddleDeltaY : -paddleDeltaY; 
    this.y += deltaY;
    this.el.setAttribute('y', s(this.y));
  }
}

enum PlayerIds {
  Bot = 'BOT',
  Creator = 'CREATOR',
  Guest = 'GUEST',
}

let playerId: PlayerIds;
let isMultiplayerGameToJoin = false;

// constants
const svgHeight = 400;
const svgWidth = 600;
const paddleDeltaY = 6;
const paddleWidth = 10;
const paddleHeight = 40;

const leftPaddle = new Paddle(50, 100, 0, Direction.Idle, 'left-paddle');
const rightPaddle = new Paddle(550, 50, 0, Direction.Idle, 'right-paddle');
let myPaddle = leftPaddle;
let oppPaddle = rightPaddle;

// ball = radius should match what's inside index.html
let ballRadius = 6;
let ballX = 225;
let ballY = 50;
let ballDeltaX = 7;
let ballDeltaY = 5;

// dom elements
const dummy = document.createElement('form')
const singlePlayerBtn = document.querySelector('button[name=singleplayer]') || dummy;
const multiPlayerBtn = document.querySelector('button[name=multiplayer]') || dummy;
const joinBtn = document.querySelector('button[name=join]') || dummy;
const submitBtn = document.querySelector('button[type=submit]') || dummy;
const board = document.getElementById('board') || dummy;
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
type GetIsCollisionArgType = {ballX: number, ballY: number, paddle: Paddle};
const getIsCollision = ({ballX, ballY, paddle}: GetIsCollisionArgType) => {
  const ballLeftMost = ballX - ballRadius;
  const ballRightMost = ballX + ballRadius;
  const ballTopMost = ballY + ballRadius;
  const ballBottomMost = ballY - ballRadius;
  const doesBallRightOverlap = isPointWithinRange(ballRightMost, paddle.leftBorder, paddle.rightBorder);
  const doesBallLeftOverlap = isPointWithinRange(ballLeftMost, paddle.leftBorder, paddle.rightBorder);
  const doesBallTopOverlap = isPointWithinRange(ballTopMost, paddle.topBorder, paddle.bottomBorder);
  const doesBallBottomOverlap = isPointWithinRange(ballBottomMost, paddle.topBorder, paddle.bottomBorder);
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
leftPaddle.el.setAttribute('x', s(leftPaddle.x));
leftPaddle.el.setAttribute('y', s(leftPaddle.y));
rightPaddle.el.setAttribute('x', s(rightPaddle.x));
rightPaddle.el.setAttribute('y', s(rightPaddle.y));
ball.setAttribute('cx', s(ballX));
ball.setAttribute('cy', s(ballY));
singlePlayerBtn.addEventListener('click', createNewSinglePlayerGame);
multiPlayerBtn.addEventListener('click', multiPlayerGame);
joinBtn.addEventListener('click', joinGame);

const setPaddleDirections = () => {
  // our paddle
  if (isPaddleTooHigh(myPaddle.y)) {
    myPaddle.direction = Direction.Down;
  } else if (isPaddleTooLow(myPaddle.y)) {
    myPaddle.direction = Direction.Up;
  }
  
  // opponent's paddle
  if (isPaddleTooHigh(oppPaddle.y)) {
    oppPaddle.direction = Direction.Down;
  } else if (isPaddleTooLow(oppPaddle.y)) {
    oppPaddle.direction = Direction.Up;
  }
}

const setPaddlePositions = () => {
  myPaddle.updatePosition();
  oppPaddle.updatePosition();
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
    
    const {isCollision} = getIsCollision({ballX, ballY, paddle: myPaddle});
    const {isCollision: isBotCollision} = getIsCollision({ballX, ballY, paddle: oppPaddle});

    // we always broadcast our collisions. if it's singlePlayer we also broadcast bot collisions
    if (isCollision) {
      ballDeltaX = -ballDeltaX;
      socketEmit<CollisionPayloadType>(Msg.ChangeBallDirection, {playerId, deltaX: ballDeltaX, deltaY: ballDeltaY, ballX, ballY, paddleY: myPaddle.y});
    } else if (!isMultiplayer && isBotCollision) {
      ballDeltaX = -ballDeltaX;
      socketEmit<CollisionPayloadType>(Msg.ChangeBallDirection, {playerId: PlayerIds.Bot, deltaX: ballDeltaX, deltaY: ballDeltaY, ballX, ballY, paddleY: oppPaddle.y});
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

    if (isBallGoingUp && (oppPaddle.isIdle || oppPaddle.isGoingDown)) {
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId: PlayerIds.Bot, direction: Direction.Up})
    } else if (isBallGoingDown && (oppPaddle.isIdle || oppPaddle.isGoingUp)) {
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId: PlayerIds.Bot, direction: Direction.Down})
    }
  }, 50);
}

function subscribe() {
  socketOn<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, function syncServer(data) {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      oppPaddle.direction = data.direction;
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
      oppPaddle.y = data.paddleY;
    }
  });
  
  socketOn<JoinPayloadType>(Msg.AcceptJoin, (data) => {
    const isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      clearInterval(waitingForOpponentIntervalId)
    } else {
      // since we joined the game. give us control of the right paddle
      myPaddle = rightPaddle;
      oppPaddle = leftPaddle;
    }
  
    startGame();
  });
  
  // socketOn<JoinPayloadType>(Msg.AskJoin, (data) => {
  //   const isFromOtherPlayer = data.playerId !== playerId;
  
  //   if (isFromOtherPlayer) {
  //     isMultiplayerGameToJoin = true;
  //   }
  // })
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

    const isUpdateDirection = direction !== myPaddle.direction;

    if (isUpdateDirection) {
      myPaddle.direction = direction;
      socketEmit<ChangePaddleDirectionPayloadType>(Msg.ChangePaddleDirection, {playerId, direction})
    }
  });
}

const startGame = () => {
  enableGameControls();
  enableGameLoop();
}


// TODO hardcode this for now
let isMultiplayer = false;

function disableCreateButtons() {
  singlePlayerBtn.setAttribute('disabled', 'true');
  multiPlayerBtn.setAttribute('disabled', 'true');
  joinBtn.setAttribute('disabled', 'true');
}

function createNewSinglePlayerGame(e: Event) {
  playerId = PlayerIds.Creator;

  if (socket) {
    return;
  }

  initBotSocket();
  enableGameControls();
  enableGameLoop();
  enableBotLoop();
  disableCreateButtons();
}

function multiPlayerGame(e: Event) {
  playerId = PlayerIds.Creator;
  isMultiplayer = true;

  if (socket) {
    return;
  }

  initSocket();
  disableCreateButtons();

  // broadcast that we need an opponent for our new game
  waitingForOpponentIntervalId = window.setInterval(() => {
    socketEmit<JoinPayloadType>(Msg.AskJoin, {playerId})
  }, 250);
}

function joinGame() {
  playerId = PlayerIds.Guest;
  isMultiplayer = true;

  if (!socket) {
    initSocket();
  }
  disableCreateButtons();
  socketEmit<JoinPayloadType>(Msg.AcceptJoin, {playerId})
}