# 产品需求文档 — CHONG 私人基金管理工具

**版本：** 2.0.0  
**日期：** 2026-05-03  
**状态：** 开发中（已从单 HTML 文件重构为前后端分离的 SPA 架构）

---

## 1. 产品概述

一款基于 Web 的个人基金投资组合管理仪表板。专为个人用户（CHONG）设计，用于跟踪 A 股公募基金和 ETF 持仓、可视化资产配置、获取 AI 投资建议，以及通过 OCR 截图导入持仓数据。

### 1.1 解决的问题

管理多只中国公募基金的个人投资者缺乏统一工具来：
- 汇总各基金持仓并获取实时净值
- 按大类、风格、基金经理等维度可视化资产配置
- 基于目标权重给出可操作的再平衡建议
- 利用 AI 基于实际持仓提供个性化的投资分析

### 1.2 目标用户

个人用户（CHONG），管理 A 股公募基金和 ETF 的个人投资组合。

---

## 2. 功能清单

### 2.1 基金管理（核心）

- **手动增删改**基金信息：代码（6 位）、名称、类型、净值、份额、目标仓位 %、成本净值、大类、风格、基金经理、前十大持仓
- **代码自动查询：** 输入 6 位基金代码 → 从外部 API 自动回填名称和最新净值（三级回退：天天基金 → 东方财富 → 新浪财经）
- **批量净值刷新：** 一键从外部数据源刷新全部基金净值
- **数据导入/导出：** 全量数据库备份/恢复（JSON 格式）

### 2.2 持仓可视化（AllocatePage）

- **环形图** — 基金维度：每只基金占总市值的百分比
- **环形图** — 大类维度：权益类/境内固收/海外市场/商品及其它
- **环形图** — 风格维度（仅权益类基金）：价值型/均衡型/成长型
- **基金经理集中度：** 卡片展示每位基金经理的总管理规模、管理基金、从业经验
- **底层资产集中度：** 每只基金的前十大持仓股票，附带腾讯行情实时涨跌幅

### 2.3 投资策略管理

- 预置策略：均衡策略、定投策略、趋势策略
- 支持自定义策略：名称、描述、规则列表（每行一条）
- 同一时间仅一个活跃策略
- 策略信息作为上下文提供给 AI 顾问

### 2.4 AI 投资顾问（AdvicePage）

- **对话界面**，接入 DeepSeek API（对话历史持久化到 SQLite）
- **6 种预设分析类型：** 操作建议、再平衡计算、深度分析、市场分析、风险评估、策略优化
- **上下文注入：** 每种预设查询均自动附带当前持仓摘要和活跃策略规则
- **OCR 截图导入：** 上传持仓截图 → SiliconFlow OCR 识别 → DeepSeek 解析基金代码/名称/份额/净值 → 用户审核后一键导入

### 2.5 组合健康指标（OverviewPage）

- 总市值、今日估算盈亏、持有收益（绝对值 + 百分比）、最大回撤
- **双模式盈亏计算**（可切换）：
  - 成本基准模式：盈亏 = (当前净值 − 成本净值) × 份额
  - 阶段基准模式：盈亏基于检查点净值快照计算
- **再平衡建议：** 逐只基金当前仓位 vs 目标仓位，给出买入/卖出/持有建议（±3% 阈值）
- **净值检查点：** 带时间戳的净值快照，用于追踪组合历史

---

## 3. 技术架构

### 3.1 部署模式

- **开发环境：** Express (:3000) + Vite 开发服务器 (:5173) 通过代理并联运行，使用 `npm run dev` 启动
- **生产环境：** Express 直接托管 `client/dist/` 下的构建产物，使用 `npm start` 启动

### 3.2 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Vue 3.5（Composition API）、Pinia 3、Vite 8、Axios |
| 后端 | Express 4.21、Node.js |
| 数据库 | SQLite（better-sqlite3，WAL 模式） |
| AI/ML | DeepSeek API（对话）、SiliconFlow API（OCR） |
| 外部数据 | 天天基金、东方财富、新浪财经（基金净值）、腾讯行情（股票报价） |

### 3.3 数据模型

```
funds（基金表）
  id, code(唯一), name, type, nav, shares, target, origin_nav,
  category, style, manager, top_holdings(JSON), sort_order, created_at, updated_at

strategies（策略表）
  id, name, description, rules(JSON), is_active, sort_order, created_at, updated_at

checkpoints（检查点表）
  id, label, checkpoint_date, nav_snapshots(JSON), created_at

settings（设置表）
  key(主键), value, updated_at

ai_conversations（AI对话记录表）
  id, role, content, created_at
```

---

## 4. 外部 API 依赖

| 服务 | 接口 | 用途 | 回退方案 |
|---|---|---|---|
| 天天基金 | `fundgz.1234567.com.cn/js/{code}.js` | 实时估值 | → 东方财富 |
| 东方财富 | `fund.eastmoney.com/pingzhongdata/{code}.js` | 历史净值 + 基金经理 | → 新浪财经 |
| 新浪财经 | `hq.sinajs.cn/list=f_{code}` | 基金基本名称/净值 | — |
| 东方财富 | `fundf10.eastmoney.com/FundArchivesDatas.aspx` | 前十大持仓 | — |
| 腾讯行情 | `qt.gtimg.cn/q={codes}` | 股票实时价格 | — |
| DeepSeek | `api.deepseek.com/v1/chat/completions` | AI 对话 + OCR 基金解析 | — |
| SiliconFlow | `api.siliconflow.cn/v1/chat/completions` | OCR 图片识别 | — |

---

## 5. 已知局限与技术债务

1. **无认证机制：** 单用户工具，无登录功能，不适合多用户部署。
2. **无测试覆盖：** 前后端均无任何自动化测试。
3. **无代码规范检查：** 未配置 ESLint、Prettier 或类型检查。
4. **中文字符串硬编码：** 所有 UI 文案和 AI 提示词均硬编码为中文，无国际化支持。
5. **无分页：** 基金列表、策略列表、检查点均返回全部记录，未做分页限制。
6. **外部 API 脆弱性：** 三级净值查询依赖于用正则解析第三方 JavaScript/HTML 响应，上游格式变化即导致查询失败。
7. **OCR 流水线可靠性：** 两步 OCR→解析依赖 SiliconFlow 和 DeepSeek 两个 API 均成功调用。解析步骤通过提示词工程从 OCR 文本中提取 JSON，无结构化校验。
8. **SQLite 并发：** WAL 模式有所缓解，但 better-sqlite3 为同步调用，并发请求下可能成为瓶颈。
9. **`fund_dashboard.html`：** v1 版本的单文件应用仍存在于项目根目录（99KB），已废弃但未清理。
10. **`server.py` 和 `data/funds.template.json`：** 早期版本的 Python 服务和 JSON 数据存储残留。

---

## 6. 后续规划

- 增加用户认证以支持潜在的多用户场景
- 若有官方基金数据 API，替换当前基于正则的解析方式
- 增加每日自动净值快照定时任务
- 移动端 PWA 支持
- 基于历史净值数据的组合回测
- QDII 基金多币种支持
- 再平衡触发条件的邮件/通知提醒
