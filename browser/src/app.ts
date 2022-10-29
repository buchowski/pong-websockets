
var socket = io();  
let playerId;

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
const form = document.querySelector('form');
const submitBtn = document.querySelector('button[type=submit]')
const board = document.getElementById('board');
let leftPaddle = document.getElementById('left-paddle');
let rightPaddle = document.getElementById('right-paddle');

// helpers
const isTooHigh = y => y <= 0;
const isTooLow = y => y + 40 >= svgHeight;
const socketOn = (msg, cb) => {
  socket.on(msg, (data) => {
    console.log(`received ${msg} message from ${data.playerId}`);

    cb(data);
  })
}

// other
let waitingForOpponentIntervalId;

// initialize
board.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
leftPaddle.setAttribute('x', leftX);
leftPaddle.setAttribute('y', leftY);
rightPaddle.setAttribute('x', rightX);
rightPaddle.setAttribute('y', rightY);

// emit websocket msg if ball pos has changed
const enableGameLoop = () => {
  setInterval(emitMessageLoop = () => {
    // always update the opponent's paddle pos
    rightPaddle.setAttribute('y', rightY);

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
    leftPaddle.setAttribute('y', leftY);

    socket.emit('ballMove', {playerId, y: leftY});
  }, 50);
}

let isFromOtherPlayer;
socketOn('ballMove', function syncServer(data) {
  isFromOtherPlayer = data.playerId !== playerId;

  if (isFromOtherPlayer) {
    rightY = data.y;
  }
});

let beginGameWithOpponent;
socketOn('joinGame', (data) => {
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
socketOn('waitingForOpponent', (data) => {
  isAskToJoin = data.playerId !== playerId;

  if (isAskToJoin) {
    submitBtn.innerHTML = `Join ${data.playerId}'s Game`
    form.removeEventListener('submit', createNewGame);
    form.addEventListener('submit', joinGame);
  }
})

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

function joinGame(e) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = playerName;

  socket.emit('joinGame', {playerId})
}

function createNewGame(e) {
  e.preventDefault();
  const formData = new FormData(form);
  const playerName = formData.get('player-name')

  playerId = playerName;

  // broadcast that we need an opponent for our new game
  waitingForOpponentIntervalId = setInterval(() => {
    socket.emit('waitingForOpponent', {playerId})
  }, 250);
}