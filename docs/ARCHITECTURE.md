# 秘书项目架构文档

**更新日期**: 2026-05-09
**版本**: v2.1

---

## 一、项目概述

秘书是一个基于 AI 的个人日程与任务管理系统，通过自然语言理解用户意图，自动创建和管理任务/日程。

### 核心能力

- **自然语言理解**: 将用户输入解析为结构化意图
- **任务管理**: CRUD 操作，支持循环任务
- **日程同步**: 与 iCloud 日历双向同步
- **上下文记忆**: 多轮对话支持
- **可观测性**: 完整的日志和追踪

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户交互层                               │
│              HTTP API  /  WebSocket  /  飞书机器人              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          AI 服务层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  语义理解     │  │  意图解析     │  │  能力分发     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  提示词管理   │  │  上下文管理    │  │  语义日志     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        原子服务层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  TaskService  │  │ScheduleService│ │  通知服务     │         │
│  │  (任务管理)   │  │  (日程服务)   │  │ (规划中)     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
              │               │               │
              ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        外部服务层                               │
│       ┌──────────┐        ┌──────────┐        ┌──────────┐     │
│       │  飞书表格  │        │ iCloud   │        │ 飞书机器人 │     │
│       │  (已实现)  │        │ 日历     │        │ (规划中)  │     │
│       └──────────┘        │ (已实现)  │        └──────────┘     │
│                            └──────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、已实现能力

### 3.1 语义理解层 ✅

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 语义理解服务 | `semantic/semantic-service.ts` | ✅ | 主服务，编排流程 |
| LLM 服务 | `semantic/llm-service.ts` | ✅ | 支持 fallback 和重试 |
| 意图解析器 | `semantic/intent-parser.ts` | ✅ | 解析 LLM 输出，参数标准化 |
| 能力分发器 | `semantic/capability-dispatcher.ts` | ✅ | 分发到对应执行器 |
| 提示词管理 | `semantic/prompt-manager.ts` | ✅ | 提示词加载和渲染 |
| 上下文管理 | `semantic/context-manager.ts` | ✅ | 多轮对话状态管理 |
| 语义日志 | `semantic/semantic-logger.ts` | ✅ | 记录语义理解日志 |
| 追踪日志 | `semantic/trace-logger.ts` | ✅ | 请求链路追踪 |

### 3.2 意图类型

```typescript
enum IntentType {
  CREATE_TASK = 'create_task',    // 创建任务 ✅
  QUERY_TASKS = 'query_tasks',    // 查询任务 ✅
  QUERY_EVENTS = 'query_events',  // 查询日程 ✅
  UPDATE_TASK = 'update_task',    // 更新任务 ✅
  COMPLETE_TASK = 'complete_task', // 完成任务 ✅
  DELETE_TASK = 'delete_task',    // 删除任务 ✅
  CREATE_EVENT = 'create_event',  // 创建日程 ✅
  UPDATE_EVENT = 'update_event', // 更新日程 ✅
  EXPAND_TASK = 'expand_task',    // 智能规划 🔄 映射到 create_task
  OTHER = 'other',               // 其他意图 ✅ 映射到 create_task
}
```

### 3.3 任务服务 ✅

| 方法 | 状态 | 说明 |
|------|------|------|
| create | ✅ | 创建任务，支持循环 |
| list | ✅ | 分页查询，支持多条件筛选 |
| get | ✅ | 获取单个任务 |
| update | ✅ | 更新任务，支持状态转换 |
| delete | ✅ | 删除任务 |
| batchDelete | ✅ | 批量删除 |
| complete | ✅ | 完成任务，支持循环任务生成下一个 |
| transition | ✅ | 状态转换（pending→in_progress/completed/cancelled） |

### 3.4 日程服务 ✅

| 方法 | 状态 | 说明 |
|------|------|------|
| querySchedules | ✅ | 查询日程，支持日期范围筛选 |
| syncToICalendar | ✅ | 同步到 iCloud 日历 |
| syncFromICalendar | ✅ | 从 iCloud 拉取同步 |
| deleteFromICalendar | ✅ | 删除 iCloud 日历事件 |

### 3.5 外部连接器 ✅

| 连接器 | 状态 | 说明 |
|--------|------|------|
| 飞书表格 | ✅ | 任务主数据源 |
| iCloud CalDAV | ✅ | 日历同步 |
| 飞书机器人 | ✅ | WebSocket 长连接，集成 LarkChannel SDK |

### 3.6 API 路由 ✅

| 方法 | 路径 | 状态 |
|------|------|------|
| POST | /api/tasks | ✅ |
| GET | /api/tasks | ✅ |
| GET | /api/tasks/:id | ✅ |
| PUT | /api/tasks/:id | ✅ |
| DELETE | /api/tasks/:id | ✅ |
| POST | /api/tasks/batch-delete | ✅ |
| GET | /api/events | ✅ |
| POST | /api/events/sync-from-icloud | ✅ |
| POST | /api/semantic/understand | ✅ |
| POST | /api/semantic/confirm | ✅ |
| GET | /api/semantic/context/:id | ✅ |
| WebSocket | /ws/semantic | ✅ |
| GET | /api/health | ✅ |

