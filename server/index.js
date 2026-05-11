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

// ── 每日 18:30 自动刷新净值 (akshare) ──
let lastAutoRefreshDate = '';

async function autoRefreshNAVs() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Only on weekdays, after 18:30, and not already refreshed today
  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  if (hour < 18 || (hour === 18 && minute < 30)) return;
  if (lastAutoRefreshDate === today) return;

  try {
    const db = require('./db');
    const funds = db.prepare('SELECT code FROM funds').all();
    if (!funds.length) return;

    const codes = funds.map(f => f.code);
    const { execFile } = require('child_process');
    const path = require('path');

    const akshareData = await new Promise((resolve) => {
      const child = execFile('python3', [path.join(__dirname, 'akshare_bridge.py'), '--stdin'], {
        timeout: 60000, maxBuffer: 1024 * 1024,
      }, (err, stdout) => {
        if (err) return resolve({});
        try { resolve(JSON.parse(stdout)); } catch { resolve({}); }
      });
      child.stdin.write(JSON.stringify(codes));
      child.stdin.end();
    });

    const results = [];
    for (const f of funds) {
      const d = akshareData[f.code];
      if (d && d.nav) {
        results.push({ code: f.code, nav: d.nav, date: d.date, changePct: d.change_pct || 0 });
      }
    }

    if (results.length) {
      const updateFund = db.prepare(`UPDATE funds SET nav = ?, updated_at = datetime('now','localtime') WHERE code = ?`);
      const upsertDaily = db.prepare(
        `INSERT INTO fund_daily (code, date, nav, change_pct) VALUES (?, ?, ?, ?)
         ON CONFLICT(code, date) DO UPDATE SET nav = excluded.nav, change_pct = excluded.change_pct`
      );
      const transaction = db.transaction(() => {
        for (const r of results) {
          updateFund.run(r.nav, r.code);
          upsertDaily.run(r.code, r.date, r.nav, r.changePct);
        }
      });
      transaction();
      lastAutoRefreshDate = today;
      console.log(`[auto-refresh] ${today} 更新了 ${results.length} 只基金净值`);
    }
  } catch (e) {
    console.log('[auto-refresh] error:', e.message);
  }
}

// ── fund_daily API ──
app.get('/api/fund-daily/latest', auth, (req, res) => {
  const db = require('./db');
  const globalDate = db.prepare('SELECT date FROM fund_daily ORDER BY date DESC LIMIT 1').get();
  if (!globalDate) return res.json({ date: '', funds: {} });

  // Per-fund latest: handle funds with different update schedules (QDII, etc.)
  const rows = db.prepare(`
    SELECT fd.code, fd.nav, fd.change_pct, fd.date
    FROM fund_daily fd
    INNER JOIN (
      SELECT code, MAX(date) as max_date FROM fund_daily GROUP BY code
    ) latest ON fd.code = latest.code AND fd.date = latest.max_date
  `).all();

  const funds = {};
  for (const r of rows) {
    funds[r.code] = { nav: r.nav, changePct: r.change_pct, date: r.date };
  }
  res.json({ date: globalDate.date, funds });
});

// Check every 15 minutes
setInterval(autoRefreshNAVs, 15 * 60 * 1000);
// Also run once at startup (after a short delay for DB to be ready)
setTimeout(autoRefreshNAVs, 5000);

app.listen(PORT, () => {
  console.log(`🚀 基金管理系统已启动: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/`);
});
