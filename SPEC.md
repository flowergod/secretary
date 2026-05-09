# Project Secretary 2.0 设计文档

## 一、项目概述

Project Secretary 是一个基于 AI 的个人日程与任务管理系统，通过飞书表格作为任务主数据源，iCloud 日历作为日程同步目标，飞书机器人作为通知渠道，LLM 作为语义理解和任务延展的核心引擎。

### 核心设计原则

- **数据单一来源**：飞书表格是任务的唯一数据源，iCloud 仅作为日历展示层
- **原子化服务**：每个功能拆分为最小可调用单元，支持自由组合
- **AI 优先**：尽可能让 AI 理解用户意图，而非要求用户适应系统格式
- **可观测性**：所有操作均记录日志，便于排查和学习

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户交互层                               │
│                    (飞书机器人 / Web API)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          AI 服务层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  语义理解     │  │  任务延展     │  │  记忆学习     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        原子服务层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  任务服务     │  │  日程服务     │  │  通知服务     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        外部服务层                               │
│       ┌──────────┐        ┌──────────┐        ┌──────────┐     │
│       │  飞书表格  │        │ iCloud   │        │ 飞书机器人 │     │
│       │          │        │ 日历     │        │          │     │
│       └──────────┘        └──────────┘        └──────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型

### 3.1 任务 (Task)

存储于飞书表格，每行代表一个任务。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识符 (UUID) |
| title | string | 是 | 任务标题 |
| description | string | 否 | 任务详细描述 |
| status | enum | 是 | `pending` / `completed` / `cancelled` |
| priority | enum | 否 | `high` / `medium` / `low`，默认 `medium` |
| category | string | 否 | 任务分类标签 |
| due_date | string | 否 | 截止日期 (YYYY-MM-DD) |
| start_date | string | 否 | 开始日期 (YYYY-MM-DD)，若有则视为日程 |
| start_time | string | 否 | 开始时间 (HH:MM) |
| end_time | string | 否 | 结束时间 (HH:MM) |
| is_recurring | boolean | 否 | 是否循环，默认 false |
| recurrence_type | enum | 否 | `daily` / `weekly` / `monthly` / `none` |
| recurrence_rule | string | 否 | RRULE 格式字符串 |
| icloud_event_id | string | 否 | iCloud 日历事件 ID |
| parent_id | string | 否 | 父任务 ID（用于子任务） |
| source | string | 否 | 来源标识，如 "ai_expansion" |
| created_at | string | 是 | 创建时间 (ISO 8601) |
| updated_at | string | 是 | 更新时间 (ISO 8601) |

### 3.2 意图 (Intent)

AI 解析用户指令后生成的内部操作对象。

```typescript
interface Intent {
  action: 'create' | 'update' | 'delete' | 'query' | 'complete';
  entityType: 'task' | 'event' | 'notification';
  entity: Record<string, unknown>;
  confidence: number;  // 0.0 - 1.0
  reasoning?: string;  // AI 的推理说明
}
```

### 3.3 记忆 (Memory)

记录用户操作历史，用于学习用户习惯。

```typescript
interface Memory {
  id: string;
  userId: string;
  sessionId: string;
  capability: string;      // 触发的能力，如 "event.create"
  success: boolean;
  intent: Intent;         // 解析出的意图
  rawInput: string;        // 用户原始输入
  timestamp: string;       // ISO 8601
  feedback?: string;       // 用户反馈
}
```

---

## 四、原子服务

### 4.1 任务服务 (TaskService)

#### 4.1.1 创建任务

```
POST /api/tasks
```

**入参：**
```json
{
  "title": "完成项目报告",
  "description": "需要包含本周进度和下周计划",
  "priority": "high",
  "due_date": "2026-05-10",
  "category": "工作"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "完成项目报告",
    "status": "pending",
    "priority": "high",
    "created_at": "2026-05-04T08:00:00Z"
  }
}
```

#### 4.1.2 查询任务

```
GET /api/tasks
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 按状态筛选 |
| priority | string | 按优先级筛选 |
| due_date | string | 按截止日期筛选 (YYYY-MM-DD) |
| category | string | 按分类筛选 |
| page | number | 页码，默认 1 |
| page_size | number | 每页数量，默认 20 |

**返回：**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 42,
    "page": 1,
    "page_size": 20
  }
}
```

#### 4.1.3 更新任务

```
PUT /api/tasks/{id}
```

**入参：**
```json
{
  "title": "更新后的标题",
  "status": "completed"
}
```

**返回：**
```json
{
  "success": true,
  "data": { ... }
}
```

