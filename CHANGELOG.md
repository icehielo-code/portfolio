# 变更日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-05-02

### 新增
- 初始版本发布
- 基金投资组合仪表板基础功能
- 实时数据展示和图表
- 响应式设计支持

### 技术特性
- 纯HTML/CSS/JavaScript实现
- 使用Chart.js进行数据可视化
- 支持移动端和桌面端
- 本地HTTP服务器支持

## 版本管理说明

### 版本号格式
- **主版本号 (MAJOR)**：不兼容的API修改
- **次版本号 (MINOR)**：向下兼容的功能性新增
- **修订号 (PATCH)**：向下兼容的问题修正

### 发布流程
1. 更新版本号：`npm version <major|minor|patch>`
2. 提交变更：`git commit -am "版本更新"`
3. 创建标签：`git tag v1.0.0`
4. 推送到远程：`git push --follow-tags`

### 常用命令
- `npm version patch` - 发布修订版本
- `npm version minor` - 发布次版本
- `npm version major` - 发布主版本
- `npm run release` - 自动发布流程