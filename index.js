// ─────────────────────────────────────────────
//  DrainZero Backend — Express Entry Point
//  Run: node index.js
// ─────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',       // Vite dev server
    'http://localhost:3000',       // alternate dev
    process.env.FRONTEND_URL       // Netlify URL (set in .env)
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));  // 10mb for base64 doc uploads
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────
app.use('/api/agent',     require('./routes/agent'));
app.use('/api/analyse',   require('./routes/analyse'));
app.use('/api/loopholes', require('./routes/loopholes'));
app.use('/api/benefits',  require('./routes/benefits'));
app.use('/api/documents', require('./routes/documents'));

// ── Health check (Render ping + cron-job.org) ──
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
