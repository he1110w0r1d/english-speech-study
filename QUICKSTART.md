# 5 分钟快速开始

> 本指南帮助你在 5 分钟内启动并运行 Students Talk 应用

## 第一步：检查环境 (1 分钟)

```bash
# 检查 Node.js 版本 (需要 18+)
node --version

# 检查 pnpm (需要 9+)
pnpm --version

# 如果没有 pnpm，运行：
npm install -g pnpm
```

## 第二步：安装依赖 (1 分钟)

```bash
cd students-talk
pnpm install
```

## 第三步：配置环境 (1 分钟)

### 3.1 后端环境

```bash
# 复制环境文件
cp apps/server/.env.example apps/server/.env
```

**重要**: 你需要配置 Qwen API Key：

1. 访问 https://dashscope.console.aliyun.com/
2. 创建 API Key
3. 编辑 `apps/server/.env`：

```bash
QWEN_API_KEY=sk-你的密钥
```

> 💡 **临时测试**: 如果暂时没有 API Key，应用会使用 Mock 数据，仍然可以体验前端功能。

### 3.2 前端环境

```bash
cp apps/web/.env.example apps/web/.env
```

## 第四步：启动数据库 (1 分钟)

### macOS

```bash
# 如果没有安装
brew install postgresql@14

# 启动服务
brew services start postgresql@14

# 创建数据库
createdb students-talk
```

### Ubuntu/Debian

```bash
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE \"students-talk\";"
```

### 初始化数据库结构

```bash
pnpm db:push
```

## 第五步：启动应用 (1 分钟)

```bash
# 一键启动前后端
pnpm dev
```

看到以下输出表示成功：

```
[server] 🚀 Server running on http://localhost:3001
[web]    ready - started server on 0.0.0.0:3000
```

## 开始使用

访问 **http://localhost:3000**

### 第一次练习

1. 点击「开始练习」
2. 选择「自由对话」模式
3. 选择难度级别（推荐：中级）
4. 点击「开始练习」
5. 允许浏览器使用麦克风
6. 开始和 AI 对话！

## 常见问题速查

| 问题 | 解决方案 |
|------|----------|
| `pnpm: command not found` | `npm install -g pnpm` |
| 数据库连接失败 | 检查 PostgreSQL 是否运行 |
| 端口被占用 | 修改 `.env` 中的 PORT |
| 麦克风无法使用 | 检查浏览器权限设置 |

## 下一步

- 📖 查看完整文档：[README.md](./README.md)
- 🔌 API 文档：[API.md](./API.md)
- 📝 详细安装指南：[INSTALL.md](./INSTALL.md)

---

祝你练习愉快！🎉
