// Primary backend application entry point configuring Express, WebSockets, and database connection
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const RulesEngine = require('./services/RulesEngine');
const createApiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Socket.IO configuration for live real-time dashboard notifications
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

// Middleware stack
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Parses authentication cookie header into req.cookies object
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const [key, val] = c.trim().split('=');
      if (key && val) req.cookies[key] = decodeURIComponent(val);
    });
  }
  next();
});

// Initialize Rules Engine with WebSockets
const rulesEngine = new RulesEngine(io);

// Mount API routes
app.use('/api', createApiRoutes(rulesEngine));

// Serve Client Web Application static files
const clientPublicPath = path.join(__dirname, '../../client/public');
app.use(express.static(clientPublicPath));

// Fallback to client index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(clientPublicPath, 'index.html'));
});

// Broadcasts client connection events on WebSocket feed
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5001;

// Connects to MongoDB and starts the HTTP and WebSocket server
async function startServer() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 DECEPTIGUARD RUNNING ON PORT ${PORT}`);
    console.log(`🌐 Web App: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

startServer();

module.exports = { app, server, rulesEngine };
