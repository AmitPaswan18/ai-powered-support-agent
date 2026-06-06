const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// MongoDB Session schema
const SessionSchema = new mongoose.Schema({
  title: { type: String, default: 'New Conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    sources: [String],
    createdAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);

// Lazy MongoDB connection — safe for Vercel serverless cold starts
// Mongoose buffers queries until connected, but on serverless the 10s buffer
// expires before the async connect() resolves. We fix this by explicitly
// awaiting the connection inside every route that touches MongoDB.
const mongoUri = process.env.MONGODB_URI;
let mongoConnected = false;

async function connectDB() {
  if (mongoConnected || mongoose.connection.readyState === 1) return;
  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. MongoDB features will not work.');
    return;
  }
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000, // fail fast — Vercel functions timeout at 10s
      socketTimeoutMS: 8000,
    });
    mongoConnected = true;
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

const FASTAPI_SERVICE_URL = process.env.FASTAPI_SERVICE_URL || 'http://localhost:8000';

// Health Check
app.get('/api/health', async (req, res) => {
  let pythonStatus = 'unknown';
  try {
    const response = await fetch(`${FASTAPI_SERVICE_URL}/api/health`);
    const data = await response.json();
    pythonStatus = data.status || 'healthy';
  } catch (error) {
    pythonStatus = 'offline';
  }

  res.json({
    gateway: 'healthy',
    pythonService: pythonStatus,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Get all chat sessions
app.get('/api/sessions', async (req, res) => {
  try {
    await connectDB();
    const sessions = await Session.find().sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single session
app.get('/api/sessions/:id', async (req, res) => {
  try {
    await connectDB();
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await connectDB();
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename a session
app.put('/api/sessions/:id', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    await connectDB();
    const session = await Session.findByIdAndUpdate(req.params.id, { title }, { new: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all sessions
app.delete('/api/sessions', async (req, res) => {
  try {
    await connectDB();
    await Session.deleteMany({});
    res.json({ success: true, message: 'All sessions deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ingest proxy
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    // Forward to FastAPI
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);
    if (req.body.title) {
      formData.append('title', req.body.title);
    }

    const response = await fetch(`${FASTAPI_SERVICE_URL}/api/ingest`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Upload forward error:', error);
    res.status(500).json({ error: 'Failed to upload and parse document: ' + error.message });
  }
});

// List all uploaded documents
app.get('/api/documents', async (req, res) => {
  try {
    const response = await fetch(`${FASTAPI_SERVICE_URL}/api/documents`);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a document by title
app.delete('/api/documents/:title', async (req, res) => {
  try {
    const encodedTitle = encodeURIComponent(req.params.title);
    const response = await fetch(`${FASTAPI_SERVICE_URL}/api/documents/${encodedTitle}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rate limit storage (IP -> timestamps)
const rateLimits = new Map();
// Cache storage (normalized query -> responseText & sources)
const chatCache = new Map();

// Rate Limiter middleware (Max 3 requests per minute per IP)
const rateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 3;

  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, [now]);
    return next();
  }

  const timestamps = rateLimits.get(ip);
  const recentTimestamps = timestamps.filter(time => now - time < windowMs);

  if (recentTimestamps.length >= maxRequests) {
    const oldest = recentTimestamps[0];
    const remainingSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return res.status(429).json({
      error: `Too many requests. Please try again in ${remainingSec} seconds.`
    });
  }

  recentTimestamps.push(now);
  rateLimits.set(ip, recentTimestamps);
  next();
};

// Chat Proxy with Streaming & Rate Limiting & Caching
app.post('/api/chat/stream', rateLimiter, async (req, res) => {
  const { query, sessionId } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    let session;
    let history = [];

    // Ensure DB is connected before any query
    await connectDB();

    // Find or create session
    if (sessionId) {
      session = await Session.findById(sessionId);
    }

    if (!session) {
      const sessionTitle = query.substring(0, 30);
      session = new Session({
        _id: sessionId || new mongoose.Types.ObjectId(),
        title: sessionTitle
      });
      await session.save();

      // Generate summarization in the background to avoid blocking the stream
      (async () => {
        try {
          const sumResponse = await fetch(`${FASTAPI_SERVICE_URL}/api/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: query })
          });
          if (sumResponse.ok) {
            const sumData = await sumResponse.json();
            if (sumData.title) {
              await Session.findByIdAndUpdate(session._id, { title: sumData.title });
            }
          }
        } catch (err) {
          console.error('Background title summarization failed:', err);
        }
      })();
    } else {
      // Build history for the FastAPI
      history = session.messages.map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    // Caching check (Normalized lower-cased trimmed query check)
    const cacheKey = query.trim().toLowerCase();
    if (chatCache.has(cacheKey)) {
      console.log(`[Cache Hit] Serving cached response for query: "${query}"`);
      const cached = chatCache.get(cacheKey);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send session & sources immediately
      res.write(`event: session\ndata: ${JSON.stringify({ sessionId: session._id })}\n\n`);
      res.write(`event: sources\ndata: ${JSON.stringify(cached.sources)}\n\n`);
      if (res.flush) res.flush();

      // Stream words with a small delay to simulate the real-time stream typing effect
      const words = cached.responseText.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        res.write(`event: message\ndata: ${JSON.stringify(word)}\n\n`);
        if (res.flush) res.flush();
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms word delivery delay
      }

      res.write(`event: end\ndata: [DONE]\n\n`);
      if (res.flush) res.flush();
      res.end();

      // Append query and cached response to MongoDB history
      session.messages.push({ role: 'user', content: query });
      session.messages.push({ role: 'assistant', content: cached.responseText, sources: cached.sources });
      await session.save();
      return;
    }

    // Call FastAPI service
    const response = await fetch(`${FASTAPI_SERVICE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, history })
    });

    if (!response.ok) {
      throw new Error(`FastAPI service error: ${response.statusText}`);
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/Vercel

    // Send the sessionId as the first event so frontend knows the session id
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId: session._id })}\n\n`);
    if (res.flush) res.flush();

    const decoder = new TextDecoder();
    let completeResponse = '';
    let sources = [];
    let gatewayBuffer = '';

    for await (const chunk of response.body) {
      const chunkStr = decoder.decode(chunk, { stream: true });
      res.write(chunkStr);
      if (res.flush) res.flush();

      gatewayBuffer += chunkStr;
      const events = gatewayBuffer.split('\n\n');
      gatewayBuffer = events.pop(); // Keep trailing incomplete event in the buffer

      for (const event of events) {
        if (!event.trim()) continue;

        const lines = event.split('\n');
        let eventType = 'message';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.substring(6).trim();
          }
        }

        if (eventData === '[DONE]') continue;

        try {
          const parsed = JSON.parse(eventData);
          if (eventType === 'sources') {
            sources = parsed;
          } else if (eventType === 'message') {
            completeResponse += parsed;
          }
        } catch (e) {
          // Ignore parsing errors for malformed events
        }
      }
    }

    // Save user message and complete assistant response to database
    session.messages.push({ role: 'user', content: query });
    session.messages.push({ role: 'assistant', content: completeResponse, sources });
    await session.save();

    // Cache the query and response
    if (completeResponse.trim()) {
      chatCache.set(cacheKey, { responseText: completeResponse, sources });
      console.log(`[Cache Write] Cached response for query: "${cacheKey}"`);
    }

    res.end();
  } catch (error) {
    console.error('Chat stream proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Express Gateway running on port ${PORT}`));
