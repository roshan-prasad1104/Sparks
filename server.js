const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const path = require('path');
const questionsDB = require('./server_logic/questions');
const { setupAuthRoutes } = require('./server_logic/authController');

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Enable CORS for API routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});

// Setup Auth Routes
setupAuthRoutes(app);

// State to track rooms
const rooms = {};

// Helper function to generate room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('set-name', (name) => {
    socket.playerName = name;
  });

  socket.on('create-room', () => {
    const code = generateRoomCode();
    rooms[code] = {
      players: [{ id: socket.id, name: socket.playerName || "Player 1" }],
      deck: [],
      mode: null,
      isFlipped: false,
      answers: {}
    };
    socket.join(code);
    socket.emit('room-created', code);
  });

  socket.on('join-room', (code) => {
    code = code.toUpperCase();
    if (rooms[code]) {
      if (rooms[code].players.length >= 2) {
        socket.emit('error-msg', 'Room is full!');
      } else {
        rooms[code].players.push({ id: socket.id, name: socket.playerName || "Player 2" });
        socket.join(code);

        socket.emit('room-joined', code);
        // Let everyone in the room know it's ready, and pass their partner's name
        io.to(code).emit('players-ready', rooms[code].players);
      }
    } else {
      socket.emit('error-msg', 'Invalid room code!');
    }
  });

  socket.on('select-mode', ({ code, mode }) => {
    if (rooms[code]) {
      rooms[code].mode = mode;
      rooms[code].deck = shuffleArray(questionsDB[mode]);
      rooms[code].isFlipped = false;
      rooms[code].answers = {};
      rooms[code].turnIndex = 0; // index of whose turn it is

      io.to(code).emit('mode-started', {
        mode: mode,
        turnId: rooms[code].players[0].id,
        turnName: rooms[code].players[0].name
      });
    }
  });

  socket.on('flip-card', (code) => {
    if (rooms[code] && !rooms[code].isFlipped) {
      // Check if it's their turn
      const currentTurnId = rooms[code].players[rooms[code].turnIndex]?.id;
      if (socket.id !== currentTurnId) return; // ignore if not their turn

      rooms[code].answers = {};
      if (rooms[code].deck.length === 0) {
        if (rooms[code].mode === 'trivia') {
           io.to(code).emit('card-flipped', "No built-in trivia questions left. Use the box below to ask your own!");
        } else {
           io.to(code).emit('card-flipped', "You've gone through all questions! Take it to the bedroom. 😉");
        }
      } else {
        const question = rooms[code].deck.pop();
        rooms[code].isFlipped = true;
        io.to(code).emit('card-flipped', question);
      }
    }
  });

  socket.on('custom-flip', ({ code, question }) => {
    if (rooms[code] && !rooms[code].isFlipped) {
      const currentTurnId = rooms[code].players[rooms[code].turnIndex]?.id;
      if (socket.id !== currentTurnId) return; // ignore if not their turn

      rooms[code].answers = {};
      rooms[code].isFlipped = true;
      io.to(code).emit('card-flipped', question);
    }
  });

  socket.on('submit-answer', ({ code, answer }) => {
    if (rooms[code]) {
      rooms[code].answers[socket.id] = { name: socket.playerName || "Player", text: answer };
      const answeredPlayers = Object.keys(rooms[code].answers);
      
      let neededAnswers = rooms[code].players.length;
      if (rooms[code].mode === 'trivia') {
        neededAnswers = 1;
      }

      if (answeredPlayers.length >= neededAnswers) {
        // Broadcast answers
        const answersList = Object.values(rooms[code].answers);
        io.to(code).emit('answers-revealed', answersList);
      } else {
        // One answered, notify the others
        socket.emit('waiting-for-partner');
        socket.to(code).emit('partner-answered');
      }
    }
  });

  socket.on('next-card', (code) => {
    if (rooms[code]) {
      // Advance turn
      rooms[code].turnIndex = (rooms[code].turnIndex + 1) % rooms[code].players.length;
      rooms[code].isFlipped = false;
      rooms[code].answers = {};

      io.to(code).emit('next-card-ready', {
        turnId: rooms[code].players[rooms[code].turnIndex].id,
        turnName: rooms[code].players[rooms[code].turnIndex].name
      });
    }
  });

  socket.on('return-menu', (code) => {
    if (rooms[code]) {
      rooms[code].mode = null;
      io.to(code).emit('back-to-menu');
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // If user was in a room, notify the other person
    for (const code in rooms) {
      if (rooms[code].players.some(p => p.id === socket.id)) {
        rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
        if (rooms[code].players.length === 0) {
          delete rooms[code];
        } else {
          io.to(code).emit('partner-disconnected');
        }
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Game server running on http://localhost:${PORT}`);
});
