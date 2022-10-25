const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send('<h1>hello world</h1>')
});

app.listen(3000, () => {
  console.log('listening on port :3000')
})