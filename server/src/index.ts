import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import apiRoutes from './routes/api.js';

dotenv.config();

// Connect to MongoDB Atlas Cloud Vault
console.log("Attempting to connect to MongoDB...");

mongoose.connect(process.env.MONGO_URI as string)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
  })
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message);
  });

const app = express();

// =========================================================================
// CORS POLICY
// =========================================================================
const isProduction = process.env.NODE_ENV === 'production';

const STATIC_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean); // Filters out undefined if FRONTEND_URL isn't set

// Automatically allow ANY Vercel deployment URL (*.vercel.app)
const VERCEL_ORIGIN_REGEX = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;

// Matches any http://<local-lan-ip>:5173 address (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const LOCAL_LAN_ORIGIN_REGEX = /^http:\/\/((192\.168|10)\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$/;

const corsOriginCheck = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow non-browser requests with no Origin header
  if (!origin) return callback(null, true);

  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

  if (VERCEL_ORIGIN_REGEX.test(origin)) return callback(null, true);

  if (!isProduction && LOCAL_LAN_ORIGIN_REGEX.test(origin)) return callback(null, true);

  console.warn(`🚫 CORS blocked request from origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'));
};

const corsOptions: cors.CorsOptions = {
  origin: corsOriginCheck,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors(corsOptions));

// Populates req.auth on every request (signed-in or not) by reading Clerk's session
// cookie/token. Routes stay PUBLIC by default even with this mounted — it's requireAuth()
// and requireRole() inside api.ts that actually lock a given route down. This just makes
// getAuth(req) available everywhere, including on the public patient-facing routes (where
// it will simply report "not signed in", which those routes ignore).
// Requires CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY in your .env.
app.use(clerkMiddleware());

// Health-check / sanity route. Hitting the bare backend URL previously 404'd with no
// explanation, which is genuinely ambiguous — it doesn't tell you whether that 404 came
// from Express having no root route (expected, harmless) or from a real request losing
// its /api/... suffix somewhere in the frontend. This makes that distinction visible, and
// the timestamp doubles as a quick way to confirm a given Render deploy is actually live.
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Leviva backend', deployedAt: new Date().toISOString() });
});

app.use('/api', apiRoutes);
app.use('/api/auth', require('./routes/authRoutes'));


// 1. Create a raw Node HTTP server wrapping the Express app.
// Socket.IO requires this instead of standard app.listen().
const server = http.createServer(app);

// 2. Initialize Socket.IO with the same origin policy as the REST API above.
const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ["GET", "POST"]
  }
});

// 3. The Stateless Relay Logic
io.on('connection', (socket) => {
  console.log(`🟢 [Connected] Device ID: ${socket.id}`);

  // A. Devices join a specific clinical session room (e.g., 'session-1234')
  socket.on('join-session', (sessionId: string) => {
    socket.join(sessionId);
    console.log(`Device ${socket.id} joined session: ${sessionId}`);
  });

  // B. Relay: Clinician moves to the next slide -> Tell the Patient's screen
  socket.on('clinician-slide-change', (data: { sessionId: string, newIndex: number }) => {
    // socket.to() broadcasts to everyone in the room EXCEPT the sender
    socket.to(data.sessionId).emit('sync-slide-change', data.newIndex);
  });

  // C. Relay: Patient taps the screen -> Tell the Clinician's live grader panel
  socket.on('patient-interaction', (data: { sessionId: string, interactionData: any }) => {
    socket.to(data.sessionId).emit('sync-patient-interaction', data.interactionData);
  });

  // Reading/Naming Sync Logic
  socket.on('reading-start-task', (sessionId: string) => {
    socket.to(sessionId).emit('sync-start-task');
  });

  socket.on('reading-grade-item', (data: { sessionId: string, key: string, gradeData: any }) => {
    socket.to(data.sessionId).emit('sync-grade-item', { key: data.key, gradeData: data.gradeData });
  });

  // Naming Task Sync Logic
  socket.on('naming-slide-change', (data: { sessionId: string, newIndex: number, gradeData: any }) => {
    socket.to(data.sessionId).emit('sync-naming-slide-change', data);
  });

  socket.on('naming-grade-update', (data: { sessionId: string, grade: string, comment: string }) => {
    socket.to(data.sessionId).emit('sync-naming-grade', { grade: data.grade, comment: data.comment });
  });

  socket.on('reading-finish-task', (sessionId: string) => {
    socket.to(sessionId).emit('sync-finish-task');
  });

  socket.on('disconnect', () => {
    console.log(`🔴 [Disconnected] Device ID: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3001;

const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

server.listen(portNumber, '0.0.0.0', () => {
  console.log(`🚀 Leviva Sync Server running on port ${portNumber}`);
  console.log(`📡 Ready for connections`);
});