// Automatically determine the WebSocket URL based on the current location
const socketProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
const socketUrl = socketProtocol + window.location.host;
const ws = new WebSocket(socketUrl);  // Define the WebSocket connection
let userName = localStorage.getItem('userName');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const leaveButton = document.getElementById('leaveButton');
const chatArea = document.getElementById('chatArea');
const statusMessage = document.getElementById('statusMessage');
const onlineCount = document.getElementById('onlineCount');

// Prompt user for name if not set in local storage
if (!userName) {
  while (!userName) {
    userName = prompt('Enter your name to join the chat:');
  }
  localStorage.setItem('userName', userName);
}

// Function to send a message
function sendMessage(message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', message }));
    displayMessage(`You: ${message}`);
    messageInput.value = '';
    console.log(`Sent message: ${message}`);
  } else {
    console.log('WebSocket not open. Cannot send message.');
  }
}

// Function to handle WebSocket messages
ws.onmessage = (event) => {
  console.log(`Message received from server: ${event.data}`);
  const data = JSON.parse(event.data);

  if (data.type === 'info') {
    statusMessage.textContent = data.message;
  } else if (data.type === 'partner') {
    statusMessage.textContent = data.message;
  } else if (data.type === 'chat') {
    console.log(`Processing chat message: ${data.message}`);
    // console.log('data:',data);
    displayMessage(data.message);
  } else if (data.type === 'onlineCount') {
    onlineCount.textContent = `Online users: ${data.count}`;
  }
};

// WebSocket open event handler
ws.onopen = () => {
  console.log('WebSocket connection opened.');
  ws.send(JSON.stringify({ type: 'setName', name: userName }));
};

// WebSocket error event handler
ws.onerror = (error) => {
  console.error(`WebSocket error: ${error}`);
};

// WebSocket close event handler
ws.onclose = () => {
  console.log('WebSocket connection closed.');
};

// Send message on button click
sendButton.addEventListener('click', () => {
  const message = messageInput.value;
  if (message) {
    sendMessage(message);
  }
});

// Leave the chat on button click
leaveButton.addEventListener('click', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leaveChat' }));
    localStorage.removeItem('userName'); // Clear the username from local storage
    console.log('User requested to leave the chat.');
  }
});

// Display message in chat area
function displayMessage(message) {
  const existingMessages = chatArea.getElementsByTagName('p');
  
  // Check if the message already exists
  for (const p of existingMessages) {
    if (p.textContent === message) {
      console.log(`Duplicate message detected: ${message}`);
      return; // Exit if duplicate found
    }
  }
  
  const p = document.createElement('p');
  p.textContent = message;
  chatArea.appendChild(p);
  console.log(`Displayed message: ${message}`);
}
