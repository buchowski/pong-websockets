# pong-websockets
A one or two player pong game implemented in TypeScript and WebSockets

## Game controls
* Use `w, s, d` (up, down, idle) to control your paddle
* Check "bot mode" if you want a bot to control your paddle for you

## How to run
1. `git clone https://github.com/buchowski/pong-websockets`
2. `cd pong-websockets/`
3. `npm install`
4. `nodemon index.js` or `node index.js` to start server
5. `npm run dev` to watch for `app.ts` changes
6. Game is served at `localhost:3000`

## How to start game

### Singleplayer
1. Open `localhost:3000` in your browser
2. Choose Singleplayer

### Multiplayer
1. Open `localhost:3000` in your browser
2. Choose Multiplayer -> New Multiplayer Game
3. In a new browser tab open `localhost:3000`
4. Choose Multiplayer - Join Multiplayer Game
5. Game will start immediately. The game creator controls the left paddle. The joiner controls the right paddle.

![typescript_websocket_pong_game](https://user-images.githubusercontent.com/3952624/200149446-9b912d61-094e-4d42-8fbc-2b98d8e9b97e.PNG)
