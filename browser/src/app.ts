type WsBaseDataType = {
  playerId: string;
}

type WsBallMoveType = WsBaseDataType & {
  y: number;
}

type SocketType = {
  on: any;
  emit: any;
}

var socket: SocketType;

function initSocket(io: any) {
  socket = io();
  subscribe();
}

let playerId: string;

// constants
const UP = 'UP';
const DOWN = 'DOWN';
const IDLE = 'IDLE';
const svgHeight = 400;
const svgWidth = 600;
const deltaUnit = 3;

// leftPaddle
let leftX = 50;
let leftY = 100;
let deltaY = 0;
let paddleDirection = IDLE;

// rightPaddle
let rightX = 500;
let rightY = 50;

// dom elements
const dummy = document.createElement('form')
const form = document.querySelector('form') || dummy;
const submitBtn = document.querySelector('button[type=submit]') || dummy;
const board = document.getElementById('board') || dummy;
let leftPaddle = document.getElementById('left-paddle') || dummy;
let rightPaddle = document.getElementById('right-paddle') || dummy;

// helpers
const s = (n: any) => String(n)
const isTooHigh = (y: number) => y <= 0;
const isTooLow = (y: number) => y + 40 >= svgHeight;
function socketOn<T extends {playerId: string}>(msg: string, cb: (data: T) => void): void {
  socket.on(msg, (data: T) => {
    console.log(`received ${msg} message from ${data.playerId}`);

    cb(data);
  })
}

// other
let waitingForOpponentIntervalId: number;

// initialize
board.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
leftPaddle.setAttribute('x', s(leftX));
leftPaddle.setAttribute('y', s(leftY));
rightPaddle.setAttribute('x', s(rightX));
rightPaddle.setAttribute('y', s(rightY));

// emit websocket msg if ball pos has changed
const enableGameLoop = () => {
  setInterval(function emitMessageLoop() {
    // always update the opponent's paddle pos
    rightPaddle.setAttribute('y', s(rightY));

    if (paddleDirection === IDLE) {
      return;
    }

    if (isTooHigh(leftY)) {
      paddleDirection = DOWN;
    } else if (isTooLow(leftY)) {
      paddleDirection = UP;
    }

    deltaY = paddleDirection === DOWN ? deltaUnit : -deltaUnit; 
    leftY += deltaY;
    leftPaddle.setAttribute('y', s(leftY));

    socket.emit('ballMove', {playerId, y: leftY});
  }, 50);
}

function subscribe() {
  let isFromOtherPlayer;
  socketOn<WsBallMoveType>('ballMove', function syncServer(data) {
    isFromOtherPlayer = data.playerId !== playerId;
  
    if (isFromOtherPlayer) {
      rightY = data.y;
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

form.addEventListener('submit', createNewGame);

function joinGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = s(playerName);

  socket.emit('joinGame', {playerId})
}

function createNewGame(e: Event) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = s(playerName);

  // broadcast that we need an opponent for our new game
  waitingForOpponentIntervalId = window.setInterval(() => {
    socket.emit('waitingForOpponent', {playerId})
  }, 250);
}