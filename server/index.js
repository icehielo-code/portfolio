require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const fundsRouter = require('./routes/funds');
const strategiesRouter = require('./routes/strategies');
const checkpointsRouter = require('./routes/checkpoints');
const settingsRouter = require('./routes/settings');
const proxyRouter = require('./routes/proxy');
const aiRouter = require('./routes/ai');

app.use('/api/funds', fundsRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/checkpoints', checkpointsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/ai', aiRouter);

app.get('/api/export', (req, res) => {
  const db = require('./db');
  const data = {
    funds: db.prepare('SELECT * FROM funds ORDER BY sort_order, id').all(),
    strategies: db.prepare('SELECT * FROM strategies ORDER BY sort_order, id').all(),
    checkpoints: db.prepare('SELECT * FROM checkpoints ORDER BY id').all(),
    settings: db.prepare('SELECT * FROM settings').all(),
    exported_at: new Date().toISOString(),
  };
  data.funds.forEach(f => { try { f.top_holdings = JSON.parse(f.top_holdings); } catch {} });
  data.strategies.forEach(s => { try { s.rules = JSON.parse(s.rules); } catch {} });
  data.checkpoints.forEach(c => { try { c.nav_snapshots = JSON.parse(c.nav_snapshots); } catch {} });
  res.json(data);
});

app.post('/api/import', (req, res) => {
  const db = require('./db');
  const { funds, strategies, checkpoints, settings } = req.body;

  const transaction = db.transaction(() => {
    if (Array.isArray(funds) && funds.length) {
      db.prepare('DELETE FROM funds').run();
      const stmt = db.prepare(`
        INSERT INTO funds (code, name, type, nav, shares, target, origin_nav, category, style, manager, top_holdings, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      funds.forEach((f, i) => {
        stmt.run(f.code, f.name, f.type, f.nav, f.shares, f.target, f.origin_nav,
          f.category, f.style, f.manager,
          typeof f.top_holdings === 'string' ? f.top_holdings : JSON.stringify(f.top_holdings || []),
          i + 1);
      });
    }

    if (Array.isArray(strategies) && strategies.length) {
      db.prepare('DELETE FROM strategies').run();
      const stmt = db.prepare(`
        INSERT INTO strategies (name, description, rules, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      strategies.forEach((s, i) => {
        stmt.run(s.name, s.description,
          typeof s.rules === 'string' ? s.rules : JSON.stringify(s.rules || []),
          s.is_active ? 1 : 0, i + 1);
      });
    }

    if (Array.isArray(checkpoints) && checkpoints.length) {
      db.prepare('DELETE FROM checkpoints').run();
      const stmt = db.prepare(`
        INSERT INTO checkpoints (label, checkpoint_date, nav_snapshots)
        VALUES (?, ?, ?)
      `);
      checkpoints.forEach(c => {
        stmt.run(c.label, c.checkpoint_date,
          typeof c.nav_snapshots === 'string' ? c.nav_snapshots : JSON.stringify(c.nav_snapshots || []));
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
