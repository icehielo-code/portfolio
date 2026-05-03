const express = require('express');
const router = express.Router();
const db = require('../db');

function parseRules(rulesStr) {
  try { return JSON.parse(rulesStr || '[]'); } catch { return []; }
}

router.get('/', (req, res) => {
  const strategies = db.prepare('SELECT * FROM strategies ORDER BY sort_order, id').all();
  strategies.forEach(s => { s.rules = parseRules(s.rules); });
  res.json(strategies);
});

router.post('/', (req, res) => {
  const { name, description, rules } = req.body;
  if (!name) return res.status(400).json({ error: '策略名称不能为空' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM strategies').get();
  const stmt = db.prepare(
    `INSERT INTO strategies (name, description, rules, sort_order) VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(name, description || '', JSON.stringify(rules || []), maxOrder.m + 1);
  const strategy = db.prepare('SELECT * FROM strategies WHERE id = ?').get(info.lastInsertRowid);
  strategy.rules = parseRules(strategy.rules);
  res.json(strategy);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const strategy = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id);
  if (!strategy) return res.status(404).json({ error: '策略不存在' });

  const { name, description, rules } = req.body;
  db.prepare(`
    UPDATE strategies SET name = ?, description = ?, rules = ?,
    updated_at = datetime('now','localtime') WHERE id = ?
  `).run(
    name ?? strategy.name,
    description ?? strategy.description,
    JSON.stringify(rules ?? parseRules(strategy.rules)),
    id
  );
  const updated = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id);
  updated.rules = parseRules(updated.rules);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM strategies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/activate/:id', (req, res) => {
  db.prepare('UPDATE strategies SET is_active = 0').run();
  db.prepare('UPDATE strategies SET is_active = 1, updated_at = datetime("now","localtime") WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
