const { createServer } = require("http");
const express = require('express');
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // options
});

io.on("connection", (socket) => {
  console.log('we are connected')

  socket.on('ballMove', (data) => {
    console.log('ballMove message: ' + data);
    io.emit('ballMove', data);
  });

  socket.on('waitingForOpponent', (data) => {
    console.log('waiting message: ' + data);
    io.emit('waitingForOpponent', data);
  });

  socket.on('joinGame', (data) => {
    console.log('join message: ' + data);
    io.emit('joinGame', data);
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