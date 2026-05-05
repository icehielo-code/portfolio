const express = require('express');
const router = express.Router();
const db = require('../db');

function parseRules(rulesStr) {
  try { return JSON.parse(rulesStr || '[]'); } catch { return []; }
}

router.get('/', (req, res) => {
  const strategies = db.prepare('SELECT * FROM strategies WHERE user_id = ? ORDER BY sort_order, id').all(req.userId);
  strategies.forEach(s => { s.rules = parseRules(s.rules); });
  res.json(strategies);
});

router.post('/', (req, res) => {
  const { name, description, rules } = req.body;
  if (!name) return res.status(400).json({ error: '策略名称不能为空' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM strategies WHERE user_id = ?').get(req.userId);
  const stmt = db.prepare(
    `INSERT INTO strategies (name, description, rules, sort_order, user_id) VALUES (?, ?, ?, ?, ?)`
  );
  const info = stmt.run(name, description || '', JSON.stringify(rules || []), maxOrder.m + 1, req.userId);
  const strategy = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.userId);
  strategy.rules = parseRules(strategy.rules);
  res.json(strategy);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const strategy = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!strategy) return res.status(404).json({ error: '策略不存在' });

  const { name, description, rules } = req.body;
  db.prepare(`
    UPDATE strategies SET name = ?, description = ?, rules = ?,
    updated_at = datetime('now','localtime') WHERE id = ? AND user_id = ?
  `).run(
    name ?? strategy.name,
    description ?? strategy.description,
    JSON.stringify(rules ?? parseRules(strategy.rules)),
    id, req.userId
  );
  const updated = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(id, req.userId);
  updated.rules = parseRules(updated.rules);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM strategies WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

router.put('/activate/:id', (req, res) => {
  db.prepare('UPDATE strategies SET is_active = 0 WHERE user_id = ?').run(req.userId);
  db.prepare("UPDATE strategies SET is_active = 1, updated_at = datetime('now','localtime') WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  res.json({ ok: true });
});

module.exports = router;
