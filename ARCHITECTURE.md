# 架构设计文档

## 系统概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                            前端 (Next.js)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   首页       │  │   练习页     │  │   报告页     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          │                                          │
│              ┌───────────┴───────────┐                             │
│              │   Zustand Store       │                             │
│              └───────────────────────┘                             │
│                          │                                          │
│         ┌────────────────┼────────────────┐                        │
│         │                │                │                        │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐                │
│  │ REST Client │  │ WS Client   │  │ Audio       │                │
│  │ (API)       │  │ (Socket.IO) │  │ Processor   │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        后端 (NestJS)                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      WebSocket Gateway                        │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │  │
│  │  │ Session 管理   │  │ 音频流转发    │  │ 事件路由       │ │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│              ┌───────────────┼───────────────┐                     │
│              │               │               │                     │
│       ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐             │
│       │ Sessions    │ │ Qwen-Omni   │ │ Prisma      │             │
│       │ Controller  │ │ Service     │ │ Service     │             │
│       └─────────────┘ └─────────────┘ └─────────────┘             │
│              │               │               │                     │
│              │               │               │                     │
│              │        ┌──────▼──────┐        │                     │
│              │        │ Qwen WebSocket       │                     │
│              │        │ (Realtime API)       │                     │
│              │        └─────────────┘        │                     │
│              │                               │                     │
│              └───────────────┼───────────────┘                     │
│                              │                                      │
│                              ▼                                      │
│                    ┌─────────────────┐                             │
│                    │   PostgreSQL    │                             │
│                    └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心模块说明

### 1. 前端模块

#### 页面结构

| 页面 | 路由 | 功能 |
|------|------|------|
| 首页 | `/` | 产品介绍、入口引导 |
| 练习配置页 | `/practice` | 选择模式、难度、话题 |
| 练习室 | `/practice/[id]` | 实时对话界面 |
| 报告页 | `/report/[id]` | 评估报告展示 |
| 历史记录 | `/history` | 历史练习列表 |

#### 核心 Hook/Store

```typescript
// useStore - 全局状态管理
interface SessionState {
  // 会话信息
  sessionId: string | null;
  mode: PracticeMode | null;
  status: 'idle' | 'connecting' | 'active' | 'ending';

  // 实时状态
  messages: Message[];
  isRecording: boolean;
  isSpeaking: boolean;
  connectionState: 'disconnected' | 'connected' | 'error';

  // 评估
  report: EvaluationReport | null;
}
```

#### 音频处理流程

```
麦克风输入 (48kHz)
     │
     ▼
AudioWorklet
     │
     ▼
降采样至 16kHz
     │
     ▼
Float32Array → Int16Array
     │
     ▼
Base64 编码
     │
     ▼
WebSocket 发送
```

### 2. 后端模块

#### WebSocket Gateway

```typescript
// 核心事件处理流程

client:start_session
    │
    ├─→ 创建 PracticeSession (DB)
    ├─→ 初始化 SessionState
    ├─→ 构建 Prompt
    ├─→ 连接 Qwen-Omni WebSocket
    └─→ 返回 server:session_ready

client:audio_chunk
    │
    ├─→ 转发到 Qwen (input_audio_buffer.append)
    └─→ (Manual 模式需要 commit)

// Qwen 事件 → 前端
response.audio.delta → server:assistant_audio_chunk
response.text.delta  → server:assistant_text_delta
input_audio_buffer.speech_started → server:turn_start
input_audio_buffer.speech_stopped → server:turn_end
```

#### Qwen-Omni Service

```typescript
interface QwenSessionConfig {
  modalities: ['audio', 'text'];
  instructions: string;        // System Prompt
  input_audio_format: {
    type: 'pcm';
    sample_rate: 16000;
  };
  output_audio_format: {
    type: 'pcm';
    sample_rate: 16000;
  };
  turn_detection: {
    type: 'server_vad' | null;  // null 为 Manual 模式
  };
}
```

### 3. 数据库设计

```prisma
// 核心实体关系

User (1) ── (N) PracticeSession
                         │
                         │ (1)
                         │
                         ▼
                   PracticeTurn (N)

PracticeSession (1) ── (1) EvaluationReport
```

#### 数据表说明

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| users | 用户信息 | id, name, email |
| practice_sessions | 练习会话 | id, mode, topic, status, duration |
| practice_turns | 对话轮次 | id, session_id, speaker, transcript |
| evaluation_reports | 评估报告 | id, session_id, scores (5 维度) |
| prompt_templates | Prompt 模板 | id, mode, system_prompt |

