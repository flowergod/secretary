# 飞书机器人集成设计文档

**更新日期**: 2026-05-09
**状态**: ✅ 已实现（WebSocket 长连接模式）

---

## 一、需求概述

将秘书项目接入飞书机器人，实现手机端自然语言交互。

### 目标

- 用户在飞书中 @机器人 发送消息
- 机器人理解用户意图并执行任务
- 支持定时通知主动推送
- **长连接模式**：使用 WebSocket 与飞书服务器保持连接，无需暴露公网端口

---

## 二、连接模式对比

| 模式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| Webhook | 部署简单 | 需要公网地址、端口暴露 | 公网可访问的服务器 |
| **长连接 (WebSocket)** | 无需公网、延迟低、稳定性高 | 实现稍复杂 | **我们的场景** |

### 长连接架构

```
                    ┌─────────────────┐
                    │   飞书服务器     │
                    │  (推送事件)      │
                    └────────┬────────┘
                             │ WebSocket 长连接
                             │
┌────────────────────────────────────────────────────┐
│                    秘书服务器                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Lark SDK    │  │ FeishuBot    │  │ Semantic │  │
│  │  事件分发    │→ │ Service      │→ │ Service  │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
└────────────────────────────────────────────────────┘
```

**优势**：
- ✅ 服务器只需要能访问外网，不需要被外网访问
- ✅ 消息实时到达，无延迟
- ✅ 自动重连，保持连接
- ✅ 更安全（无端口暴露）

---

## 二、架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         飞书客户端                              │
│                    (手机 / PC / Web)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     飞书开放平台                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Event Subscriptions (接收消息事件)                        │ │
│  │  Message Webhook → 我们的服务器                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      秘书服务层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ FeishuBot    │  │  消息处理器  │  │  通知服务    │         │
│  │ Connector   │  │              │  │ (待实现)     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      语义理解层                                  │
│           SemanticService.understand()                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      业务服务层                                  │
│        TaskService / ScheduleService                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、飞书机器人配置

### 3.1 需要的配置项

```yaml
feishu:
  bot:
    app_id: "${FEISHU_BOT_APP_ID}"
    app_secret: "${FEISHU_BOT_APP_SECRET}"
    bot_name: "秘书"
    webhook_url: "${FEISHU_BOT_WEBHOOK_URL}"  # 用于主动推送
    verification_token: "${FEISHU_VERIFICATION_TOKEN}"  # 事件订阅验证
```

### 3.2 飞书开放平台配置

| 配置项 | 说明 |
|--------|------|
| 机器人类型 | 自定义机器人 |
| 消息事件订阅 | `im.message.receive_v1` |
| 权限 | `im:message:receive_as_bot` |
| 事件订阅 URL | `https://your-domain.com/api/feishu/webhook` |

---

## 四、功能设计

### 4.1 消息接收

**触发条件**: 用户在群聊或单聊中 @机器人 或直接发送消息

**消息格式**:
```json
{
  "schema": "2.0",
  "header": {
    "event_type": "im.message.receive_v1",
    "event_id": "ev_xxx",
    "create_time": "1234567890",
    "token": "xxx",
    "app_id": "cli_xxx",
    "tenant_key": "xxx"
  },
  "event": {
    "sender": {
      "sender_id": { "open_id": "ou_xxx" },
      "sender_type": "user"
    },
    "message": {
      "message_id": "om_xxx",
      "create_time": "xxx",
      "chat_id": "oc_xxx",
      "chat_type": "group",
      "message_type": "text",
      "content": "{\"text\":\"提醒我明天上午9点开会\"}"
    }
  }
}
```

### 4.2 消息处理流程

```
接收飞书消息
      │
      ▼
┌─────────────────┐
│ 验证签名        │ → 验证失败 → 返回 401
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ 解析消息内容    │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ 调用语义理解    │ SemanticService.understand(text)
└─────────────────┘
      │
      ├──→ 需要确认 ──→ 生成确认问题
      │                    │
      │                    ▼
      │              返回确认消息
      │
      ├──→ 执行成功 ──→ 返回执行结果
      │                    │
      │                    ▼
      │              回复用户
      │
      └──→ 执行失败 ──→ 返回错误信息
                       │
                       ▼
                 回复用户
```

### 4.3 消息回复

**回复格式** (text):
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"已为您创建日程：明天上午9点开会\"}"
}
```

**回复格式** (interactive - 卡片):
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "interactive",
  "content": {
    "schema": "2.0",
    "component": [
      {
        "tag": "markdown",
        "content": "**任务已创建**\n\n📌 明天上午9点开会"
      }
    ]
  }
}
```