### 3.7 可观测性 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 操作日志 | ✅ | 日志文件存储 |
| 语义日志 | ✅ | 记录每次语义理解 |
| 追踪日志 | ✅ | 请求链路追踪 |
| LLM 调用记录 | ✅ | 日志记录 latency |

---

## 四、待实现能力

### 4.1 任务延展 (TaskExpansionService)

| 功能 | 优先级 | 状态 |
|------|--------|------|
| LLM 判断延展时机 | 高 | ❌ |
| 自动添加子任务建议 | 高 | ❌ |
| 自动创建关联日程 | 高 | ❌ |
| 延展决策日志 | 中 | ❌ |

**设计位置**: `src/services/expansion-service.ts` (规划中)

### 4.2 记忆学习 (MemoryService)

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 记录每次操作经验 | 中 | ❌ |
| 从历史提取模式 | 中 | ❌ |
| 应用学习规则 | 低 | ❌ |
| 规则置信度更新 | 低 | ❌ |

**设计位置**: `src/services/memory-service.ts` (规划中)

### 4.3 通知服务 (NotificationService)

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 即时通知发送 | 高 | ✅ |
| 定时通知调度 | 高 | ❌ |
| 早晚报模板 | 中 | ❌ |
| 飞书机器人推送 | 中 | ✅ |

**设计位置**: `src/services/notification-service.ts` (调度器规划中)

### 4.4 外部服务

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 天气查询 API | 中 | ❌ |
| 餐厅预订 API | 低 | ❌ |
| 地图/导航集成 | 低 | ❌ |

---

## 五、目录结构

```
src/
├── index.ts                    # 入口文件
├── server.ts                  # HTTP/WebSocket 服务器
│
├── semantic/                  # 语义理解层 (核心)
│   ├── semantic-service.ts    # 主服务 ✅
│   ├── llm-service.ts         # LLM 调用 ✅
│   ├── intent-parser.ts       # 意图解析 ✅
│   ├── capability-dispatcher.ts # 能力分发 ✅
│   ├── prompt-manager.ts      # 提示词管理 ✅
│   ├── context-manager.ts     # 上下文管理 ✅
│   ├── semantic-logger.ts     # 语义日志 ✅
│   ├── trace-logger.ts       # 追踪日志 ✅
│   ├── types.ts              # 类型定义 ✅
│   ├── prompts/               # 提示词定义
│   │   ├── intent-classification.ts ✅
│   │   ├── parameter-extraction.ts ✅
│   │   └── confirmation.ts ✅
│   └── index.ts
│
├── services/                  # 业务服务层
│   ├── task-service.ts        # 任务服务 ✅
│   ├── schedule-service.ts    # 日程服务 ✅
│   └── feishu-bot-service.ts   # 飞书机器人服务 ✅
│
├── connectors/                # 外部连接器
│   ├── feishu.ts             # 飞书表格 ✅
│   ├── icloud.ts             # iCloud CalDAV ✅
│   ├── feishu-bot.ts         # 飞书机器人 ✅
│   └── index.ts
│
├── routes/                    # HTTP 路由
│   ├── task.routes.ts        # 任务 API ✅
│   ├── event.routes.ts       # 日程 API ✅
│   ├── semantic.routes.ts     # 语义 API ✅
│   └── index.ts
│
├── websocket/                # WebSocket 处理
│   └── semantic-ws.ts       # 实时对话 ✅
│
├── shared/                   # 共享模块
│   ├── types.ts             # 共享类型 ✅
│   ├── config.ts            # 配置管理 ✅
│   ├── logger.ts            # 日志工具 ✅
│   ├── recurrence-helper.ts # 循环规则处理 ✅
│   └── index.ts
│
└── prompts/                  # 提示词模板 (JSON)
    ├── templates/
    │   ├── intent-classification.json ✅
    │   ├── entity-extraction.json ✅
    │   ├── parameter-parsing.json ✅
    │   ├── confirmation-request.json ✅
    │   ├── task-expansion.json 🔄
    │   └── memory-learning.json 🔄
    └── prompts-index.json ✅
```

**图例**: ✅ 已实现  🔄 部分实现  ❌ 待实现

---

## 六、数据流

### 6.1 标准对话流程

