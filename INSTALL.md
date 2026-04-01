# Students Talk - 快速安装指南

## 前提条件

确保你的系统已安装：

- **Node.js 18+** - 检查：`node --version`
- **pnpm 9+** - 检查：`pnpm --version`
- **PostgreSQL 14+** - 检查：`psql --version`

## 安装步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置数据库

#### macOS (使用 Homebrew)

```bash
# 安装 PostgreSQL
brew install postgresql@14

# 启动服务
brew services start postgresql@14

# 创建数据库
createdb students-talk
```

#### Ubuntu/Debian

```bash
# 安装 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql

# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE \"students-talk\";"
```

### 3. 配置环境变量

#### 后端配置

```bash
# 复制环境变量模板
cp apps/server/.env.example apps/server/.env

# 编辑配置 (使用你喜欢的编辑器)
# 需要设置 DATABASE_URL 和 QWEN_API_KEY
```

编辑 `apps/server/.env`：

```bash
# 数据库连接 (根据你的实际情况修改)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/students-talk?schema=public

# Qwen API Key (从阿里云百炼控制台获取)
QWEN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 其他配置保持默认即可
```

#### 前端配置

```bash
cp apps/web/.env.example apps/web/.env
```

`apps/web/.env` 内容：

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

### 4. 初始化数据库

```bash
# 生成 Prisma 客户端
pnpm db:generate

# 推送数据库 Schema
pnpm db:push
```

### 5. 启动开发服务器

```bash
# 启动前后端服务 (推荐使用)
pnpm dev

# 或者分别启动
pnpm dev:server  # 后端，运行在 http://localhost:3001
pnpm dev:web     # 前端，运行在 http://localhost:3000
```

### 6. 访问应用

打开浏览器访问：**http://localhost:3000**

## 获取 Qwen API Key

1. 访问 https://dashscope.console.aliyun.com/
2. 注册/登录阿里云账号
3. 进入「API-KEY 管理」
4. 创建新的 API Key
5. 开通 `qwen3.5-omni-plus-realtime` 服务

## 常见问题

### Q: `pnpm: command not found`

**A:** 安装 pnpm：

```bash
npm install -g pnpm
```

### Q: 数据库连接失败

**A:** 检查 PostgreSQL 是否运行：

```bash
# macOS
brew services list

# Ubuntu
sudo systemctl status postgresql
```

### Q: 端口已被占用

**A:** 修改 `apps/server/.env` 中的 `PORT`，并相应更新前端 `.env` 中的 URL。

### Q: WebSocket 连接失败

**A:** 确保后端服务已启动，并检查浏览器控制台中的 WebSocket URL 是否正确。

## 生产构建

```bash
# 构建
pnpm build

# 启动生产服务
pnpm start:server
pnpm start:web
```

## 下一步

- 查看 [README.md](./README.md) 了解详细功能
- 开始你的第一次口语练习：http://localhost:3000/practice
