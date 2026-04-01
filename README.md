# Students Talk - AI 口语练习应用

基于 **Qwen-Omni-Realtime** 大模型开发的实时英语口语练习 Web 应用。

## ✨ 核心功能

- **🎙️ 实时语音对话** - 低延迟的实时语音交互，支持自然打断
- **📊 结构化评估** - 发音、流利度、语法、词汇、任务完成度五维评分
- **🎭 多种练习模式** - 自由对话、情景角色扮演、跟读复述
- **📈 历史记录追踪** - 查看过往练习报告和进步轨迹

## 🏗️ 技术架构

```
students-talk/
├── apps/
│   ├── web/          # Next.js 前端
│   └── server/       # NestJS 后端
├── packages/
│   ├── types/        # 共享 TypeScript 类型
│   └── prompts/      # Prompt 模板
└── prisma/           # 数据库 Schema
```

### 技术栈

**前端**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand (状态管理)
- Socket.IO Client

**后端**
- NestJS
- WebSocket (Socket.IO)
- Prisma ORM
- Qwen-Omni-Realtime API

**数据库**
- PostgreSQL

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+

### 1. 克隆与安装

```bash
cd students-talk
pnpm install
```

### 2. 配置环境变量

复制后端环境变量模板：

```bash
cp apps/server/.env.example apps/server/.env
```

编辑 `apps/server/.env`：

```bash
# 数据库连接
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/students-talk?schema=public

# Qwen-Omni API 配置
QWEN_API_KEY=your_api_key_here
QWEN_MODEL=qwen3.5-omni-plus-realtime
QWEN_WS_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference/

# 服务端口
PORT=3001
FRONTEND_URL=http://localhost:3000
```

复制前端环境变量模板：

```bash
cp apps/web/.env.example apps/web/.env
```

编辑 `apps/web/.env`：

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

### 3. 初始化数据库

```bash
# 启动 PostgreSQL (如果未运行)
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql

# 创建数据库
psql -U postgres -c "CREATE DATABASE \"students-talk\";"

# 运行迁移
pnpm db:push
```

### 4. 启动开发服务

```bash
# 启动前后端开发服务器
pnpm dev

# 或者分别启动
pnpm dev:server  # 后端 :3001
pnpm dev:web     # 前端 :3000
```

访问 http://localhost:3000 开始使用。

## 📖 功能说明

### 练习模式

1. **自由对话 (FREE_TALK)**
   - 日常口语陪练
   - AI 主动提问引导
   - 适合日常练习

2. **情景角色扮演 (ROLE_PLAY)**
   - 餐厅点餐、求职面试、机场值机、酒店入住
   - 沉浸式场景体验
   - 实战演练

3. **跟读/复述 (REPEAT)**
   - AI 示范句领读
   - 重点评估发音和流利度
   - 适合发音训练

### 评估维度

| 维度 | 说明 |
|------|------|
| 发音清晰度 | 语音可懂度、音标准确性 |
| 流利度 | 语速、停顿、连贯性 |
| 语法准确度 | 句型、时态、语态 |
| 词汇表达 | 词汇丰富度、准确性 |
| 任务完成度 | 对话参与度、目标达成 |

## 🔌 API 接口

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | POST | 创建练习会话 |
| `/api/sessions/:id/start` | POST | 开始练习 |
| `/api/sessions/:id/end` | POST | 结束练习并触发评分 |
| `/api/sessions/:id` | GET | 获取会话详情 |
| `/api/sessions/:id/report` | GET | 获取评分报告 |
| `/api/history` | GET | 获取历史记录 |
| `/api/presets` | GET | 获取练习模式预设 |

### WebSocket 事件

**客户端 → 服务端**
- `client:start_session` - 开始会话
- `client:audio_chunk` - 发送音频块
- `client:commit_audio` - 提交音频缓冲区
- `client:end_session` - 结束会话

**服务端 → 客户端**
- `server:session_ready` - 会话就绪
- `server:user_transcript_delta` - 用户转写文本
- `server:assistant_text_delta` - AI 回复文本
- `server:assistant_audio_chunk` - AI 音频流
- `server:report_ready` - 评估报告就绪

## 📂 项目结构

```
students-talk/
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── prisma/           # 数据库服务
│   │       ├── qwen-omni/        # Qwen API 服务
│   │       ├── ws/               # WebSocket 网关
│   │       ├── sessions/         # REST 控制器
│   │       └── main.ts
│   └── web/
│       └── src/
│           ├── app/              # Next.js 页面
│           │   ├── practice/     # 练习页面
│           │   ├── report/       # 报告页面
│           │   └── history/      # 历史页面
│           └── lib/              # 工具库
│               ├── api.ts        # API 客户端
│               ├── audio.ts      # 音频处理
│               └── store.ts      # 状态管理
├── packages/
│   ├── prompts/
│   │   └── src/
│   │       └── index.ts          # Prompt 模板
│   └── types/
│       └── src/
│           └── index.ts          # TypeScript 类型
└── prisma/
    └── schema.prisma             # 数据库模型
```

## 🔑 获取 API Key

1. 访问 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录账号
3. 创建 API Key
4. 开通 `qwen3.5-omni-plus-realtime` 或 `qwen3-omni-flash-realtime` 服务权限

## 🛠️ 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务
pnpm start

# 数据库操作
pnpm db:generate   # 生成 Prisma 客户端
pnpm db:push       # 推送 schema 到数据库
pnpm db:migrate    # 运行迁移
```

## 📝 TODO

- [ ] 接入真实 LLM 评估接口
- [ ] 添加用户认证系统
- [ ] 支持音频文件上传复审
- [ ] 添加词汇本功能
- [ ] 支持多语言
- [ ] React Native 移动端

## 📄 License

MIT
