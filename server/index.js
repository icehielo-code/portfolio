require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const auth = require('./middleware/auth');
const fundsRouter = require('./routes/funds');
const strategiesRouter = require('./routes/strategies');
const checkpointsRouter = require('./routes/checkpoints');
const settingsRouter = require('./routes/settings');
const paramsRouter = require('./routes/params');
const proxyRouter = require('./routes/proxy');
const aiRouter = require('./routes/ai');
const usersRouter = require('./routes/users');

app.use('/api/users', usersRouter);
app.use('/api/funds', auth, fundsRouter);
app.use('/api/strategies', auth, strategiesRouter);
app.use('/api/checkpoints', auth, checkpointsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/params', paramsRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/ai', auth, aiRouter);

app.get('/api/export', auth, (req, res) => {
  const db = require('./db');
  const data = {
    funds: db.prepare('SELECT * FROM funds WHERE user_id = ? ORDER BY sort_order, id').all(req.userId),
    strategies: db.prepare('SELECT * FROM strategies WHERE user_id = ? ORDER BY sort_order, id').all(req.userId),
    checkpoints: db.prepare('SELECT * FROM checkpoints WHERE user_id = ? ORDER BY id').all(req.userId),
    settings: db.prepare('SELECT * FROM settings').all(),
    exported_at: new Date().toISOString(),
  };
  data.funds.forEach(f => { try { f.top_holdings = JSON.parse(f.top_holdings); } catch {} });
  data.strategies.forEach(s => { try { s.rules = JSON.parse(s.rules); } catch {} });
  data.checkpoints.forEach(c => { try { c.nav_snapshots = JSON.parse(c.nav_snapshots); } catch {} });
  res.json(data);
});

app.post('/api/import', auth, (req, res) => {
  const db = require('./db');
  const { funds, strategies, checkpoints, settings } = req.body;

  const transaction = db.transaction(() => {
    if (Array.isArray(funds) && funds.length) {
      db.prepare('DELETE FROM funds WHERE user_id = ?').run(req.userId);
      const stmt = db.prepare(`
        INSERT INTO funds (code, name, type, nav, shares, target, origin_nav, category, style, manager, top_holdings, sort_order, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      funds.forEach((f, i) => {
        stmt.run(f.code, f.name, f.type, f.nav, f.shares, f.target, f.origin_nav,
          f.category, f.style, f.manager,
          typeof f.top_holdings === 'string' ? f.top_holdings : JSON.stringify(f.top_holdings || []),
          i + 1, req.userId);
      });
    }

    if (Array.isArray(strategies) && strategies.length) {
      db.prepare('DELETE FROM strategies WHERE user_id = ?').run(req.userId);
      const stmt = db.prepare(`
        INSERT INTO strategies (name, description, rules, is_active, sort_order, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      strategies.forEach((s, i) => {
        stmt.run(s.name, s.description,
          typeof s.rules === 'string' ? s.rules : JSON.stringify(s.rules || []),
          s.is_active ? 1 : 0, i + 1, req.userId);
      });
    }

    if (Array.isArray(checkpoints) && checkpoints.length) {
      db.prepare('DELETE FROM checkpoints WHERE user_id = ?').run(req.userId);
      const stmt = db.prepare(`
        INSERT INTO checkpoints (label, checkpoint_date, nav_snapshots, user_id)
        VALUES (?, ?, ?, ?)
      `);
      checkpoints.forEach(c => {
        stmt.run(c.label, c.checkpoint_date,
          typeof c.nav_snapshots === 'string' ? c.nav_snapshots : JSON.stringify(c.nav_snapshots || []),
          req.userId);
      });
    }

    if (Array.isArray(settings) && settings.length) {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      settings.forEach(s => stmt.run(s.key, s.value));
    }
  });

  try {
    transaction();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 基金管理系统已启动: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/`);
});
