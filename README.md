# 基金投资组合仪表板

一个基于Web的基金投资组合管理和可视化仪表板应用。

## 功能特性

- 📊 实时基金数据展示
- 📈 交互式图表和可视化
- 📱 响应式设计，支持移动端
- 💰 投资组合管理
- 🔄 实时数据更新

## 快速开始

### 本地运行

1. 克隆仓库
```bash
git clone https://github.com/icehielo-code/portfolio.git
cd portfolio
```

2. 启动本地服务器
```bash
# 使用npm
npm start

# 或直接使用Python
python3 -m http.server 8080
```

3. 打开浏览器访问 `http://localhost:8080/fund_dashboard.html`

## 版本管理

项目使用语义化版本管理。

### 当前版本
- **版本号**: 1.0.0
- **发布日期**: 2026-05-02

### 版本发布

```bash
# 发布修订版本（bug修复）
./version.sh patch

# 发布次版本（新功能）
./version.sh minor

# 发布主版本（重大变更）
./version.sh major
```

### 版本历史

详细版本变更记录请查看 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **图表**: Chart.js
- **开发工具**: Git, npm
- **部署**: GitHub Pages

## 项目结构

```
portfolio/
├── fund_dashboard.html    # 主应用文件
├── package.json           # 项目配置和版本管理
├── CHANGELOG.md          # 变更日志
├── version.sh            # 版本发布脚本
└── .gitignore            # Git忽略文件
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

- GitHub: [@icehielo-code](https://github.com/icehielo-code)
- 项目地址: https://github.com/icehielo-code/portfolio