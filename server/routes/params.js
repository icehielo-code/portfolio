const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:key', (req, res) => {
  const row = db.prepare('SELECT * FROM params WHERE key = ?').get(req.params.key);
  res.json({ key: req.params.key, value: row ? row.value : '' });
});

router.put('/:key', (req, res) => {
  const { value } = req.body;
  db.prepare(`
    INSERT INTO params (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')
  `).run(req.params.key, String(value));
  res.json({ key: req.params.key, value });
});

module.exports = router;
