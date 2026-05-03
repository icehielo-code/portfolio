const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const checkpoints = db.prepare('SELECT * FROM checkpoints ORDER BY checkpoint_date DESC, id DESC').all();
  checkpoints.forEach(cp => {
    try { cp.nav_snapshots = JSON.parse(cp.nav_snapshots || '[]'); } catch { cp.nav_snapshots = []; }
  });
  res.json(checkpoints);
});

router.post('/', (req, res) => {
  const { label, checkpoint_date, nav_snapshots } = req.body;
  if (!label || !checkpoint_date) return res.status(400).json({ error: '节点名称和日期不能为空' });

  const stmt = db.prepare(
    `INSERT INTO checkpoints (label, checkpoint_date, nav_snapshots) VALUES (?, ?, ?)`
  );
  const info = stmt.run(label, checkpoint_date, JSON.stringify(nav_snapshots || []));
  const cp = db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(info.lastInsertRowid);
  try { cp.nav_snapshots = JSON.parse(cp.nav_snapshots || '[]'); } catch { cp.nav_snapshots = []; }
  res.json(cp);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM checkpoints WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
