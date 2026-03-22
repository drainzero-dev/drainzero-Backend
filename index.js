// ─────────────────────────────────────────────
//  DrainZero Backend — Express Entry Point
// ─────────────────────────────────────────────
const express   = require('express');
const rateLimit = require('express-rate-limit');
const cors      = require('cors');
require('dotenv').config();

const app = express();

// ── Start server IMMEDIATELY so Render doesn't timeout ──
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`DrainZero backend running on port ${PORT}`);
});

// ── Middleware ──────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check — always respond ──────────
app.get('/', (req, res) => {
  res.json({
    status : 'DrainZero backend is alive',
    time   : new Date().toISOString(),
    version: 'v1.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Rate Limiter ────────────────────────────
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max     : 10,
  message : { error: 'Too many requests, please slow down.' }
});

// ── Routes — load after server starts ──────
try {
  app.use('/api/agent',     agentLimiter);
  app.use('/api/agent',     require('./routes/agent'));
  app.use('/api/analyse',   require('./routes/analyse'));
  app.use('/api/loopholes', require('./routes/loopholes'));
  app.use('/api/benefits',  require('./routes/benefits'));
  app.use('/api/documents', require('./routes/documents'));
  console.log('All routes loaded successfully');
} catch (err) {
  console.error('Route loading error:', err.message);
}

// ── Global error handler ────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
