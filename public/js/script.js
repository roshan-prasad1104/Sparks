const socket = io('http://localhost:3000');

// State
let roomCode = null;
let currentMode = '';
let isFlipped = false;
let playerName = '';
let partnerName = 'Partner';
let isMyTurn = false;
let isHost = false;

function applyTurnState(turnData) {
  isMyTurn = (socket.id === turnData.turnId);
  const cardFrontText = document.querySelector('.flip-card-front h3');
  
  if (isMyTurn) {
    if (currentMode === 'trivia') {
      cardFrontText.innerText = "Your Turn!\nWrite a question below.";
      card.style.cursor = 'default';
    } else {
      cardFrontText.innerText = "Your Turn! Tap to draw";
      card.style.cursor = 'pointer';
    }
  } else {
    if (currentMode === 'trivia') {
      cardFrontText.innerText = turnData.turnName + " is writing a question...";
    } else {
      cardFrontText.innerText = turnData.turnName + "'s Turn!";
    }
    card.style.cursor = 'default';
  }

  // Update Custom Trivia Question Box visibility
  const customSec = document.getElementById('custom-question-section');
  const divider = document.getElementById('custom-q-divider');
  if (isMyTurn && !isFlipped && currentMode === 'trivia') {
    customSec.style.display = 'block';
    if (divider) divider.style.display = 'none'; // hide OR since it's the only option
    document.getElementById('custom-question-input').value = '';
  } else {
    customSec.style.display = 'none';
  }
}

function askCustomQuestion() {
  const customQ = document.getElementById('custom-question-input').value.trim();
  if (!customQ) {
    alert("Please write a question first!");
    return;
  }
  socket.emit('custom-flip', { code: roomCode, question: customQ });
}

// DOM Elements
const signupScreen = document.getElementById('signup-screen');
const authLoginScreen = document.getElementById('auth-login-screen');
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const modeTitle = document.getElementById('mode-title');
const card = document.getElementById('card');
const questionText = document.getElementById('question-text');
const nextBtn = document.getElementById('next-btn');
const roomInfo = document.getElementById('room-info');
const myRoomCodeMsg = document.getElementById('my-room-code');
const waitingMsg = document.getElementById('waiting-msg');
const joinCodeInput = document.getElementById('join-code');
const lobbyGreeting = document.getElementById('lobby-greeting');
const connectedMsg = document.getElementById('connected-msg');

// --- Helper UI functions ---

function doNameEntry() {
  const nameInput = document.getElementById('player-name-input').value.trim();
  if (!nameInput) {
    alert("Please enter a name");
    return;
  }
  playerName = nameInput;
  lobbyGreeting.innerText = "Welcome, " + playerName + "!";
  socket.emit('set-name', playerName);
  switchScreen(nameScreen, lobbyScreen);
}

function switchScreen(hideElement, showElement) {
  hideElement.classList.remove('active');
  setTimeout(() => {
    hideElement.style.display = 'none';
    showElement.style.display = 'flex';
    setTimeout(() => showElement.classList.add('active'), 50);
  }, 500);
}

function updateCardSide(flip) {
  if (flip) {
    card.classList.add('flipped');
    nextBtn.disabled = false;
  } else {
    card.classList.remove('flipped');
    nextBtn.disabled = true;
    setTimeout(() => {
      questionText.innerText = "Question goes here...";
    }, 400);
  }
  isFlipped = flip;
}

// --- Local Actions ---

function createRoom() {
  socket.emit('create-room');
}

function joinRoom() {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (code.length === 4) {
    socket.emit('join-room', code);
  } else {
    alert("Please enter a valid 4-letter code.");
  }
}

function selectMode(mode) {
  socket.emit('select-mode', { code: roomCode, mode: mode });
}

function reqFlipCard() {
  if (isFlipped) return;
  if (!isMyTurn) {
    alert("It's not your turn right now!");
    return;
  }
  if (currentMode === 'trivia') {
    alert("In Trivia, you must type your question in the box below instead of tapping!");
    return;
  }
  socket.emit('flip-card', roomCode);
}

function reqNextCard() {
  if (!isFlipped) return;
  socket.emit('next-card', roomCode);
}

function submitAnswer() {
  const answer = document.getElementById('player-answer').value.trim();
  if (!answer) {
    alert("Please type something first!");
    return;
  }
  socket.emit('submit-answer', { code: roomCode, answer: answer });
}

function returnToMenu() {
  socket.emit('return-menu', roomCode);
}

// --- Socket Listeners ---

socket.on('error-msg', (msg) => {
  alert(msg);
});

