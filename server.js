const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Set up Pug for the template engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Render the main page
app.get('/', (req, res) => {
  res.render('index');
});

// Start Express server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://${server.address().address}:${port}`);
});
  

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let waitingUsers = []; // Users waiting for a partner
let activePairs = []; // Active pairs of users
let allUsers = [];    // All connected users

// Broadcast message to all connected users
function broadcastMessage(message) {
  allUsers.forEach((user) => {
    if (user.readyState === WebSocket.OPEN) {
      user.send(JSON.stringify(message));
    }
  });
  console.log(`Broadcast message: ${JSON.stringify(message)}`);
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  let currentUser = { ws, name: null };

  allUsers.push(ws);
  console.log(`New connection. Total users: ${allUsers.length}`);
  updateOnlineCount();

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
    const data = JSON.parse(message);

    if (data.type === 'setName') {
      currentUser.name = data.name;
      console.log(`User ${data.name} joined`);

      ws.send(JSON.stringify({ type: 'info', message: `Welcome ${data.name}! Waiting for a partner...` }));

      if (waitingUsers.length > 0) {
        const partnerIndex = Math.floor(Math.random() * waitingUsers.length);
        const partner = waitingUsers.splice(partnerIndex, 1)[0];
        activePairs.push({ user1: currentUser.ws, user2: partner.ws });

        console.log(`Pairing ${data.name} with ${partner.name}`);
        currentUser.ws.send(JSON.stringify({ type: 'partner', message: `Partner connected: ${partner.name}` }));
        partner.ws.send(JSON.stringify({ type: 'partner', message: `Partner connected: ${currentUser.name}` }));

        setupMessageRelay(currentUser.ws, partner.ws);

      } else {
        waitingUsers.push(currentUser);
        ws.send(JSON.stringify({ type: 'info', message: 'Waiting for a stranger to join...' }));
      }
    }

    if (data.type === 'leaveChat') {
      handleLeaveChat(currentUser.ws);
    }

    if (data.type === 'chat') {
      const pair = activePairs.find(p => p.user1 === currentUser.ws || p.user2 === currentUser.ws);
      if (pair) {
        const partner = pair.user1 === currentUser.ws ? pair.user2 : pair.user1;
        if (partner.readyState === WebSocket.OPEN) {
          // Send message in format: { type: 'chat', userName: 'name', message: 'content' }
          partner.send(JSON.stringify({ type: 'chat', userName: currentUser.name, message: data.message }));
        }
      }
    }
  });

  ws.on('close', () => {
    console.log(`Connection closed. User left.`);
    handleDisconnection(currentUser.ws);
    allUsers = allUsers.filter(user => user !== ws);
    updateOnlineCount();
  });
});

// Function to relay messages between two users in a pair
function setupMessageRelay(user1, user2) {
  user1.on('message', (message) => {
    console.log(`Message from user1: ${message}`);
    const data = JSON.parse(message);
    if (user2.readyState === WebSocket.OPEN && data.type === 'chat') {
      user2.send(JSON.stringify({ type: 'chat', userName: data.userName, message: data.message }));
      console.log(`Relayed message to user2: ${data.message}`);
    }
  });

  user2.on('message', (message) => {
    console.log(`Message from user2: ${message}`);
    const data = JSON.parse(message);
    if (user1.readyState === WebSocket.OPEN && data.type === 'chat') {
      user1.send(JSON.stringify({ type: 'chat', userName: data.userName, message: data.message }));
      console.log(`Relayed message to user1: ${data.message}`);
    }
  });
}

// Handle a user leaving the current chat
function handleLeaveChat(user) {
  const pairIndex = activePairs.findIndex(pair => pair.user1 === user || pair.user2 === user);
  if (pairIndex !== -1) {
    const pair = activePairs[pairIndex];
    const partner = pair.user1 === user ? pair.user2 : pair.user1;

    activePairs.splice(pairIndex, 1);

    console.log(`User left the chat. Pair removed.`);
    if (partner.readyState === WebSocket.OPEN) {
      waitingUsers.push({ ws: partner, name: partner.name });
      partner.send(JSON.stringify({ type: 'info', message: 'Your partner left. Waiting for a new user...' }));
    }

    waitingUsers.push({ ws: user, name: user.name });
    user.send(JSON.stringify({ type: 'info', message: 'You left the chat. Waiting for a new user...' }));
  }
}

// Handle disconnection and manage the waiting queue
function handleDisconnection(user) {
  activePairs = activePairs.filter(pair => pair.user1 !== user && pair.user2 !== user);
  waitingUsers = waitingUsers.filter(waiting => waiting.ws !== user);
  console.log(`User disconnected. Waiting list updated.`);
}

// Update and broadcast the number of online users
function updateOnlineCount() {
  const count = allUsers.length;
  broadcastMessage({ type: 'onlineCount', count });
  console.log(`Online users count updated: ${count}`);
}