```
用户: "提醒我今天下午3点开会讨论项目进度"
         │
         ▼
┌─────────────────────────────────────────────────┐
│  1. SemanticService.understand()                │
│     ├─ PromptManager.render() → 渲染提示词       │
│     ├─ LLMService.complete() → 调用 AI           │
│     ├─ IntentParser.parse() → 解析意图          │
│     └─ 返回 ParsedIntent                        │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  2. CapabilityDispatcher.dispatch()             │
│     └─ 根据 intent 分发到对应执行器               │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  3. TaskService.create()                         │
│     └─ 保存到飞书表格                             │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  4. ScheduleService.syncToICalendar()           │
│     └─ 同步到 iCloud 日历                         │
└─────────────────────────────────────────────────┘
         │
         ▼
返回: "已为您创建日程：今天下午3点开会讨论项目进度"
```

### 6.2 确认流程 (低置信度)

```
用户: "安排会议"
         │
         ▼
置信度 0.5 < 0.7，需要确认
         │
         ▼
返回确认问题: "请问您想安排什么类型的会议？"
         │
         ▼
用户: "工作周会"
         │
         ▼
SemanticService.confirm() → 合并参数重新解析
         │
         ▼
执行 create_task
```

---

## 七、测试覆盖

| 模块 | 测试文件 | 测试数 | 状态 |
|------|---------|--------|------|
| TaskService | `integration/task-service.integration.test.ts` | 43 | ✅ |
| ScheduleService | `unit/schedule-service.test.ts` | 15 | ✅ |
| Event Routes | `unit/event-routes.test.ts` | 16 | ✅ |
| ICloud Connector | `unit/icloud-connector.test.ts` | 25 | ✅ |
| IntentParser | `unit/semantic-intent-parser.test.ts` | 29 | ✅ |
| **总计** | | **128** | ✅ |

---

## 八、关键配置文件

### config.yaml

```yaml
server:
  port: 3000
  host: "0.0.0.0"

feishu:
  app_id: "${FEISHU_APP_ID}"
  app_secret: "${FEISHU_APP_SECRET}"
  table_id: "${FEISHU_TABLE_ID}"

icloud:
  apple_id: "${ICLOUD_APPLE_ID}"
  app_password: "${ICLOUD_APP_PASSWORD}"
  calendar_mapping:
    工作: "${ICLOUD_WORK_CALENDAR_ID}"
    个人: "${ICLOUD_PERSONAL_CALENDAR_ID}"
    家庭共享: "${ICLOUD_FAMILY_CALENDAR_ID}"
    work: "${ICLOUD_WORK_CALENDAR_ID}"
    personal: "${ICLOUD_PERSONAL_CALENDAR_ID}"
    family: "${ICLOUD_FAMILY_CALENDAR_ID}"

ai:
  primary:
    provider: "minimax"
    apiKey: "${LLM_API_KEY}"
    baseUrl: "${LLM_API_BASE}"
    model: "MiniMax-Text-01"
    maxRetries: 2
  fallback:
    provider: "minimax"
    apiKey: "${LLM_API_KEY_FALLBACK}"
    baseUrl: "${LLM_API_BASE_FALLBACK}"
    model: "MiniMax-Text-01"
```

---

## 九、问题修复记录

### 已修复问题 (2026-05-09)

| 问题 | 文件 | 修复方案 |
|------|------|---------|
| 指代词解析 | `semantic-service.ts` | 新增 `ReferenceResolutionPrompt` 和 LLM 语义匹配 |
| 参考解析 | `context-manager.ts` | 添加 `MentionRecord` 跟踪近期操作 |
| "选第一个"处理 | `semantic-service.ts` | 新增 `ContextualUnderstandingPrompt` 处理选项选择 |
| 日期星期计算 | `semantic-service.ts` | 修复 `formatParametersWithDate` 正确计算星期 |
| 分类验证 | `capability-dispatcher.ts` | 添加 `normalizeCategory` 白名单校验（工作/个人/家庭共享） |
| iCloud 跨日历同步 | `capability-dispatcher.ts` | 修改分类时从旧日历删除并同步到新日历 |
| DELETE_TASK 确认 | `capability-dispatcher.ts` | 删除前查询相关事件，按时间排序展示 |

### 已修复问题 (2026-05-07)

| 问题 | 文件 | 修复方案 |
|------|------|---------|
| 日期解析时区问题 | `intent-parser.ts` | 数值比较年月日 |
| UTF-8 编码问题 | `semantic.routes.ts` | Buffer 正确处理 |
| LLM 服务重试 | `llm-service.ts` | 递增延迟重试 |
| 意图识别示例 | `intent-classification.ts` | 添加"今天怎么样"示例 |
| OTHER 意图处理 | `capability-dispatcher.ts` | 映射到 create_task |
| EADDRINUSE 问题 | `server.ts` | uncaughtException 处理 |

---

## 十、后续规划

### 短期 (1-2周)

1. ✅ 完成飞书机器人 WebSocket 长连接集成
2. 完善 WebSocket 测试
3. 添加语义理解层集成测试

### 中期 (1个月)

1. 实现任务延展服务
2. 实现定时通知调度
3. 添加早晚报模板

### 长期

1. 实现记忆学习服务
2. 支持多用户
3. 添加更多外部 API 集成
