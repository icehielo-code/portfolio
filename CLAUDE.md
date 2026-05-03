# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发模式（同时启动 Express :3000 + Vite :5173）
npm run dev

# 构建前端（生产环境）
npm run build

# 生产模式（Express 直接托管构建后的前端）
npm start

# 仅启动前端开发服务器
cd client && npm run dev
```

项目当前没有配置测试套件或代码检查工具。

## 架构概览

**技术栈：** Vue 3（Vite + Pinia，无 vue-router）→ Express.js（REST API）→ SQLite（better-sqlite3，WAL 模式）

### 后端 (`server/`)

- `server/index.js` — Express 入口。挂载 6 组路由到 `/api/` 下。生产环境下托管 `client/dist/` 静态资源，非 `/api` 路径回退到 `index.html` 支持 SPA。同时处理 `/api/export` 和 `/api/import` 全量数据导出/导入。
- `server/db.js` — SQLite 初始化。创建 5 张表（`funds`、`strategies`、`checkpoints`、`settings`、`ai_conversations`），预置 3 条默认策略（均衡/定投/趋势）和 `origin_mode` 设置项。直接导出 `better-sqlite3` 实例，所有路由通过 `require('../db')` 引用。
- `server/routes/funds.js` — 基金 CRUD。校验 6 位数字基金代码。支持 `PUT /batch/nav` 批量更新净值。
- `server/routes/strategies.js` — 投资策略 CRUD。`PUT /activate/:id` 会先将所有策略设为非活跃，再激活指定策略（同一时间仅一个活跃策略）。
- `server/routes/checkpoints.js` — 净值快照检查点（标签 + 日期 + JSON 快照）。
- `server/routes/settings.js` — 通用键值存储。目前仅用 `origin_mode` 键控制收益计算基准（成本净值 vs 检查点净值）。
- `server/routes/proxy.js` — 代理外部基金数据接口。三级回退查询：天天基金 → 东方财富 → 新浪财经。同时获取基金经理信息、前十大持仓，以及通过腾讯 `qt.gtimg.cn` 获取实时股票行情。所有外部请求使用浏览器 UA、8 秒超时。
- `server/routes/ai.js` — DeepSeek AI 投资顾问（根据当前持仓/策略构建上下文）和 SiliconFlow OCR 截图导入流水线。对话历史持久化到 `ai_conversations` 表。

### 前端 (`client/`)

- 未使用 Vue Router — 通过 `App.vue` 中的 `activeTab` 响应式变量配合 `v-if` 切换页面。
- `App.vue` 通过 `provide()` 提供三个注入函数：`openEdit(fund)`、`toast(msg)`、`openAI(type)`。子视图/组件通过 `inject()` 获取。
- `stores/fund.js` — 唯一的 Pinia store。持有 `funds`、`strategies`、`checkpoints`、`originMode`。所有 API 变更通过 store actions 进行，API 调用成功后同步更新本地状态。`refreshAllNAVs()` 批量查询外部 API 后写回净值。
- `api/index.js` — Axios 实例（`baseURL: '/api'`）。API 函数按领域对象分组，均以 `.then(r => r.data)` 解包。
- **页面：** `OverviewPage`（关键指标、基金列表、再平衡建议、检查点）、`AllocatePage`（环形图：概览/大类/风格/基金经理/底层资产集中度）、`AdvicePage`（AI 对话 + OCR 截图导入）、`StrategyPage`（策略列表 + 创建/编辑表单）。
- **组件：** `HeaderBar`（标题、刷新净值、导出/导入、AI 快捷入口）、`TabNav`（4 个标签页，v-model）、`EditModal`（添加/编辑基金，含 6 位代码自动查询）、`Toast`。

### 数据流

1. 挂载时 `App.vue` 调用 `store.loadAll()`，并行请求基金、策略、检查点和 `origin_mode`。
2. 基金代码查询（`EditModal.lookupFund`）调用 `/api/proxy?code=XXXXXX`，依次回退 天天→东方财富→新浪。
3. 净值刷新（`HeaderBar.refreshNav`）调用 `store.refreshAllNAVs()` → 批量代理查询 → 批量净值更新。
4. `origin_mode` 切换改变收益计算方式（成本基准/阶段基准），持久化到 `settings` 表。

## 环境变量

需在 `.env` 中配置：

| 变量 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` | AI 对话 + OCR 基金解析 |
| `SILICONFLOW_API_KEY` | OCR 图片识别（SiliconFlow） |
| `AI_MODEL` | 对话模型（默认：`deepseek-chat`） |
| `OCR_MODEL` | OCR 模型（默认：`deepseek-ai/DeepSeek-OCR`） |
| `PORT` | Express 服务端口（默认：`3000`） |

## 数据库

SQLite 文件位于 `data/fund.db`。首次运行时自动建表。启用 WAL 模式。表结构定义在 `server/db.js`。导入/导出通过 `/api/export` 和 `/api/import` 接口使用 JSON 格式。

## 安全提醒

`.env` 文件包含 API 密钥，已在 `.gitignore` 中排除。请定期检查 git 历史中是否曾意外提交过该文件，如有则需立即轮换密钥。