### 4.4 主动推送 (通知服务)

当配置了定时任务（如早晚报）时，机器人主动推送消息：

```typescript
interface ScheduledNotification {
  id: string;
  cron: string;  // "0 9 * * 1-5"
  content: string;
  type: 'daily_morning' | 'daily_evening' | 'task_reminder';
  enabled: boolean;
}
```

---

## 五、接口设计

### 5.1 HTTP 端点

```
POST /api/feishu/webhook
  接收飞书消息事件
  Headers: X-Lark-Signature (签名验证)

POST /api/feishu/reply
  回复消息
  Body: { receive_id, msg_type, content }

GET /api/feishu/botinfo
  获取机器人信息
```

### 5.2 核心模块

```typescript
// src/connectors/feishu-bot.ts

class FeishuBotConnector {
  // 发送消息
  async sendMessage(receiveId: string, message: string): Promise<void>;

  // 发送卡片消息
  async sendCardMessage(receiveId: string, card: CardMessage): Promise<void>;

  // 获取用户信息
  async getUserInfo(openId: string): Promise<UserInfo>;
}

// src/services/feishu-bot-service.ts

class FeishuBotService {
  // 处理接收到的消息
  async handleMessage(payload: FeishuMessageEvent): Promise<void>;

  // 回复用户
  async reply(openId: string, content: string): Promise<void>;

  // 回复卡片
  async replyCard(openId: string, card: CardMessage): Promise<void>;
}
```

---

## 六、卡片消息设计

### 6.1 任务创建成功卡片

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "✅ 任务已创建" },
      "template": "green"
    },
    "elements": [
      {
        "tag": "markdown",
        "content": "**提醒我明天上午9点开会**"
      },
      { "tag": "hr" },
      {
        "tag": "note",
        "elements": [
          { "tag": "plain_text", "content": "📅 2026-05-09 09:00" }
        ]
      }
    ]
  }
}
```

### 6.2 需要确认卡片

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "🤔 请确认" },
      "template": "orange"
    },
    "elements": [
      {
        "tag": "markdown",
        "content": "请问您是想**创建任务**还是**查询日程**？"
      },
      {
        "tag": "action",
        "actions": [
          { "tag": "button", "text": { "tag": "plain_text", "content": "创建任务" }, "type": "primary" },
          { "tag": "button", "text": { "tag": "plain_text", "content": "查询日程" }, "type": "secondary" }
        ]
      }
    ]
  }
}
```

### 6.3 日程查询结果卡片

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "📅 今日日程" },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "markdown",
        "content": "**09:00** 投研投顾晨会\n**14:00** 客户拜访\n**19:00** 家长会"
      }
    ]
  }
}
```

---

## 七、目录结构

```
src/
├── connectors/
│   └── feishu-bot.ts      # 新增：飞书机器人连接器
│
├── services/
│   └── feishu-bot-service.ts  # 新增：机器人服务
│
├── routes/
│   └── feishu-bot.routes.ts  # 新增：机器人路由
│
└── index.ts / server.ts  # 修改：注册路由
```

---

## 八、实现计划

### Phase 1: 基础消息接收

| 任务 | 优先级 |
|------|--------|
| 创建 FeishuBotConnector | P0 |
| 实现 webhook 端点 | P0 |
| 实现消息签名验证 | P0 |
| 基础回复功能 | P0 |

### Phase 2: 语义集成

| 任务 | 优先级 |
|------|--------|
| 集成 SemanticService | P0 |
| 处理确认流程 | P1 |
| 卡片消息样式 | P1 |

### Phase 3: 主动推送

| 任务 | 优先级 |
|------|--------|
| 通知服务 | P2 |
| 定时任务调度 | P2 |
| 早晚报模板 | P2 |

---

## 九、注意事项

### 9.1 安全

- 消息签名验证 (X-Lark-Signature)
- API 请求需要进行重试和错误处理
- 敏感配置使用环境变量

### 9.2 限流

飞书 API 有调用频率限制：
- 同一个 bot 同一个群，最多每分钟 20 条消息
- 同一个 bot 同一个用户，最多每分钟 60 条消息

### 9.3 依赖

```yaml
dependencies:
  "@larksuiteoapi/node-sdk": "^1.0.0"  # 飞书官方 SDK