socket.on('room-created', (code) => {
  roomCode = code;
  isHost = true;
  roomInfo.style.display = 'block';
  myRoomCodeMsg.innerText = code;
  document.querySelector('.lobby-controls').style.display = 'none';
  
  // Auto-copy the code as soon as it's generated
  copyToClipboard(code).then(() => {
    alert("Room created! Code " + code + " has been auto-copied to your clipboard.");
  });
});

socket.on('room-joined', (code) => {
  roomCode = code;
  isHost = false;
  waitingMsg.innerText = "Successfully joined room!";
});

socket.on('players-ready', () => {
  if (!isHost) {
    document.getElementById('game-modes-container').style.display = 'none';
    document.getElementById('guest-waiting-msg').style.display = 'block';
    document.getElementById('connected-msg').innerText = "Partner connected!";
  } else {
    document.getElementById('game-modes-container').style.display = 'flex';
    document.getElementById('guest-waiting-msg').style.display = 'none';
    document.getElementById('connected-msg').innerText = "Partner connected! Choose a mode:";
  }
  switchScreen(lobbyScreen, menuScreen);
});

socket.on('mode-started', (data) => {
  currentMode = data.mode;
  
  if (data.mode === 'truth') modeTitle.innerText = 'Deep Truths';
  else if (data.mode === 'dare') modeTitle.innerText = 'Playful Dares';
  else if (data.mode === 'trivia') modeTitle.innerText = 'Better Half Trivia';

  applyTurnState(data);
  updateCardSide(false);
  switchScreen(menuScreen, gameScreen);
});

socket.on('card-flipped', (question) => {
  questionText.innerText = question;
  updateCardSide(true);
  
  // Hide custom question field
  document.getElementById('custom-question-section').style.display = 'none';

  // Show answer section
  document.getElementById('answer-section').style.display = 'block';
  
  if (currentMode === 'trivia' && isMyTurn) {
    document.getElementById('submit-answer-btn').style.display = 'none';
    document.getElementById('player-answer').style.display = 'none';
    document.getElementById('answer-status-msg').style.display = 'block';
    document.getElementById('answer-status-msg').innerText = "Waiting for partner to answer...";
  } else {
    document.getElementById('submit-answer-btn').style.display = 'inline-block';
    document.getElementById('player-answer').style.display = 'inline-block';
    document.getElementById('player-answer').value = '';
    document.getElementById('answer-status-msg').style.display = 'none';
  }
  
  document.getElementById('revealed-answers').style.display = 'none';
});

socket.on('waiting-for-partner', () => {
  document.getElementById('submit-answer-btn').style.display = 'none';
  document.getElementById('player-answer').style.display = 'none';
  document.getElementById('answer-status-msg').style.display = 'block';
  document.getElementById('answer-status-msg').innerText = "Waiting for partner...";
});

socket.on('partner-answered', () => {
  document.getElementById('answer-status-msg').style.display = 'block';
  if (document.getElementById('submit-answer-btn').style.display !== 'none') {
    document.getElementById('answer-status-msg').innerText = "Partner has answered!";
  }
});

socket.on('answers-revealed', (answersList) => {
  document.getElementById('submit-answer-btn').style.display = 'none';
  document.getElementById('player-answer').style.display = 'none';
  document.getElementById('answer-status-msg').style.display = 'none';
  
  const revealedSec = document.getElementById('revealed-answers');
  revealedSec.style.display = 'block';
  
  document.getElementById('p1-answer').innerText = answersList[0] ? answersList[0].name + ": " + answersList[0].text : "";
  document.getElementById('p2-answer').innerText = answersList[1] ? answersList[1].name + ": " + answersList[1].text : "";
});

socket.on('next-card-ready', (turnData) => {
  updateCardSide(false);
  applyTurnState(turnData);
  document.getElementById('answer-section').style.display = 'none';
});

socket.on('back-to-menu', () => {
  switchScreen(gameScreen, menuScreen);
  updateCardSide(false);
});

socket.on('partner-disconnected', () => {
  alert("Your partner disconnected.");
  // Restart app state
  roomCode = null;
  location.reload();
});

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for non-secure contexts (HTTP over IP)
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((res, rej) => {
      document.execCommand('copy') ? res() : rej();
      textArea.remove();
    });
  }
}

function shareRoomLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  
  copyToClipboard(url.toString()).then(() => {
    alert("Room link copied to clipboard! Share it with your partner.");
  }).catch(err => {
    alert("Room link: " + url.toString());
  });
}

function copyRoomCode() {
  if (!roomCode) return;
  copyToClipboard(roomCode).then(() => {
    alert("Room code " + roomCode + " copied to clipboard!");
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}

// Check for room code in URL on load
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    if (joinCodeInput) {
      joinCodeInput.value = roomParam.toUpperCase();
    }
  }
});
