# Semantic Understanding API

## 概述

语义理解层为用户提供统一的自然语言入口，将用户输入转换为可执行的指令。

## API 端点

### 1. 理解用户输入

```
POST /api/semantic/understand
```

**Request:**
```json
{
  "text": "帮我安排明天上午10点开会",
  "userId": "user_001"
}
```

**Response (直接执行):**
```json
{
  "success": true,
  "intent": {
    "id": "ctx_abc123",
    "intent": "create_task",
    "entityType": "task",
    "parameters": {
      "title": "开会",
      "start_date": "2026-05-07",
      "start_time": "10:00",
      "category": "工作"
    },
    "confidence": 0.95,
    "needsConfirmation": false,
    "lowConfidence": false,
    "reasoning": "检测到具体时间，属于日程创建任务",
    "rawInput": "帮我安排明天上午10点开会"
  },
  "requiresExecution": true,
  "result": {
    "taskId": "recviKhJo7sxTj",
    "action": "created",
    "icloudEventId": "1777981633660-63uzvcfa6@caldav.icloud.com"
  }
}
```

**Response (需要确认):**
```json
{
  "success": true,
  "intent": {
    "id": "ctx_abc123",
    "intent": "complete_task",
    "parameters": {
      "keyword": "供应商"
    },
    "confidence": 0.5,
    "needsConfirmation": true,
    "lowConfidence": true,
    "reasoning": "多个任务匹配关键词"
  },
  "requiresExecution": false,
  "confirmationQuestion": "请问您要完成的是哪个关于供应商的任务？",
  "confirmationOptions": [
    { "id": "opt_1", "label": "联系供应商确认报价", "type": "task" },
    { "id": "opt_2", "label": "供应商合同审批", "type": "task" }
  ],
  "openOption": {
    "id": "open",
    "label": "都不是，我想补充说明"
  }
}
```

---

### 2. 确认并执行

```
POST /api/semantic/confirm
```

**Request (选择选项):**
```json
{
  "contextId": "ctx_abc123",
  "selectedOption": "opt_1"
}
```

**Request (开放式补充):**
```json
{
  "contextId": "ctx_abc123",
  "openText": "我是想说联系供应商确认报价那个任务"
}
```

**Request (取消):**
```json
{
  "contextId": "ctx_abc123",
  "cancel": true
}
```

**Response (执行成功):**
```json
{
  "success": true,
  "intent": {
    "id": "ctx_abc123",
    "intent": "complete_task"
  },
  "requiresExecution": true,
  "result": {
    "taskId": "recviKhJo7abc",
    "action": "completed"
  }
}
```

**Response (取消成功):**
```json
{
  "success": true,
  "cancelled": true,
  "message": "已取消当前操作"
}
```

---

### 3. 获取上下文状态

```
GET /api/semantic/context/:contextId
```

**Response:**
```json
{
  "success": true,
  "context": {
    "id": "ctx_abc123",
    "intent": "complete_task",
    "rawInput": "完成那个关于供应商的任务",
    "createdAt": "2026-05-06T10:00:00Z",
    "expiresAt": "2026-05-06T10:05:00Z",
    "status": "pending_confirmation"
  }
}
```

---

## 错误响应

```json
{
  "success": false,
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "上下文已过期或不存在，请重新输入"
  }
}
```

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| `CONTEXT_NOT_FOUND` | 404 | 上下文不存在或已超时 |
| `CONTEXT_EXPIRED` | 410 | 上下文已过期 |
| `INVALID_OPTION` | 400 | 选择的选项无效 |
| `INVALID_OPEN_TEXT` | 400 | 补充说明为空 |
| `EXECUTION_FAILED` | 500 | 执行失败 |

---

## 上下文管理

### 超时机制

- 默认超时时间: **5分钟**
- 超时后上下文自动删除

### 跳出上下文

- 用户发送新任务时，自动忽略旧上下文
- 用户输入"取消"时，清除当前上下文

### 状态流转

```
用户输入 → 创建上下文 (pending_confirmation 或 executing)
    │
    ├── needsConfirmation=true → 等待用户确认
    │       │
    │       ├── 用户选择选项 → 执行
    │       ├── 用户补充说明 → 重新解析 → 执行
    │       └── 用户取消 → 删除上下文
    │
    └── needsConfirmation=false → 直接执行
            │
            └── 执行完成 → 删除上下文
```

---

## 参数说明

### IntentType

| 值 | 说明 |
|----|------|
| `create_task` | 创建任务 |
| `query_tasks` | 查询任务列表 |
| `query_events` | 查询日程 |
| `update_task` | 更新任务 |
| `complete_task` | 完成任务 |
| `delete_task` | 删除任务 |
| `expand_task` | 智能规划 |
| `other` | 其他/无法识别 |

### ConfirmationStatus

| 值 | 说明 |
|----|------|
| `pending_confirmation` | 等待用户确认 |
| `executing` | 执行中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |
| `expired` | 已过期 |