#### 4.1.4 删除任务

```
DELETE /api/tasks/{id}
```

**返回：**
```json
{
  "success": true,
  "deleted": 1
}
```

#### 4.1.5 批量删除任务

```
POST /api/tasks/batch-delete
```

**入参：**
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

---

### 4.2 日程服务 (ScheduleService)

日程是具有确定开始时间的人物。当任务包含 `start_date` 时，自动视为日程，需同步至 iCloud 日历。

#### 4.2.1 创建日程

```
POST /api/events
```

**入参：**
```json
{
  "title": "投研投顾晨会",
  "start_date": "2026-05-05",
  "start_time": "08:45",
  "end_time": "09:30",
  "is_recurring": true,
  "recurrence_type": "weekly",
  "recurrence_rule": {
    "days": [2, 4]
  },
  "priority": "medium",
  "description": "周二、周四晨会"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "icloud_event_id": "/8183897202/calendars/xxx/yyy.ics",
    "title": "投研投顾晨会",
    "start_date": "2026-05-05",
    "recurrence_rule": "RRULE:FREQ=WEEKLY;BYDAY=TU,TH"
  }
}
```

#### 4.2.2 查询日程

```
GET /api/events
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| date | string | 查询指定日期的日程 (YYYY-MM-DD) |
| start_date | string | 查询开始日期 |
| end_date | string | 查询结束日期 |
| calendar | string | iCloud 日历名称 (`work` / `personal` / `family`) |

#### 4.2.3 删除日程

```
DELETE /api/events/{id}
```

同时删除飞书任务和 iCloud 日历事件。

#### 4.2.4 全量同步 iCloud 到飞书

```
POST /api/events/sync-from-icloud
```

**说明：** 从 iCloud 日历拉取所有事件，与飞书表格对比，补全飞书中有 iCloud 事件 ID 但缺失的任务。

**返回：**
```json
{
  "success": true,
  "synced": 15,
  "created": 3,
  "updated": 12,
  "errors": []
}
```

---

### 4.3 通知服务 (NotificationService)

#### 4.3.1 发送即时通知

```
POST /api/notifications/send
```

**入参：**
```json
{
  "content": "您有 3 个待完成的高优先级任务",
  " recipients": ["user1"]
}
```

#### 4.3.2 创建定时通知

```
POST /api/notifications/schedule
```

**入参：**
```json
{
  "type": "scheduled",
  "cron": "0 9 * * 1-5",
  "content": "今日任务提醒",
  "template": "daily_morning",
  "enabled": true
}
```

**支持的模板：**
- `daily_morning`: 今日待办、优先级高的任务
- `daily_evening`: 今日完成情况、本周进度
- `task_reminder`: 单个任务的提醒
- `weekly_summary`: 本周总结、下周计划

---

## 五、AI 服务

### 5.1 语义理解服务 (SemanticUnderstandingService)

#### 5.1.1 解析用户输入

```
POST /api/ai/parse
```

**入参：**
```json
{
  "input": "每周二、周四早上8点45到9点半，投研投顾晨会",
  "userId": "default_user",
  "sessionId": "default_session"
}
```

**返回：**
```json
{
  "success": true,
  "intent": {
    "action": "create",
    "entityType": "event",
    "entity": {
      "title": "投研投顾晨会",
      "start_date": "2026-05-07",
      "start_time": "08:45",
      "end_time": "09:30",
      "is_recurring": true,
      "recurrence_type": "weekly",
      "recurrence_rule": {
        "days": [2, 4]
      }
    },
    "confidence": 0.95,
    "reasoning": "检测到周二(2)和周四(4)的循环日程"
  }
}
```

**意图动作映射：**

| Intent Action | 调用的原子服务 |
|--------------|--------------|
| `create` + `entityType: task` | TaskService.createTask |
| `create` + `entityType: event` | ScheduleService.createEvent |
| `update` + `entityType: task` | TaskService.updateTask |
| `complete` | TaskService.completeTask |
| `delete` | TaskService.deleteTask |
| `query` | TaskService.queryTasks |

#### 5.1.2 低置信度处理

当 `confidence < 0.7` 时，系统返回确认请求：

```json
{
  "success": true,
  "needs_confirmation": true,
  "intent": { ... },
  "clarifying_question": "您是想创建每周二和周四的重复日程吗？"
}
```

### 5.2 任务延展服务 (TaskExpansionService)

当任务被创建或完成时，自动触发延展逻辑。

#### 5.2.1 触发时机

| 事件 | 延展动作 |
|------|---------|
| 任务创建 | 添加子任务建议、添加相关日程建议、发送通知建议 |
| 任务完成 | 更新相关任务状态、触发后续任务通知 |
| 任务取消 | 通知相关方、清理关联日程 |

#### 5.2.2 延展决策

LLM 根据任务内容决定是否需要延展：

```typescript
interface ExpansionDecision {
  shouldExpand: boolean;
  actions: ExpansionAction[];
  reasoning: string;
}