```

---

## 十、上下文整合设计

### 10.1 当前系统上下文

秘书系统已有 `ContextManager`，管理多轮对话状态：

```typescript
// 当前 semantic context 结构
interface Context {
  id: string;                    // ctx_xxx
  intent: ParsedIntent;
  status: 'pending' | 'executing' | 'completed' | 'expired';
  originalText: string;
  confirmationQuestion?: string;
  confirmationOptions?: ConfirmationOption[];
  openOption?: ConfirmationOption;
  createdAt: number;
  updatedAt: number;
}
```

### 10.2 飞书消息上下文

飞书消息带有用户和会话信息：

```typescript
interface FeishuMessageContext {
  openId: string;        // 飞书用户 open_id
  chatId: string;        // 会话 ID (群聊/单聊)
  chatType: 'p2p' | 'group';
  messageId: string;     // 消息 ID
  sessionId: string;     // 可选，会话 ID
}
```

### 10.3 整合方案

**方案：使用飞书 chatId + openId 作为用户标识**

| 层级 | 标识 | 说明 |
|------|------|------|
| 用户层 | `openId` | 飞书用户唯一标识 |
| 会话层 | `chatId` | 群聊/单聊会话 |
| 对话层 | `contextId` | 语义理解的对话上下文 |

**整合策略**：

1. **首次对话**：用户发送消息 → 创建新 `contextId`
2. **同一会话内**：复用同一个 `contextId`，直到对话结束或超时
3. **contextId 存储**：将 `contextId` 与 `chatId/openId` 关联

```typescript
// chatId → contextId 映射
class FeishuContextMap {
  private chatContextMap: Map<string, string>;  // chatId → contextId
  private contextChatMap: Map<string, string>;    // contextId → chatId

  // 获取或创建会话上下文
  getOrCreateContext(chatId: string, openId: string): string {
    const existingContextId = this.chatContextMap.get(chatId);
    if (existingContextId) {
      const context = contextManager.getContext(existingContextId);
      if (context && context.status !== 'expired') {
        return existingContextId;
      }
    }
    // 创建新上下文
    const newContextId = `feishu_${chatId}_${Date.now()}`;
    this.chatContextMap.set(chatId, newContextId);
    this.contextChatMap.set(newContextId, chatId);
    return newContextId;
  }

  // 清除会话上下文
  clearContext(chatId: string) {
    const contextId = this.chatContextMap.get(chatId);
    if (contextId) {
      this.contextChatMap.delete(contextId);
      this.chatContextMap.delete(chatId);
    }
  }
}
```

### 10.4 消息流

```
飞书消息 (chatId: oc_xxx, openId: ou_xxx, text: "今天有什么安排")
      │
      ▼
FeishuBotService.handleMessage()
      │
      ▼
获取/创建 contextId ─────────────────────────────────────┐
      │                                                   │
      ▼                                                   │
SemanticService.understand(text, contextId)               │
      │                                                   │
      ├──→ 需要确认 ──→ replyCard() ──→ 存入 context     ←┘
      │                    │
      │                    ▼
      ├──→ 执行成功 ──→ replyCard() ──→ 保持 context
      │                    │
      └──→ 执行失败 ──→ replyText() ──→ 保持 context
```

### 10.5 多会话支持

```
用户A (单聊) ──────────→ contextId_A
用户B (群聊) ──────────→ contextId_B
用户A (另一个群) ──────→ contextId_A2
```

每个 `chatId` 独立维护自己的 `contextId`，互不影响。

---

## 十三、开启新 ContextId 的策略

### 13.1 自动开启

以下情况自动创建新 contextId：

| 场景 | 触发条件 | 示例 |
|------|---------|------|
| 首次对话 | chatId 没有对应 contextId | 用户第一次发消息 |
| 上下文完成 | 之前 context.status = 'completed' | 用户说"好的"确认后 |
| 上下文取消 | 之前 context.status = 'expired' 或用户取消 | 用户说"算了" |
| 超时过期 | 超过 30 分钟无互动 | 第二天再发消息 |

### 13.2 手动开启

用户可以通过以下方式主动开始新对话：

| 方式 | 命令 | 说明 |
|------|------|------|
| 关键词 | `新对话`、`重新开始`、`换个话题` | 自动检测 |
| 命令格式 | `/new`、`/restart`、`/reset` | 明确指令 |
| 卡片按钮 | 点击「重新开始」按钮 | 交互式 |

### 13.3 实现代码

```typescript
// src/services/feishu-bot-service.ts

