const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const checkpoints = db.prepare('SELECT * FROM checkpoints WHERE user_id = ? ORDER BY checkpoint_date DESC, id DESC').all(req.userId);
  checkpoints.forEach(cp => {
    try { cp.nav_snapshots = JSON.parse(cp.nav_snapshots || '[]'); } catch { cp.nav_snapshots = []; }
  });
  res.json(checkpoints);
});

router.post('/', (req, res) => {
  const { label, checkpoint_date, nav_snapshots } = req.body;
  if (!label || !checkpoint_date) return res.status(400).json({ error: '节点名称和日期不能为空' });

  const stmt = db.prepare(
    `INSERT INTO checkpoints (label, checkpoint_date, nav_snapshots, user_id) VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(label, checkpoint_date, JSON.stringify(nav_snapshots || []), req.userId);
  const cp = db.prepare('SELECT * FROM checkpoints WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.userId);
  try { cp.nav_snapshots = JSON.parse(cp.nav_snapshots || '[]'); } catch { cp.nav_snapshots = []; }
  res.json(cp);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM checkpoints WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

module.exports = router;
