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

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    io.emit('chat response', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
});

httpServer.listen(3000);