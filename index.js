const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
});

app.listen(3000, () => {
  console.log('listening on port :3000')
})