class FeishuBotService {
  // 检测是否需要开启新对话
  private shouldStartNewContext(text: string, chatId: string): boolean {
    const lower = text.toLowerCase().trim();

    // 显式指令
    const newContextKeywords = ['新对话', '重新开始', '换个话题', '新任务'];
    if (newContextKeywords.some(k => lower.includes(k))) {
      return true;
    }

    // /new 命令
    if (lower.startsWith('/new') || lower.startsWith('/reset')) {
      return true;
    }

    // 检查现有上下文状态
    const existingContextId = this.contextMap.get(chatId);
    if (existingContextId) {
      const context = this.semanticService.getContext(existingContextId);
      if (!context || context.status === 'completed' || context.status === 'expired') {
        return true;
      }
    }

    return false;
  }

  // 处理消息
  async handleMessage(msg: NormalizedMessage): Promise<void> {
    const { chatId, openId, text } = this.extractMessageInfo(msg);

    // 检测是否需要新上下文
    let contextId: string;
    if (this.shouldStartNewContext(text, chatId)) {
      // 清除旧上下文，创建新的
      this.contextMap.clearContext(chatId);
      contextId = await this.createNewContext(chatId, openId);
      logger.info(`[FeishuBot] Started new context: ${contextId}`);
    } else {
      // 复用现有上下文
      contextId = this.contextMap.getOrCreateContext(chatId, openId);
    }

    // 调用语义理解
    const result = await this.semanticService.understand(text, contextId);
    // ...
  }

  // 创建新上下文
  private async createNewContext(chatId: string, openId: string): Promise<string> {
    const contextId = `feishu_${chatId}_${Date.now()}`;
    this.contextMap.set(chatId, contextId);
    return contextId;
  }
}
```

### 13.4 上下文状态流转

```
                    ┌─────────────┐
                    │   初始态    │
                    │ (pending)  │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌───────────┐  ┌───────────┐  ┌───────────┐
     │ 用户确认  │  │ 用户取消  │  │ 超时过期  │
     └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
           │             │             │
           ▼             ▼             ▼
    ┌────────────┐  ┌───────────┐  ┌───────────┐
    │ executing  │  │  expired  │  │  expired  │
    └─────┬──────┘  └──────────┘  └───────────┘
          │
          ▼
    ┌────────────┐
    │ completed │
    └──────────┘
          │
          ▼
   下条消息自动创建新 context
```

### 13.5 体验优化

**首次消息欢迎语**：
```text
👋 您好！我是秘书小助手。

我可以帮您：
• 创建和管理任务
• 查询日程安排
• 设置提醒

请直接告诉我您想做什么，比如：
「提醒我明天下午3点开会」
「今天有什么安排？」

需要开始新对话吗？请说「新对话」或点击下方按钮 👇
```

---

## 十四、实现细节 (2026-05-09)

### 14.1 SDK 集成

使用 `@larksuiteoapi/node-sdk` 的 `LarkChannel` 类：

```typescript
import { LarkChannel, LoggerLevel } from '@larksuiteoapi/node-sdk';

const channel = new LarkChannel({
  appId: config.appId,
  appSecret: config.appSecret,
  loggerLevel: LoggerLevel.debug,
});

// 注册消息处理器
channel.on('message', async (msg: NormalizedMessage) => {
  // msg.chatId, msg.senderId, msg.content, msg.chatType
  await handleMessage(msg);
});

// 启动长连接
await channel.connect();
```

### 14.2 消息处理

`NormalizedMessage` 字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string | 消息 ID |
| chatId | string | 会话 ID |
| chatType | ChatType | 'p2p' 或 'group' |
| senderId | string | 发送者 open_id |
| content | string | 消息文本内容 |
| createTime | number | 创建时间戳 |

### 14.3 消息发送

使用 `channel.send(to, input)` 方法：

```typescript
// 发送文本
await channel.send(receiveId, { text: '消息内容' });

// 发送卡片
await channel.send(receiveId, { card: cardObject });

// 回复消息
await channel.send(messageId, { text: '回复内容' }, { replyTo: messageId });
```

### 14.4 文件清单

| 文件 | 说明 |
|------|------|
| `src/connectors/feishu-bot.ts` | LarkChannel 封装，消息收发 |
| `src/services/feishu-bot-service.ts` | 消息处理，语义理解集成 |

---

## Phase 1: 基础连接

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 创建 FeishuBotConnector (Lark SDK) | P0 | ✅ |
| 实现长连接事件监听 | P0 | ✅ |
| 基础消息接收/回复 | P0 | ✅ |

### Phase 2: 语义集成

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 集成 SemanticService | P0 | ✅ |
| 上下文整合 | P0 | ✅ |
| 卡片消息样式 | P1 | ✅ |

### Phase 3: 主动推送

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 通知服务 | P1 | ✅ |
| 定时任务调度 | P1 | ❌ |
| 早晚报推送 | P2 | ❌ |
