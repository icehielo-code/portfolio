const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const https = require('https');
const http = require('http');

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchUrl(url, headers = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      agent: url.startsWith('https') ? httpsAgent : httpAgent,
      signal: controller.signal,
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function tryTiantian(code) {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
    const resp = await fetchUrl(url, { Referer: 'https://fund.eastmoney.com/' });
    const raw = await resp.text();
    const m = raw.match(/\((\{.*?\})\)/s);
    if (!m) return null;
    const obj = JSON.parse(m[1]);
    if (!obj.name) return null;
    return {
      name: obj.name,
      nav: obj.dwjz,
      gsz: obj.gsz,
      gszzl: obj.gszzl,
      dwjz: obj.dwjz,
      jzrq: obj.jzrq || '',
    };
  } catch { return null; }
}

async function tryEastmoney(code) {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const resp = await fetchUrl(url, { Referer: 'https://fund.eastmoney.com/' });
    const raw = await resp.text();

    const nameM = raw.match(/var\s+fS_name\s*=\s*"([^"]+)"/);
    if (!nameM) return null;
    const name = nameM[1];

    const ishbM = raw.match(/var\s+ishb\s*=\s*(true|false)/);
    const ishb = ishbM && ishbM[1] === 'true';

    if (ishb) {
      const incomeM = raw.match(/var\s+Data_millionCopiesIncome\s*=\s*(\[.*?\]);/s);
      let jzrq = '';
      if (incomeM) {
        try {
          const arr = JSON.parse(incomeM[1]);
          if (arr && arr.length) {
            const ts = arr[arr.length - 1][0];
            if (ts) jzrq = new Date(ts).toISOString().slice(0, 10);
          }
        } catch {}
      }
      return { name, nav: '1.0000', dwjz: '1.0000', jzrq, type_hint: '货币基金' };
    }

    const navM = raw.match(/var\s+Data_netWorthTrend\s*=\s*(\[.*?\]);/s);
    let dwjz = null, jzrq = '';
    if (navM) {
      try {
        const arr = JSON.parse(navM[1]);
        if (arr && arr.length) {
          const last = arr[arr.length - 1];
          dwjz = String(last.y || '');
          if (last.x) jzrq = new Date(last.x).toISOString().slice(0, 10);
        }
      } catch {}
    }

    const result = { name, dwjz, jzrq };
    if (dwjz) result.nav = dwjz;
    return result;
  } catch { return null; }
}

async function trySina(code) {
  try {
    const url = `https://hq.sinajs.cn/list=f_${code}`;
    const resp = await fetchUrl(url, { Referer: 'https://finance.sina.com.cn/' });
    const raw = await resp.buffer();
    const text = raw.toString('utf-8').replace(/\ufffd/g, '');
    const textGbk = raw.toString('gbk').replace(/\ufffd/g, '');

    let parsed = null;
    for (const t of [textGbk, text]) {
      const m = t.match(new RegExp(`var\\s+hq_str_f_${code}="([^"]*)"`));
      if (m && m[1]) {
        const parts = m[1].split(',');
        if (parts.length >= 2 && parts[0]) {
          parsed = { name: parts[0], nav: parts[1] || (parts[2] || '') };
          break;
        }
      }
    }
    return parsed;
  } catch { return null; }
}

router.get('/', async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: '无效基金代码' });
  }

  const apis = [
    { name: '天天基金', fn: tryTiantian },
    { name: '东方财富', fn: tryEastmoney },
    { name: '新浪财经', fn: trySina },
  ];

  for (const api of apis) {
    try {
      const result = await api.fn(code);
      if (result && result.name) {
        result.source = api.name;
        return res.json(result);
      }
    } catch {}
  }

  res.status(502).json({ error: '所有接口均失败' });
});

router.post('/batch', async (req, res) => {
  const { codes } = req.body;
  if (!Array.isArray(codes)) return res.status(400).json({ error: '参数格式错误' });

  const results = {};
  await Promise.all(codes.map(async (code) => {
    const apis = [
      { name: '天天基金', fn: tryTiantian },
      { name: '东方财富', fn: tryEastmoney },
      { name: '新浪财经', fn: trySina },
    ];
    for (const api of apis) {
      try {
        const result = await api.fn(code);
        if (result && result.name) {
          result.source = api.name;
          results[code] = result;
          return;
        }
      } catch {}
    }
    results[code] = { error: '查询失败' };
  }));

  res.json(results);
});

module.exports = router;
