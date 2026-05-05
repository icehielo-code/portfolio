const express = require('express');
const router = express.Router();
const db = require('../db');

function parseHoldings(holdingsStr) {
  try { return JSON.parse(holdingsStr || '[]'); } catch { return []; }
}
function stringifyHoldings(arr) { return JSON.stringify(arr || []); }

router.get('/', (req, res) => {
  const funds = db.prepare('SELECT * FROM funds WHERE user_id = ? ORDER BY sort_order, id').all(req.userId);
  funds.forEach(f => { f.top_holdings = parseHoldings(f.top_holdings); });
  res.json(funds);
});

router.post('/', (req, res) => {
  const { code, name, type, nav, shares, target, origin_nav, category, style, manager, top_holdings } = req.body;
  if (!code || !name) return res.status(400).json({ error: '基金代码和名称不能为空' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '基金代码必须为6位数字' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM funds WHERE user_id = ?').get(req.userId);
  const stmt = db.prepare(`
    INSERT INTO funds (code, name, type, nav, shares, target, origin_nav, category, style, manager, top_holdings, sort_order, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    code, name, type || 'A股公募', nav || 0, shares || 0, target || 0, origin_nav || 0,
    category || '权益类', style || '均衡型', manager || '',
    stringifyHoldings(top_holdings), maxOrder.m + 1, req.userId
  );
  const fund = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(info.lastInsertRowid, req.userId);
  fund.top_holdings = parseHoldings(fund.top_holdings);
  res.json(fund);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const fund = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!fund) return res.status(404).json({ error: '基金不存在' });

  const {
    code, name, type, nav, shares, target, origin_nav,
    category, style, manager, top_holdings
  } = req.body;

  db.prepare(`
    UPDATE funds SET
      code = ?, name = ?, type = ?, nav = ?, shares = ?, target = ?, origin_nav = ?,
      category = ?, style = ?, manager = ?, top_holdings = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ? AND user_id = ?
  `).run(
    code ?? fund.code, name ?? fund.name, type ?? fund.type,
    nav ?? fund.nav, shares ?? fund.shares, target ?? fund.target,
    origin_nav ?? fund.origin_nav,
    category ?? fund.category, style ?? fund.style, manager ?? fund.manager,
    stringifyHoldings(top_holdings ?? parseHoldings(fund.top_holdings)),
    id, req.userId
  );

  const updated = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(id, req.userId);
  updated.top_holdings = parseHoldings(updated.top_holdings);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM funds WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

router.put('/batch/nav', (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: '参数格式错误' });

  const stmt = db.prepare("UPDATE funds SET nav = ?, updated_at = datetime('now','localtime') WHERE code = ? AND user_id = ?");
  const transaction = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.nav, item.code, req.userId);
    }
  });
  transaction(updates);
  res.json({ ok: true, updated: updates.length });
});

module.exports = router;