interface ExpansionAction {
  type: 'add_subtask' | 'add_event' | 'schedule_notification' | 'notify';
  entity: Record<string, unknown>;
  priority: number;  // 执行优先级
}
```

### 5.3 记忆服务 (MemoryService)

#### 5.3.1 记录体验

每次用户操作后记录：

```typescript
{
  userId: "default_user",
  sessionId: "default_session",
  capability: "event.create",
  success: true,
  intent: { ... },
  rawInput: "每周二、周四晨会",
  timestamp: "2026-05-04T08:00:00Z"
}
```

#### 5.3.2 学习规则

从历史记录中提取模式：

```typescript
interface LearnedRule {
  id: string;
  pattern: string;       // 如 "每{day}的会议"
  response: string;      // 如 "已为您创建每周{day}的日历事件"
  confidence: number;
  usageCount: number;
}
```

### 5.4 提示词管理 (PromptManagement)

提示词管理模块统一管理语义理解层的所有提示词模板，支持热更新和版本管理。

#### 5.4.1 提示词类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `intent_classification` | 用户意图分类 | 判断用户是想创建任务还是查询日程 |
| `entity_extraction` | 实体提取 | 从"明天上午9点开会"中提取时间实体 |
| `parameter_parsing` | 参数解析 | 解析任务的优先级、分类等字段 |
| `confirmation_request` | 确认请求 | 低置信度时向用户确认理解是否正确 |
| `task_expansion` | 任务延展 | 判断是否需要为任务添加子任务或日程 |
| `memory_learning` | 记忆学习 | 从历史记录中提取用户习惯模式 |

#### 5.4.2 提示词结构

```typescript
interface PromptTemplate {
  id: string;              // 唯一标识，如 "intent_classification.v1"
  type: PromptType;        // 提示词类型
  version: string;         // 版本号，如 "v1", "v2"
  content: string;         // 提示词模板内容
  variables: string[];     // 模板变量列表
  description: string;     // 用途说明
  examples?: string[];     // 示例输入输出对
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
}
```

#### 5.4.3 提示词存储

提示词存储在 `src/prompts/` 目录下，采用 JSON 格式文件管理：

```
src/prompts/
├── templates/
│   ├── intent-classification.json    # 意图分类模板
│   ├── entity-extraction.json        # 实体提取模板
│   ├── parameter-parsing.json        # 参数解析模板
│   ├── confirmation-request.json    # 确认请求模板
│   ├── task-expansion.json          # 任务延展模板
│   └── memory-learning.json         # 记忆学习模板
└── prompts-index.json               # 提示词索引文件
```

#### 5.4.4 提示词索引文件

```json
{
  "version": "1.0.0",
  "updated_at": "2026-05-04T00:00:00Z",
  "templates": {
    "intent_classification": {
      "id": "intent_classification",
      "file": "intent-classification.json",
      "description": "用户意图分类模板"
    },
    "entity_extraction": {
      "id": "entity_extraction",
      "file": "entity-extraction.json",
      "description": "实体提取模板"
    }
  }
}
```

#### 5.4.5 提示词加载与使用

```typescript
class PromptManager {
  private prompts: Map<string, PromptTemplate>;

  // 从 JSON 文件加载所有提示词
  async loadPrompts(): Promise<void>;

  // 获取指定类型的提示词
  getPrompt(type: PromptType): PromptTemplate;

  // 渲染模板（替换变量）
  render(prompt: PromptTemplate, variables: Record<string, string>): string;

