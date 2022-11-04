const { createServer } = require("http");
const express = require('express');
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // options
});

// msgs
const AskJoin = 'ASK_JOIN';
const AcceptJoin = 'ACCEPT_JOIN';
const ChangePaddleDirection = 'CHANGE_PADDLE_DIRECTION';
const ChangeBallDirection = 'CHANGE_BALL_DIRECTION';

io.on("connection", (socket) => {
  console.log('we are connected')

  socket.on(ChangeBallDirection, (data) => {
    console.log('ballMove message: ' + data);
    io.emit(ChangeBallDirection, data);
  });

  socket.on(AskJoin, (data) => {
    console.log('waiting message: ' + data);
    io.emit(AskJoin, data);
  });

  socket.on(AcceptJoin, (data) => {
    console.log('join message: ' + data);
    io.emit(AcceptJoin, data);
  });

  socket.on(ChangePaddleDirection, (data) => {
    console.log('change paddle message: ' + data);
    io.emit(ChangePaddleDirection, data);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
});

app.use(express.static('public'))

httpServer.listen(3000);