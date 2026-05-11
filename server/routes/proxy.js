const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── akshare Python bridge ──
const AKSHARE_SCRIPT = path.join(__dirname, '..', 'akshare_bridge.py');

async function tryAkshare(code) {
  return new Promise((resolve) => {
    execFile('python3', [AKSHARE_SCRIPT, code], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const data = JSON.parse(stdout);
        const r = data[code];
        if (r && r.nav) {
          resolve({
            name: '', // name fetched separately
            nav: String(r.nav),
            dwjz: String(r.nav),
            jzrq: r.date || '',
            gszzl: String(r.change_pct || 0),
          });
        } else {
          resolve(null);
        }
      } catch { resolve(null); }
    });
  });
}

async function batchAkshare(codes) {
  return new Promise((resolve) => {
    const input = JSON.stringify(codes);
    const child = execFile('python3', [AKSHARE_SCRIPT, '--stdin'], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }, (err, stdout) => {
      if (err) return resolve({});
      try {
        const data = JSON.parse(stdout);
        const results = {};
        for (const [code, r] of Object.entries(data)) {
          if (r.nav) {
            results[code] = {
              name: '',
              nav: String(r.nav),
              dwjz: String(r.nav),
              jzrq: r.date || '',
              gszzl: String(r.change_pct || 0),
            };
          }
        }
        resolve(results);
      } catch { resolve({}); }
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

async function fetchUrl(url, headers = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
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
    // Use REST API for accurate NAV + date
    const apiUrl = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=1`;
    const apiResp = await fetchUrl(apiUrl, { Referer: 'https://fundf10.eastmoney.com/' });
    const json = await apiResp.json();
    const list = json?.Data?.LSJZList;
    if (!list || !list.length) return null;

    const latest = list[0];
    const dwjz = latest.DWJZ;
    const jzrq = latest.FSRQ;  // yyyy-MM-dd
    const changePct = latest.JZZZL || '0';

    // Get fund name from the old JS file (lightweight)
    let name = '';
    try {
      const jsUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
      const jsResp = await fetchUrl(jsUrl, { Referer: 'https://fund.eastmoney.com/' });
      const raw = await jsResp.text();
      const nameM = raw.match(/var\s+fS_name\s*=\s*"([^"]+)"/);
      if (nameM) name = nameM[1];

      // Money fund check
      const ishbM = raw.match(/var\s+ishb\s*=\s*(true|false)/);
      if (ishbM && ishbM[1] === 'true') {
        return { name, nav: '1.0000', dwjz: '1.0000', jzrq, type_hint: '货币基金', gszzl: '0' };
      }
    } catch {}

    if (!name) return null;

    return { name, nav: dwjz, dwjz, jzrq, gszzl: changePct };
  } catch { return null; }
}

async function trySina(code) {
  try {
    const url = `https://hq.sinajs.cn/list=f_${code}`;
    const resp = await fetchUrl(url, { Referer: 'https://finance.sina.com.cn/' });
    const ab = await resp.arrayBuffer();
    const text = Buffer.from(ab).toString('utf-8').replace(/\ufffd/g, '');
    const textGbk = Buffer.from(ab).toString('gbk').replace(/\ufffd/g, '');

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
    { name: 'akshare', fn: tryAkshare },
    { name: '东方财富', fn: tryEastmoney },
    { name: '天天基金', fn: tryTiantian },
    { name: '新浪财经', fn: trySina },
  ];

  for (const api of apis) {
    try {
      const result = await api.fn(code);
      const ok = result && (result.name || api.name === 'akshare');
      if (ok) {
        result.source = api.name;
        // Supplement name if missing (akshare doesn't fetch name)
        if (!result.name) {
          try {
            const tt = await tryTiantian(code);
            if (tt?.name) result.name = tt.name;
          } catch {}
        }
        // Supplement with 天天基金 gsz (estimated NAV) for intraday display
        // Don't overwrite gszzl from akshare — it's the official daily change
        if (result.name && api.name !== '天天基金') {
          const tt = await tryTiantian(code);
          if (tt?.gsz) result.gsz = tt.gsz;
        }
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

  // 1) Try akshare batch first
  const akshareResults = await batchAkshare(codes);
  const remaining = codes.filter(c => !akshareResults[c]);
  for (const [code, result] of Object.entries(akshareResults)) {
    result.source = 'akshare';
    results[code] = result;
  }

  // 2) Fallback per-code for remaining
  if (remaining.length) {
    await Promise.all(remaining.map(async (code) => {
      const apis = [
        { name: '东方财富', fn: tryEastmoney },
        { name: '天天基金', fn: tryTiantian },
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
  }

  // Supplement with 天天基金 gsz (estimated NAV) for intraday display
  // Don't overwrite gszzl — akshare already provides the official daily change
  for (const [code, result] of Object.entries(results)) {
    if (!result.error && !result.gsz) {
      try {
        const tt = await tryTiantian(code);
        if (tt?.gsz) result.gsz = tt.gsz;
      } catch {}
    }
  }

  res.json(results);
});

async function fetchManager(code) {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const resp = await fetchUrl(url, { Referer: 'https://fund.eastmoney.com/' }, 10000);
    const raw = await resp.text();
    const m = raw.match(/var\s+Data_currentFundManager\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!m) return [];
    const arr = JSON.parse(m[1]);
    return arr.map(mgr => ({
      id: mgr.id,
      name: mgr.name,
      pic: mgr.pic ? `/api/proxy/mgr-img?url=${encodeURIComponent(mgr.pic)}` : '',
      workTime: mgr.workTime || '',
      fundSize: mgr.fundSize || '',
    }));
  } catch { return []; }
}

async function fetchHoldings(code) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=&rt=0.${Date.now()}`;
    const resp = await fetchUrl(url, { Referer: 'https://fundf10.eastmoney.com/' }, 10000);
    const raw = await resp.text();

    const dateM = raw.match(/(\d{4}-\d{2}-\d{2})/);
    const reportDate = dateM ? dateM[1] : '';

    const holdings = [];
    const trReg = /<tr>([\s\S]*?)<\/tr>/g;
    let trMatch;
    while ((trMatch = trReg.exec(raw)) !== null) {
      const tr = trMatch[1];
      const nameM = tr.match(/class='(?:toc|tol)'[^>]*><a[^>]*>([^<]+)<\/a>/) || tr.match(/style='line-height:18px'><a[^>]*>([^<]+)<\/a>/);
      const pctM = tr.match(/class='(?:toc|tor)'>([\d.]+)%<\/td>/);
      const secidM = tr.match(/quote\.eastmoney\.com\/unify\/r\/(\d+\.\d+)/);
      if (nameM && pctM) {
        holdings.push({
          name: nameM[1].trim(),
          pct: parseFloat(pctM[1]),
          secid: secidM ? secidM[1] : '',
        });
      }
    }
    return { reportDate, holdings };
  } catch { return { reportDate: '', holdings: [] }; }
}

async function fetchStockQuotesFromYahoo(secids) {
  const results = {};
  if (!secids.length) return results;

  const symbolMap = {}; // yahooSymbol -> secid
  const symbols = [];
  for (const s of secids) {
    const [market, code] = s.split('.');
    let ySymbol;
    if (market === '1') ySymbol = `${code}.SS`;   // Shanghai
    else if (market === '0') ySymbol = `${code}.SZ`; // Shenzhen
    else continue; // skip HK/other
    symbolMap[ySymbol] = s;
    symbols.push(ySymbol);
  }
  if (!symbols.length) return results;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbols.join(',')}?interval=1d&range=1d`;
    const resp = await fetchUrl(url, { Referer: 'https://finance.yahoo.com/' }, 8000);
    const data = await resp.json();
    const resultList = data?.chart?.result;
    if (!resultList) return results;

    for (const item of resultList) {
      const meta = item.meta;
      if (!meta) continue;
      const ySymbol = meta.symbol;
      const secid = symbolMap[ySymbol];
      if (!secid) continue;

      const price = meta.regularMarketPrice;
      const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
      const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      const changeAmt = prevClose > 0 ? price - prevClose : 0;
      results[secid] = {
        price: price || 0,
        changePct: Math.round(changePct * 100) / 100,
        changeAmt: Math.round(changeAmt * 100) / 100,
      };
    }
  } catch {}
  return results;
}

async function fetchStockQuotes(secids) {
  if (!secids.length) return {};

  // 1) Try Yahoo Finance first
  const yahooResults = await fetchStockQuotesFromYahoo(secids);
  const missing = secids.filter(s => !yahooResults[s]);
  if (!missing.length) return yahooResults;

  // 2) Fallback to Tencent for stocks Yahoo didn't cover
  try {
    const codes = missing.map(s => {
      const [market, code] = s.split('.');
      if (market === '1') return `sh${code}`;
      if (market === '0') return `sz${code}`;
      if (market === '116') return `r_hk${code}`;
      return `sz${code}`;
    });
    const url = `https://qt.gtimg.cn/q=${codes.join(',')}`;
    const resp = await fetchUrl(url, { Referer: 'https://gu.qq.com/' }, 5000);
    const raw = await resp.text();
    const tencResult = {};
    const lines = raw.split(';').filter(l => l.includes('="'));
    for (const line of lines) {
      const eqIdx = line.indexOf('="');
      if (eqIdx < 0) continue;
      const key = line.substring(0, eqIdx).replace('v_', '');
      const val = line.substring(eqIdx + 2).replace(/"$/, '');
      const parts = val.split('~');
      if (parts.length < 34) continue;
      const code = parts[2] || '';
      const price = parseFloat(parts[3]) || 0;
      const changeAmt = parseFloat(parts[31]) || 0;
      const changePct = parseFloat(parts[32]) || 0;
      if (code) tencResult[code] = { price, changePct, changeAmt };
    }
    for (const s of missing) {
      const [market, code] = s.split('.');
      if (tencResult[code]) yahooResults[s] = tencResult[code];
    }
  } catch {}
  return yahooResults;
}

router.get('/stock-quotes', async (req, res) => {
  const secids = (req.query.secids || '').split(',').filter(Boolean);
  if (!secids.length) return res.json({});
  const quotes = await fetchStockQuotes(secids);
  res.json(quotes);
});

router.get('/mgr-img', async (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl || !/^https?:\/\/pdf\.dfcfw\.com\//.test(imgUrl)) {
    return res.status(400).send('Invalid URL');
  }
  try {
    const resp = await fetchUrl(imgUrl, { Referer: 'https://fund.eastmoney.com/' }, 5000);
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await resp.arrayBuffer());
    res.send(buf);
  } catch {
    res.status(502).send('Fetch failed');
  }
});

router.get('/fund-detail', async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: '无效基金代码' });
  }

  const [managers, holdingsData] = await Promise.all([
    fetchManager(code),
    fetchHoldings(code),
  ]);

  res.json({ code, managers, ...holdingsData });
});

router.post('/batch-fund-detail', async (req, res) => {
  const { codes } = req.body;
  if (!Array.isArray(codes)) return res.status(400).json({ error: '参数格式错误' });

  const results = {};
  await Promise.all(codes.map(async (code) => {
    try {
      const [managers, holdingsData] = await Promise.all([
        fetchManager(code),
        fetchHoldings(code),
      ]);
      results[code] = { code, managers, ...holdingsData };
    } catch {
      results[code] = { code, managers: [], holdings: [], reportDate: '' };
    }
  }));

  res.json(results);
});

const LEVEL2_TO_LEVEL1 = {
  '白酒Ⅱ': '食品饮料', '食品加工': '食品饮料', '饮料乳品': '食品饮料', '调味发酵品Ⅱ': '食品饮料', '休闲食品': '食品饮料',
  '电池': '电力设备', '光伏设备': '电力设备', '风电设备': '电力设备', '电网设备': '电力设备', '电机Ⅱ': '电力设备',
  '国有大型银行Ⅱ': '银行', '股份制银行Ⅱ': '银行', '城商行Ⅱ': '银行', '农商行Ⅱ': '银行',
  '证券Ⅱ': '非银金融', '保险Ⅱ': '非银金融', '多元金融': '非银金融',
  '半导体': '电子', '元件': '电子', '光学光电子': '电子', '消费电子': '电子', '电子化学品Ⅱ': '电子',
  '软件开发': '计算机', '计算机设备': '计算机', 'IT服务Ⅱ': '计算机',
  '化学制药': '医药生物', '中药Ⅱ': '医药生物', '生物制品': '医药生物', '医疗器械': '医药生物', '医药商业': '医药生物', '医疗服务': '医药生物',
  '房地产开发': '房地产', '房地产服务': '房地产',
  '乘用车': '汽车', '商用车': '汽车', '汽车零部件': '汽车', '摩托车及其他': '汽车',
  '航空装备Ⅱ': '国防军工', '航天装备Ⅱ': '国防军工', '军工电子Ⅱ': '国防军工', '地面兵装Ⅱ': '国防军工',
  '煤炭开采': '煤炭',
  '工业金属': '有色金属', '小金属': '有色金属', '金属新材料': '有色金属', '贵金属': '有色金属', '能源金属': '有色金属',
  '炼化及贸易': '石油石化', '油服工程': '石油石化',
  '化学原料': '基础化工', '化学制品': '基础化工', '农化制品': '基础化工', '塑料': '基础化工', '橡胶': '基础化工',
  '通用设备': '机械设备', '专用设备': '机械设备', '自动化设备': '机械设备', '轨交设备Ⅱ': '机械设备', '工程机械': '机械设备',
  '电力': '公用事业', '燃气Ⅱ': '公用事业', '环保设备Ⅱ': '公用事业',
  '航空机场': '交通运输', '铁路公路': '交通运输', '航运港口': '交通运输', '物流': '交通运输',
  '水泥': '建筑材料', '玻璃玻纤': '建筑材料', '装修建材': '建筑材料',
  '房屋建设Ⅱ': '建筑装饰', '基础建设': '建筑装饰', '专业工程': '建筑装饰', '工程咨询服务Ⅱ': '建筑装饰',
  '白色家电': '家用电器', '黑色家电': '家用电器', '小家电': '家用电器', '家电零部件Ⅱ': '家用电器',
  '游戏Ⅱ': '传媒', '影视院线': '传媒', '广告营销': '传媒', '出版': '传媒', '数字媒体': '传媒',
  '通信服务': '通信', '通信设备': '通信',
  '种植业': '农林牧渔', '养殖业': '农林牧渔', '渔业': '农林牧渔', '饲料': '农林牧渔', '动物保健Ⅱ': '农林牧渔',
  '纺织制造': '纺织服饰', '服装家纺': '纺织服饰', '饰品': '纺织服饰',
  '造纸': '轻工制造', '家居用品': '轻工制造', '文娱用品': '轻工制造', '包装印刷': '轻工制造',
  '旅游及景区': '社会服务', '酒店餐饮': '社会服务', '教育': '社会服务', '专业服务': '社会服务',
  '普钢': '钢铁', '特钢Ⅱ': '钢铁',
  '焦炭Ⅱ': '煤炭',
  '贸易Ⅱ': '商贸零售', '一般零售': '商贸零售', '专业连锁Ⅱ': '商贸零售',
};

function level2ToLevel1(level2) {
  if (LEVEL2_TO_LEVEL1[level2]) return LEVEL2_TO_LEVEL1[level2];
  // Strip Ⅰ/Ⅱ/Ⅲ suffix and try again
  const stripped = level2.replace(/[ⅠⅡⅢ]$/, '');
  if (LEVEL2_TO_LEVEL1[stripped]) return LEVEL2_TO_LEVEL1[stripped];
  return '其他';
}

async function fetchIndustries(secids) {
  const results = {};
  await Promise.all(secids.map(async (secid) => {
    try {
      // secid format: "0.000001" (SZ) or "1.688012" (SH)
      const parts = secid.split('.');
      const market = parts[0] === '1' ? 'SH' : 'SZ';
      const code = parts[1] || '';
      const stockCode = market + code;
      const url = `https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=${stockCode}`;
      const resp = await fetchUrl(url, { Referer: 'https://emweb.securities.eastmoney.com/' }, 8000);
      const data = await resp.json();
      const jbzl = data?.jbzl?.[0];
      if (jbzl) {
        let level1 = '其他';
        // EM2016 format: "金融-银行-股份制与城商行" → Level1 = "金融"
        const em2016 = jbzl.EM2016 || '';
        if (em2016) {
          level1 = em2016.split('-')[0].trim();
        } else {
          // Fallback: INDUSTRYCSRC1 format: "金融业-货币金融服务" → Level1 = "金融"
          const csrc = jbzl.INDUSTRYCSRC1 || '';
          if (csrc) {
            level1 = csrc.split('-')[0].replace(/业$/, '');
          }
        }
        results[secid] = {
          code,
          name: jbzl.SECURITY_NAME_ABBR || '',
          level2: em2016,
          level1,
        };
      } else {
        results[secid] = { level2: '', level1: '其他' };
      }
    } catch {
      results[secid] = { level2: '', level1: '其他' };
    }
  }));
  return results;
}

router.get('/industries', async (req, res) => {
  const secids = (req.query.secids || '').split(',').filter(Boolean);
  if (!secids.length) return res.json({});
  const industries = await fetchIndustries(secids);
  res.json(industries);
});

router.post('/industries', async (req, res) => {
  const { secids } = req.body;
  if (!Array.isArray(secids) || !secids.length) return res.json({});
  const industries = await fetchIndustries(secids);
  res.json(industries);
});

module.exports = router;