  // 运行时更新提示词（无需重启服务）
  async updatePrompt(id: string, content: string): Promise<void>;
}
```

#### 5.4.6 示例：意图分类提示词

```json
{
  "id": "intent_classification",
  "type": "intent_classification",
  "version": "v1",
  "description": "判断用户意图：创建任务、查询任务、创建日程等",
  "variables": ["capabilities", "user_input"],
  "content": "你是一个任务管理助手。用户将输入一段文字，你需要判断其意图。\n\n可用能力：\n{capabilities}\n\n用户输入：{user_input}\n\n请以JSON格式返回：\n{\n  \"intent\": \"create|update|delete|query|complete\",\n  \"entity_type\": \"task|event|notification\",\n  \"confidence\": 0.0-1.0,\n  \"reasoning\": \"判断理由\"\n}",
  "examples": [
    {
      "input": "帮我安排明天上午9点开会",
      "output": "{\"intent\": \"create\", \"entity_type\": \"event\", \"confidence\": 0.95}"
    },
    {
      "input": "今天有什么任务",
      "output": "{\"intent\": \"query\", \"entity_type\": \"task\", \"confidence\": 0.9}"
    }
  ]
}
```

---

## 六、API 路由总览

### 原子服务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks | 创建任务 |
| GET | /api/tasks | 查询任务列表 |
| GET | /api/tasks/:id | 获取单个任务 |
| PUT | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |
| POST | /api/tasks/batch-delete | 批量删除 |
| POST | /api/events | 创建日程 |
| GET | /api/events | 查询日程 |
| DELETE | /api/events/:id | 删除日程 |
| POST | /api/events/sync-from-icloud | 从 iCloud 同步 |
| POST | /api/notifications/send | 发送即时通知 |
| POST | /api/notifications/schedule | 创建定时通知 |
| GET | /api/notifications | 查询已创建的定时通知 |

### AI 服务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/ai/parse | 解析用户输入 |
| POST | /api/ai/expand | 手动触发任务延展 |
| GET | /api/memory | 查看记忆历史 |
| GET | /api/memory/rules | 查看已学习的规则 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/config | 获取当前配置（脱敏） |
| PUT | /api/config | 更新配置 |
| GET | /api/logs | 查看操作日志 |

---

## 七、配置文件

### config.yaml

```yaml
server:
  port: 3000
  host: "0.0.0.0"

# 飞书配置
feishu:
  app_id: "${FEISHU_APP_ID}"
  app_secret: "${FEISHU_APP_SECRET}"
  table_id: "${FEISHU_TABLE_ID}"

# iCloud 配置
icloud:
  apple_id: "${ICLOUD_APPLE_ID}"
  app_password: "${ICLOUD_APP_PASSWORD}"
  calendar_mapping:
    work: "${ICLOUD_WORK_CALENDAR_ID}"
    personal: "${ICLOUD_PERSONAL_CALENDAR_ID}"
    family: "${ICLOUD_FAMILY_CALENDAR_ID}"

# LLM 配置
llm:
  provider: "volcano"  # 或 "openai", "anthropic"
  api_key: "${LLM_API_KEY}"
  api_base: "${LLM_API_BASE}"
  model: "deepseek-chat"
  temperature: 0.7
  max_tokens: 2000

# 飞书机器人
feishu_bot:
  webhook_url: "${FEISHU_BOT_WEBHOOK_URL}"
  bot_name: "Secretary Bot"

# 通知调度
notification:
  timezone: "Asia/Shanghai"
  morning_cron: "0 8 * * 1-5"    # 工作日早上 8 点
  evening_cron: "0 20 * * 1-5"   # 工作日晚上 8 点
  enabled: true

# 日志
logging:
  level: "info"
  path: "./logs"
  max_files: 7
```

---

## 八、目录结构

```
secretary/
├── config.yaml                 # 配置文件
├── package.json
├── tsconfig.json
├── SPEC.md                     # 本文档
├── src/
│   ├── index.ts                 # 入口文件
│   ├── server.ts                # HTTP 服务器
│   ├── shared/
│   │   ├── types.ts             # 共享类型定义
│   │   ├── config.ts            # 配置管理
│   │   └── logger.ts            # 日志工具
│   ├── connectors/
│   │   ├── feishu.ts            # 飞书表格连接器
│   │   ├── icloud.ts            # iCloud 日历连接器
│   │   └── feishu-bot.ts        # 飞书机器人连接器
│   ├── services/
│   │   ├── task-service.ts       # 任务原子服务
│   │   ├── schedule-service.ts   # 日程原子服务
│   │   ├── notification-service.ts # 通知原子服务
│   │   ├── ai/
│   │   │   ├── semantic-service.ts    # 语义理解
│   │   │   ├── expansion-service.ts   # 任务延展
│   │   │   └── memory-service.ts      # 记忆服务
│   │   └── scheduler.ts          # 定时任务调度器
│   ├── routes/
│   │   ├── task.routes.ts
│   │   ├── event.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── ai.routes.ts
│   │   └── system.routes.ts
│   ├── prompts/
│   │   ├── templates/
│   │   │   ├── intent-classification.json  # 意图分类模板
│   │   │   ├── entity-extraction.json      # 实体提取模板
│   │   │   ├── parameter-parsing.json      # 参数解析模板
│   │   │   ├── confirmation-request.json  # 确认请求模板
│   │   │   ├── task-expansion.json         # 任务延展模板
│   │   │   └── memory-learning.json        # 记忆学习模板
│   │   └── prompts-index.json            # 提示词索引文件
└── tests/
    ├── task-service.test.ts
    ├── schedule-service.test.ts
    └── semantic-service.test.ts
