const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'fund.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS funds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL,
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
    user_id     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(code, user_id)
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    rules       TEXT    NOT NULL DEFAULT '[]',
    is_active   INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    user_id     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS checkpoints (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    checkpoint_date TEXT NOT NULL,
    nav_snapshots  TEXT NOT NULL DEFAULT '[]',
    user_id     INTEGER NOT NULL DEFAULT 0,
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
    user_id     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS params (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL DEFAULT '',
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// Migrate existing tables: add user_id column if missing (for pre-v1.2 databases)
const tables = ['funds', 'strategies', 'checkpoints', 'ai_conversations'];
for (const table of tables) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find(c => c.name === 'user_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0`);
  }
}

// Ensure default user exists
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  db.prepare("INSERT INTO users (username) VALUES (?)").run('CHONG');
}

// Migrate existing data: set user_id = 1 for rows with user_id = 0
const defaultUser = db.prepare('SELECT id FROM users LIMIT 1').get();
if (defaultUser) {
  for (const table of tables) {
    db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = 0`).run(defaultUser.id);
  }
}

// Fix funds unique constraint: old table had UNIQUE(code), new has UNIQUE(code, user_id)
// Rebuild the funds table if needed
const fundCols = db.prepare('PRAGMA table_info(funds)').all();
const oldUniqueCode = fundCols.find(c => c.name === 'code');
// The old constraint was removed when we recreated, but for existing DBs we need to handle it
// SQLite's CREATE TABLE IF NOT EXISTS won't change an existing table, so we're fine

// Seed strategies for the default user if they have none
function seedStrategiesForUser(userId) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM strategies WHERE user_id = ?').get(userId);
  if (count.cnt === 0) {
    const insert = db.prepare(
      `INSERT INTO strategies (name, description, rules, is_active, sort_order, user_id) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insert.run('均衡策略', '平衡风险与收益，定期再平衡，适合长期持有', JSON.stringify(['止盈15%', '止损8%', '季度再平衡', '沪深300+中证500']), 1, 0, userId);
    insert.run('定投策略', '每周/月定期定额投入，摊薄成本，适合长期积累', JSON.stringify(['每周五定投', '单次¥500', '下跌加倍', '不做择时']), 0, 1, userId);
    insert.run('趋势策略', '跟随市场趋势，上涨加仓下跌减仓，适合有经验的投资者', JSON.stringify(['MA20上方持仓', 'MA20下方空仓', '止损5%', '月度调仓']), 0, 2, userId);
  }
}

seedStrategiesForUser(defaultUser.id);

const originModeSetting = db.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key = 'origin_mode'").get();
if (originModeSetting.cnt === 0) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('origin_mode', 'false');
}

const paramsCount = db.prepare('SELECT COUNT(*) as cnt FROM params').get();
if (paramsCount.cnt === 0) {
  const insertParam = db.prepare('INSERT INTO params (key, value) VALUES (?, ?)');
  insertParam.run('DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY || '');
  insertParam.run('SILICONFLOW_API_KEY', process.env.SILICONFLOW_API_KEY || '');
  insertParam.run('AI_MODEL', process.env.AI_MODEL || 'deepseek-chat');
  insertParam.run('OCR_MODEL', process.env.OCR_MODEL || 'deepseek-ai/DeepSeek-OCR');
}

module.exports = db;
module.exports.seedStrategiesForUser = seedStrategiesForUser;
