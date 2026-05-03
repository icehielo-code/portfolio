const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
const OCR_MODEL = process.env.OCR_MODEL || 'deepseek-ai/DeepSeek-OCR';

function buildContext(type) {
  const funds = db.prepare('SELECT * FROM funds ORDER BY sort_order, id').all();
  const activeStrategy = db.prepare('SELECT * FROM strategies WHERE is_active = 1').get();
  const total = funds.reduce((s, f) => s + f.nav * f.shares, 0);

  const summary = funds.map(f => {
    const val = f.nav * f.shares;
    const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
    return `${f.name}(${f.code})：净值${f.nav}，份额${f.shares}，市值¥${val.toFixed(0)}，仓位${pct}%，目标${f.target}%`;
  }).join('\n');

  const stratName = activeStrategy ? activeStrategy.name : '未选择';
  const stratRules = activeStrategy ? JSON.parse(activeStrategy.rules || '[]').join('，') : '';
  const ctx = `当前日期：${new Date().toLocaleDateString('zh-CN')}
当前策略：${stratName}（${stratRules}）
持仓总览（共${funds.length}支）：
${summary}`;

  const prompts = {
    default: `${ctx}\n\n请基于上述持仓信息，给出今日操作建议，包括每支基金的具体操作方向和理由。`,
    rebalance: `${ctx}\n\n请计算详细的再平衡操作方案，给出每支基金需要买入或卖出的具体金额和份额。`,
    deep: `${ctx}\n\n请给出深度分析，包括今日具体操作建议、买卖时机和参考价位。`,
    market: `${ctx}\n\n请分析近期A股和全球市场走势，分析对我各基金持仓的影响，哪些需要重点关注？`,
    risk: `${ctx}\n\n请评估我当前持仓的风险状况，包括集中度风险、市场风险、流动性风险等，并给出建议。`,
    strategy: `${ctx}\n\n请根据我的持仓情况，分析当前策略参数是否合理，给出优化建议。`,
  };
  return prompts[type] || prompts.default;
}

router.post('/chat', async (req, res) => {
  const { message, type } = req.body;
  if (!message && !type) return res.status(400).json({ error: '消息不能为空' });

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });
  }

  const userMsg = message || buildContext(type);

  db.prepare('INSERT INTO ai_conversations (role, content) VALUES (?, ?)').run('user', userMsg);

  try {
    const history = db.prepare('SELECT role, content FROM ai_conversations ORDER BY id DESC LIMIT 20').all().reverse();

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: '你是一位专业的基金投资顾问，擅长A股公募基金和ETF指数基金。请用简洁专业的中文回答，给出具体可操作的建议。' },
          ...history,
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const reply = data.choices[0].message.content;

    db.prepare('INSERT INTO ai_conversations (role, content) VALUES (?, ?)').run('assistant', reply);

    res.json({ reply });
  } catch (e) {
    console.error('[AI Chat]', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' });
  if (!SILICONFLOW_API_KEY) return res.status(500).json({ error: '未配置 SILICONFLOW_API_KEY' });
  if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(req.file.originalname || '.jpg').toLowerCase();
    let mime = req.file.mimetype || 'image/jpeg';
    if (ext === '.heic' || ext === '.heif') mime = 'image/jpeg';

    const ocrResp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: '<image>\n<|grounding|>OCR this image.' }
          ]
        }]
      })
    });

    if (!ocrResp.ok) {
      const err = await ocrResp.json().catch(() => ({}));
      throw new Error(err.error?.message || `OCR HTTP ${ocrResp.status}`);
    }

    const ocrData = await ocrResp.json();
    const ocrText = ocrData.choices[0].message.content.trim();
    if (!ocrText) throw new Error('图片中未识别到文字');

    const parseResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `从以下OCR识别结果中提取所有基金持仓信息，以JSON数组返回。每个基金一个对象：
{
  "code": "基金代码（6位数字，没有则空字符串）",
  "name": "基金名称",
  "nav": 当前净值（数字，没有则为null）,
  "shares": 持有份额（数字，没有则为null）,
  "marketValue": 当前市值（数字，没有则为null）,
  "returnRate": 累计收益率（如+12.5，没有则为null）,
  "type": 类型，从"A股公募"/"ETF指数"/"QDII"/"债券基金"中选
}

OCR 识别结果：
${ocrText}

只返回JSON数组，不要任何解释文字和markdown代码块符号。`
        }]
      })
    });

    if (!parseResp.ok) {
      const err = await parseResp.json().catch(() => ({}));
      throw new Error(err.error?.message || `解析 HTTP ${parseResp.status}`);
    }

    const parseData = await parseResp.json();
    const raw = parseData.choices[0].message.content.trim();
    const clean = raw.replace(/```json\s*|```\s*/g, '').trim();
    let funds;
    try { funds = JSON.parse(clean); } catch { throw new Error('解析失败，请重试'); }

    res.json({ funds: Array.isArray(funds) ? funds : [], ocrText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const messages = db.prepare('SELECT * FROM ai_conversations ORDER BY id DESC LIMIT ?').all(limit).reverse();
  res.json(messages);
});

router.delete('/history', (req, res) => {
  db.prepare('DELETE FROM ai_conversations').run();
  res.json({ ok: true });
});

module.exports = router;