## 数据流

### 练习会话流程

```
1. 用户选择配置
       │
       ▼
2. 前端调用 POST /api/sessions
       │
       ▼
3. 后端创建 PracticeSession
       │
       ▼
4. 前端建立 WebSocket 连接
       │
       ▼
5. 发送 client:start_session
       │
       ▼
6. 后端连接 Qwen-Omni
       │
       ▼
7. 开始录音 → 发送音频流
       │
       ▼
8. 实时转写 + AI 回复
       │
       ▼
9. 用户结束会话
       │
       ▼
10. 后端触发评估生成
       │
       ▼
11. 前端跳转到报告页
```

### 评估生成流程

```
结束会话
    │
    ▼
获取对话历史 (PracticeTurns)
    │
    ▼
构建评估 Prompt
    │
    ▼
调用 LLM API (TODO: 接入真实 API)
    │
    ▼
解析 JSON 响应
    │
    ▼
保存到 EvaluationReport
    │
    ▼
前端获取并展示
```

## 扩展性设计

### 1. 多模型支持

当前设计支持快速切换模型提供商：

```typescript
// 抽象接口
interface RealtimeModelService {
  connect(config: any, callbacks: Callbacks): Promise<void>;
  sendAudio(audio: string): void;
  disconnect(): void;
}

// 当前实现：QwenOmniService
// 未来可扩展：AzureSpeechService, GoogleSpeechService
```

### 2. 音频存储

当前：内存处理
未来扩展：

```typescript
interface AudioStorage {
  save(audioBuffer: Buffer, sessionId: string): Promise<string>; // 返回 URL
  get(url: string): Promise<Buffer>;
}

// 实现：LocalStorage, S3Storage, OSSStorage
```

### 3. 评估系统

当前：Mock 数据
未来：

```typescript
interface EvaluationService {
  generateReport(context: EvaluationContext): Promise<EvaluationReport>;
}

// 实现：LLMEvaluationService, RuleBasedEvaluationService
```

## 安全性考虑

### 1. API Key 管理

- ✅ 后端统一代理，不暴露给前端
- ✅ 环境变量存储
- ⬜ 密钥轮换机制 (TODO)
- ⬜ 访问日志审计 (TODO)

### 2. 用户输入验证

- ✅ WebSocket 事件校验
- ⬜ 速率限制 (TODO)
- ⬜ 音频数据大小限制 (TODO)

### 3. 数据库安全

- ✅ Prisma ORM 防 SQL 注入
- ⬜ 行级权限 (RLS) (TODO)

## 性能优化

### 1. 音频流优化

- 使用 AudioWorklet 而非 ScriptProcessor
- 分块传输 (4096 samples/chunk)
- Base64 编码压缩

### 2. 数据库优化

- 会话 ID 索引
- 轮次转场索引
- ⬜ 读写分离 (TODO)

### 3. 前端优化

- Next.js ISR/SSG
- 按需加载音频权重
- ⬜ Service Worker 缓存 (TODO)

## 监控与日志

### 关键指标

- WebSocket 连接成功率
- 音频延迟 (端到端)
- 评估生成时间
- API 错误率

### 日志记录点

```typescript
// 推荐接入 Pino 或 Winston
- WebSocket 连接/断开
- Qwen API 调用
- 评估生成
- 数据库操作
```

## 部署架构

### 开发环境

```
localhost:3000 (Next.js) ←→ localhost:3001 (NestJS) ←→ localhost:5432 (PostgreSQL)
```

### 生产环境建议

```
                    ┌─────────────┐
              ┌────►│   Vercel    │
              │     │  (Frontend) │
              │     └─────────────┘
              │
User ─────────┤
              │     ┌─────────────────────────────┐
              └────►│  Railway/Render/EC2         │
                    │  (NestJS + PM2)             │
                    └─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Managed PostgreSQL │
                    │  (Supabase/Railway) │
                    └─────────────────────┘
```

## 迁移到移动端

### React Native 复用策略

```
共享层 (packages/)
├── @students-talk/types    ← 完全复用
├── @students-talk/prompts  ← 完全复用
└── @students-talk/api      ← 逻辑复用，适配 WebSocket

移动端特有
├── React Native Audio Module
├── React Navigation
└── Expo / 原生构建
```

### 需要调整的部分

1. AudioWorklet → React Native Audio API
2. Next.js Pages → React Native Screens
3. Tailwind → NativeWind / StyleSheet
4. Socket.IO 保持可用

---

*最后更新：2026-04-01*
