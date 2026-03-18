// ─────────────────────────────────────────────
//  DrainZero Backend — Express Entry Point
//  Run: node index.js
// ─────────────────────────────────────────────
const express   = require('express');
const rateLimit = require('express-rate-limit');
const cors      = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiter ────────────────────────────
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max     : 10,
  message : { error: 'Too many requests, please slow down.' }
});

// ── Routes ──────────────────────────────────
app.use('/api/agent',     agentLimiter);
app.use('/api/agent',     require('./routes/agent'));
app.use('/api/analyse',   require('./routes/analyse'));
app.use('/api/loopholes', require('./routes/loopholes'));
app.use('/api/benefits',  require('./routes/benefits'));
app.use('/api/documents', require('./routes/documents'));

// ── Health check ────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status : 'DrainZero backend is alive',
    time   : new Date().toISOString(),
    version: 'v1.0'
  });
});

// ── Global error handler ────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`DrainZero backend running on port ${PORT}`);
});
