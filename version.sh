#!/bin/bash

# 版本管理脚本
# 使用方法：./version.sh <patch|minor|major>

set -e

echo "🚀 开始版本发布流程..."

# 检查参数
if [ $# -eq 0 ]; then
    echo "❌ 请指定版本类型: patch, minor 或 major"
    echo "用法: ./version.sh <patch|minor|major>"
    exit 1
fi

VERSION_TYPE=$1

# 验证版本类型
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ 无效的版本类型: $VERSION_TYPE"
    echo "请使用: patch, minor 或 major"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本: $CURRENT_VERSION"

# 更新版本
echo "🔄 更新版本 ($VERSION_TYPE)..."
npm version $VERSION_TYPE

# 获取新版本
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ 新版本: $NEW_VERSION"

# 更新变更日志
echo "📝 更新变更日志..."
# 这里可以添加自动更新CHANGELOG.md的逻辑

# 提交更改
echo "💾 提交版本变更..."
git add .
git commit -m "chore: 发布版本 v$NEW_VERSION"

# 创建标签
echo "🏷️ 创建Git标签..."
git tag -a "v$NEW_VERSION" -m "版本 v$NEW_VERSION"

# 推送到远程
echo "📤 推送到GitHub..."
git push origin main
git push --tags

echo "🎉 版本 v$NEW_VERSION 发布成功!"
echo "🔗 GitHub仓库: https://github.com/icehielo-code/portfolio"
echo "📋 变更日志: CHANGELOG.md"