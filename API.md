# API 接口文档

## REST API

### 基础信息

- **Base URL**: `http://localhost:3001/api`
- **Content-Type**: `application/json`

---

## 会话管理

### 1. 创建练习会话

```http
POST /api/sessions
Content-Type: application/json

{
  "mode": "FREE_TALK" | "ROLE_PLAY" | "REPEAT",
  "topic": "daily-life",      // 可选
  "language": "en",           // 可选，默认 en
  "level": "intermediate",    // 可选，默认 intermediate
  "scenario": "restaurant"    // ROLE_PLAY 模式时可选
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "abc123",
      "mode": "FREE_TALK",
      "topic": "daily-life",
      "language": "en",
      "level": "intermediate",
      "status": "PENDING",
      "startedAt": null,
      "endedAt": null,
      "durationSeconds": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### 2. 开始练习

```http
POST /api/sessions/:id/start
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "abc123",
      "status": "ACTIVE",
      "startedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### 3. 结束练习

```http
POST /api/sessions/:id/end
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "abc123",
      "status": "COMPLETED",
      "endedAt": "2024-01-01T00:05:00.000Z",
      "durationSeconds": 300
    }
  }
}
```

> 注意：此接口会异步触发评估报告生成

---

### 4. 获取会话详情

```http
GET /api/sessions/:id
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "abc123",
      "mode": "FREE_TALK",
      "topic": "daily-life",
      "status": "COMPLETED",
      "durationSeconds": 300,
      "turns": [
        {
          "id": "turn1",
          "sessionId": "abc123",
          "turnIndex": 0,
          "speaker": "STUDENT",
          "transcript": "Hello, I want to practice English.",
          "createdAt": "2024-01-01T00:00:30.000Z"
        },
        {
          "id": "turn2",
          "sessionId": "abc123",
          "turnIndex": 1,
          "speaker": "AI",
          "transcript": "Great! Let's chat about your day. What did you do today?",
          "createdAt": "2024-01-01T00:00:45.000Z"
        }
      ],
      "report": {
        "id": "report123",
        "overallScore": 75
      }
    }
  }
}
```

---

### 5. 获取评分报告

```http
GET /api/sessions/:id/report
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "report123",
      "sessionId": "abc123",
      "pronunciationScore": 75,
      "fluencyScore": 70,
      "grammarScore": 68,
      "vocabularyScore": 72,
      "taskCompletionScore": 80,
      "overallScore": 73,
      "strengthsJson": ["发音清晰", "语速自然"],
      "weaknessesJson": ["复杂句型有困难", "时态偶尔错误"],
      "errorTagsJson": ["时态混淆", "冠词错误"],
      "suggestedExpressionsJson": ["Could I have...", "I would like to..."],
      "nextStepAdviceJson": ["练习过去时", "注意冠词使用"],
      "createdAt": "2024-01-01T00:05:30.000Z"
    }
  }
}
```

---

### 6. 获取历史记录

```http
GET /api/history
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "abc123",
        "mode": "FREE_TALK",
        "topic": "daily-life",
        "language": "en",
        "level": "intermediate",
        "startedAt": "2024-01-01T00:00:00.000Z",
        "durationSeconds": 300,
        "overallScore": 73
      }
    ]
  }
}
```

---

### 7. 获取预设配置

```http
GET /api/presets
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "modes": [
      {
        "id": "FREE_TALK",
        "name": "自由对话",
        "description": "日常口语陪练，AI 主动提问引导"
      }
    ],
    "topics": [
      {
        "id": "daily-life",
        "mode": "FREE_TALK",
        "name": "日常生活",
        "description": "Daily Life"
      }
    ],
    "scenarios": [
      {
        "id": "restaurant",
        "name": "餐厅点餐",
        "description": "Restaurant",
        "roleInstructions": "Waiter/Waitress"
      }
    ],
    "levels": [
      {
        "id": "beginner",
        "name": "初级",
        "description": "简单词汇和句型"
      }
    ]
  }
}
```

---

## WebSocket API

### 连接信息

- **URL**: `ws://localhost:3001/ws`
- **传输协议**: Socket.IO

### 客户端 → 服务端事件

#### `client:start_session`

开始新的练习会话

```typescript
{
  mode: 'FREE_TALK' | 'ROLE_PLAY' | 'REPEAT';
  topic?: string;
  language?: string;
  level?: string;
  scenario?: string;
}
```

#### `client:audio_chunk`

发送音频数据块

```typescript
{
  audio: string;      // Base64 编码的 16kHz PCM 数据
  timestamp: number;
}
```

#### `client:commit_audio`

提交音频缓冲区 (Manual 模式)

```typescript
{
  triggerResponse?: boolean;
}
```

#### `client:end_session`

结束当前会话

```typescript
{
  reason?: 'completed' | 'error' | 'timeout';
}
```

---

### 服务端 → 客户端事件

#### `server:session_ready`

会话已就绪

```typescript
{
  sessionId: string;
  status: 'connected';
}
```

#### `server:user_transcript_delta`

用户语音转写结果

```typescript
{
  turnId: string;
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}
```

#### `server:assistant_text_delta`

AI 文本回复

```typescript
{
  turnId: string;
  text: string;
  isFinal: boolean;
}
```

#### `server:assistant_audio_chunk`

AI 音频数据

```typescript
{
  audio: string;      // Base64 编码的 PCM 数据
  turnId: string;
}
```

#### `server:report_ready`

评估报告已生成

```typescript
{
  sessionId: string;
  report: EvaluationReport;
}
```

#### `server:error`

错误信息

```typescript
{
  code: string;
  message: string;
  details?: unknown;
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| `SESSION_START_FAILED` | 会话启动失败 |
| `MODEL_DISCONNECT` | 与 AI 模型连接断开 |
| `MODEL_ERROR` | AI 模型返回错误 |
| `CONNECT_ERROR` | WebSocket 连接错误 |
| `DISCONNECTED` | 连接已断开 |
| `NOT_FOUND` | 资源不存在 |
| `INVALID_REQUEST` | 请求参数无效 |

---

## 数据模型

### EvaluationReport

```typescript
interface EvaluationReport {
  pronunciation_score: number;       // 0-100
  fluency_score: number;             // 0-100
  grammar_score: number;             // 0-100
  vocabulary_score: number;          // 0-100
  task_completion_score: number;     // 0-100
  overall_score: number;             // 0-100
  strengths: string[];               // 亮点
  weaknesses: string[];              // 需改进
  error_tags: string[];              // 错误标签
  suggested_expressions: string[];   // 推荐表达
  next_step_advice: string[];        // 下一步建议
}
```
