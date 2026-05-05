const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: '用户名不能为空' });
  const name = username.trim();

  let user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(name);
  if (!user) {
    const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(name);
    db.seedStrategiesForUser(info.lastInsertRowid);
    user = { id: info.lastInsertRowid, username: name };
  }

  res.json(user);
});

module.exports = router;