```

---

## 九、关键实现细节

### 9.1 飞书表格操作

使用飞书 Open API 操作多维表格：

```typescript
// 创建记录
POST https://open.feishu.cn/open-apis/bitable/v1/apps/{table_id}/records

// 批量查询
POST https://open.feishu.cn/open-apis/bitable/v1/apps/{table_id}/records/search

// 更新记录
PUT https://open.feishu.cn/open-apis/bitable/v1/apps/{table_id}/records/{record_id}

// 删除记录
DELETE https://open.feishu.cn/open-apis/bitable/v1/apps/{table_id}/records/{record_id}
```

### 9.2 iCloud CalDAV

使用 CardDAV/CalDAV 协议：

```typescript
// 获取日历列表
PROPFIND /principals/

// 创建事件
PUT /{userId}/calendars/{calendarId}/{uid}.ics

// 查询事件
REPORT /{userId}/calendars/{calendarId}/
<C:calendar-query>...</C:calendar-query>

// 删除事件
DELETE /{userId}/calendars/{calendarId}/{uid}.ics
```

### 9.3 RRULE 格式

循环事件使用 iCalendar RRULE 标准：

| 类型 | RRULE |
|------|-------|
| 每天 | `RRULE:FREQ=DAILY` |
| 每周一 | `RRULE:FREQ=WEEKLY;BYDAY=MO` |
| 每周二、四 | `RRULE:FREQ=WEEKLY;BYDAY=TU,TH` |
| 每月 15 日 | `RRULE:FREQ=MONTHLY;BYMONTHDAY=15` |
| 工作日 | `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |

### 9.4 任务延展流程

```
用户创建任务
    │
    ▼
TaskService.createTask()
    │
    ▼
TaskExpansionService.shouldExpand()
    │  LLM 判断是否需要延展
    ▼
if (shouldExpand) {
  ExpansionService.getExpansionActions()
    │
    ▼
  for (action : actions) {
    switch (action.type) {
      case 'add_subtask':
        TaskService.createTask({ parent_id: task.id })
        break
      case 'add_event':
        ScheduleService.createEvent()
        break
      case 'schedule_notification':
        NotificationService.schedule()
        break
    }
  }
}
```

---

## 十、错误处理

### 10.1 错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 飞书 API 调用失败 |
| 1002 | iCloud CalDAV 调用失败 |
| 2001 | 任务不存在 |
| 2002 | 任务创建失败 |
| 2003 | 任务更新失败 |
| 3001 | 日程同步失败 |
| 4001 | LLM 调用失败 |
| 4002 | 意图解析失败 |
| 5001 | 配置缺失 |

### 10.2 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": 2001,
    "message": "任务不存在",
    "details": "Task with id xxx not found"
  }
}
```

---

## 十一、待完善功能

以下功能在本设计文档中定义了接口和结构，但具体实现逻辑需要在后续迭代中完善：

1. **任务延展 (TaskExpansionService)**: LLM 判断延展时机和内容的算法
2. **记忆学习 (MemoryService)**: 从历史记录中提取和应用用户习惯
3. **定时通知调度器**: 基于 cron 的早晚报通知触发逻辑
4. **飞书机器人交互**: 主动推送通知和用户确认流程
5. **全量同步逻辑**: 从 iCloud 拉取事件并补全飞书表格的详细算法
6. **错误重试机制**: 各外部服务调用的重试策略
7. **监控指标**: 请求延迟、成功率等可观测性指标

---

## 十二、测试策略

### 12.1 单元测试

- 每个 service 的核心方法
- RRULE 构建逻辑
- 日期计算逻辑

### 12.2 集成测试

- 飞书表格读写
- iCloud CalDAV 操作（需配置测试日历）
- API 端点测试

### 12.3 E2E 测试

模拟用户完整对话流程：
```
用户: "帮我安排明天下午3点开会"
AI: 解析为 event.create
     │
     ▼
ScheduleService.createEvent()
     │
     ▼
iCloudConnector.createEvent()
     │
     ▼
返回: "已为您创建日程，明天下午3点开会"
```
