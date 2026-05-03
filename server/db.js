const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'fund.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS funds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL DEFAULT '',
    type        TEXT    NOT NULL DEFAULT 'A股公募',
    nav         REAL    NOT NULL DEFAULT 0,
    shares      INTEGER NOT NULL DEFAULT 0,
    target      REAL    NOT NULL DEFAULT 0,
    origin_nav  REAL    NOT NULL DEFAULT 0,
    category    TEXT    NOT NULL DEFAULT '权益类',
    style       TEXT    NOT NULL DEFAULT '均衡型',
    manager     TEXT    NOT NULL DEFAULT '',
    top_holdings TEXT   NOT NULL DEFAULT '[]',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    rules       TEXT    NOT NULL DEFAULT '[]',
    is_active   INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS checkpoints (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    checkpoint_date TEXT NOT NULL,
    nav_snapshots  TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL DEFAULT '',
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    role        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

const strategyCount = db.prepare('SELECT COUNT(*) as cnt FROM strategies').get();
if (strategyCount.cnt === 0) {
  const insertStrategy = db.prepare(
    `INSERT INTO strategies (name, description, rules, is_active, sort_order) VALUES (?, ?, ?, ?, ?)`
  );
  insertStrategy.run('均衡策略', '平衡风险与收益，定期再平衡，适合长期持有', JSON.stringify(['止盈15%', '止损8%', '季度再平衡', '沪深300+中证500']), 1, 0);
  insertStrategy.run('定投策略', '每周/月定期定额投入，摊薄成本，适合长期积累', JSON.stringify(['每周五定投', '单次¥500', '下跌加倍', '不做择时']), 0, 1);
  insertStrategy.run('趋势策略', '跟随市场趋势，上涨加仓下跌减仓，适合有经验的投资者', JSON.stringify(['MA20上方持仓', 'MA20下方空仓', '止损5%', '月度调仓']), 0, 2);
}

const originModeSetting = db.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key = 'origin_mode'").get();
if (originModeSetting.cnt === 0) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('origin_mode', 'false');
}

module.exports = db;
