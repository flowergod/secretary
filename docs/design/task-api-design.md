# 任务管理模块 API 设计文档

## 1. 概述

任务管理模块（TaskService）是系统的核心原子服务，所有任务数据存储在飞书表格中，每行代表一个任务。

### 1.1 数据模型

```typescript
// 任务实体（对应飞书表格一行）
interface Task {
  id: string;                // UUID，飞书表格中的"任务ID"字段
  title: string;             // 任务名称（用户输入的标题）
  description?: string;     // 描述
  status: TaskStatus;        // 状态
  priority: TaskPriority;    // 优先级
  category?: string;         // 分类
  due_date?: string;         // 截止日期 YYYY-MM-DD
  start_date?: string;       // 开始日期 YYYY-MM-DD（有值则视为日程）
  start_time?: string;       // 开始时间 HH:MM
  end_time?: string;         // 结束时间 HH:MM
  is_recurring: boolean;      // 是否循环
  recurrence_type: RecurrenceType;      // 循环类型
  recurrence_rule?: string;             // RRULE 格式字符串
  icloud_event_id?: string;             // iCloud 日历事件 ID
  parent_id?: string;       // 父任务 ID（用于子任务）
  source?: string;           // 来源标识
  created_at: string;        // 创建时间 ISO 8601
  updated_at: string;        // 更新时间 ISO 8601
}

// 状态枚举
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// 优先级枚举
type TaskPriority = 'high' | 'medium' | 'low';

// 循环类型枚举
type RecurrenceType =
  | 'none'           // 不循环
  | 'daily'          // 每日
  | 'weekly'          // 每周一次
  | 'weekly_n'        // 每周N次
  | 'monthly'         // 每月一次
  | 'monthly_n'       // 每月N次
  | 'yearly'          // 每年一次
  | 'yearly_n';       // 每年N次
```

### 1.2 飞书表格字段映射

| 飞书字段名 | Task 属性 | 类型 | 说明 |
|-----------|-----------|------|------|
| 序号 | (自动) | AutoNumber | 飞书自增长序号，仅供展示 |
| 任务ID | id | Text | UUID |
| 任务名称 | title | Text | 用户输入的任务标题 |
| 描述 | description | Text | - |
| 状态 | status | SingleSelect | pending/in_progress/completed/cancelled |
| 优先级 | priority | SingleSelect | high/medium/low |
| 分类 | category | SingleSelect | 工作/个人/家庭共享 |
| 截止日期 | due_date | Text | YYYY-MM-DD |
| 开始日期 | start_date | Text | YYYY-MM-DD |
| 开始时间 | start_time | Text | HH:MM |
| 结束时间 | end_time | Text | HH:MM |
| 是否循环 | is_recurring | MultiSelect | "循环" |
| 循环类型 | recurrence_type | SingleSelect | none/daily/weekly/weekly_n/monthly/monthly_n/yearly/yearly_n |
| 循环规则 | recurrence_rule | Text | RRULE |
| iCloud事件ID | icloud_event_id | Text | - |
| 父任务ID | parent_id | Text | - |
| 来源 | source | Text | - |
| 创建时间 | created_at | Text | ISO 8601 |
| 更新时间 | updated_at | Text | ISO 8601 |

### 1.3 状态值映射

飞书 SingleSelect 存储中文值，内部使用英文枚举：

| 内部值 (英文) | 飞书显示值 |
|--------------|-----------|
| pending | 待处理 |
| in_progress | 进行中 |
| completed | 已完成 |
| cancelled | 已取消 |
| high | 高 |
| medium | 中 |
| low | 低 |

### 1.4 循环类型详解

#### 1.4.1 循环类型枚举与 RRULE 映射

| recurrence_type | 说明 | RRULE 示例 |
|-----------------|------|-----------|
| `none` | 不循环 | - |
| `daily` | 每日 | `RRULE:FREQ=DAILY` |
| `weekly` | 每周一次（单日） | `RRULE:FREQ=WEEKLY;BYDAY=MO` |
| `weekly_n` | 每周N次（多日） | `RRULE:FREQ=WEEKLY;BYDAY=TU,TH` |
| `monthly` | 每月一次 | `RRULE:FREQ=MONTHLY;BYMONTHDAY=15` |
| `monthly_n` | 每月N次 | `RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15` |
| `yearly` | 每年一次 | `RRULE:FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=15` |
| `yearly_n` | 每年N次 | `RRULE:FREQ=YEARLY;BYMONTH=5,10;BYMONTHDAY=1` |

#### 1.4.2 recurrence_rule 结构

当 recurrence_type 为 `weekly_n`、`monthly_n`、`yearly_n` 时，`recurrence_rule` 以对象形式存储：

```typescript
// 每周二、周四
recurrence_rule: {
  type: 'weekly_n',
  days: [2, 4]      // 0=周日, 1=周一, ..., 6=周六
}

// 每月1号和15号
recurrence_rule: {
  type: 'monthly_n',
  days: [1, 15]     // 月份中的日期
}

// 每年5月1日和10月1日
recurrence_rule: {
  type: 'yearly_n',
  months: [5, 10],   // 1-12
  days: [1, 1]       // 月份中的日期，对应months
}
```

#### 1.4.3 星期映射表

| 数字 | 枚举值 | RRULE | 说明 |
|------|--------|-------|------|
| 0 | SU | SU | 周日 |
| 1 | MO | MO | 周一 |
| 2 | TU | TU | 周二 |
| 3 | WE | WE | 周三 |
| 4 | TH | TH | 周四 |
| 5 | FR | FR | 周五 |
| 6 | SA | SA | 周六 |

---

## 2. API 接口

### 2.1 创建任务

```
POST /api/tasks
```

**请求体：**

```typescript
interface CreateTaskRequest {
  title: string;            // 任务名称（必填）
  description?: string;      // 描述
  priority?: TaskPriority;   // 优先级，默认 medium
  category?: string;         // 分类
  due_date?: string;         // 截止日期 YYYY-MM-DD
  start_date?: string;       // 开始日期 YYYY-MM-DD
  start_time?: string;       // 开始时间 HH:MM
  end_time?: string;         // 结束时间 HH:MM
  is_recurring?: boolean;    // 是否循环，默认 false
  recurrence_type?: RecurrenceType;  // 循环类型
  recurrence_rule?: string | object; // RRULE 字符串或对象
  parent_id?: string;        // 父任务 ID
  source?: string;           // 来源标识
}
```

**响应：**

```typescript
interface CreateTaskResponse {
  success: true;
  data: Task;
}
```

**错误码：**
- `2002`: 任务创建失败

---

### 2.2 查询任务列表

```
GET /api/tasks
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 按状态筛选 |
| priority | string | 否 | 按优先级筛选 |
| category | string | 否 | 按分类筛选 |
| due_date | string | 否 | 按截止日期筛选 YYYY-MM-DD |
| due_date_from | string | 否 | 截止日期起 YYYY-MM-DD |
| due_date_to | string | 否 | 截止日期止 YYYY-MM-DD |
| start_date | string | 否 | 按开始日期筛选 YYYY-MM-DD |
| is_recurring | boolean | 否 | 按是否循环筛选 |
| parent_id | string | 否 | 按父任务 ID 筛选（查子任务） |
| page | number | 否 | 页码，默认 1 |
| page_size | number | 否 | 每页数量，默认 20，最大 100 |
| sort_by | string | 否 | 排序字段，默认 created_at |
| sort_order | string | 否 | 排序方向 asc/desc，默认 desc |

**响应：**

```typescript
interface ListTasksResponse {
  success: true;
  data: {
    items: Task[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}
```

---

### 2.3 查询单个任务

```
GET /api/tasks/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID (UUID) |

**响应：**

```typescript
interface GetTaskResponse {
  success: true;
  data: Task;
}
```

**错误响应：**
- `2001`: 任务不存在

---

### 2.4 更新任务

```
PUT /api/tasks/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID (UUID) |

**请求体：**

```typescript
interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  category?: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: string | object;
  parent_id?: string;
  source?: string;
}
```

**响应：**

```typescript
interface UpdateTaskResponse {
  success: true;
  data: Task;
}
```

**错误响应：**
- `2001`: 任务不存在
- `2003`: 任务更新失败

---

### 2.5 删除任务

```
DELETE /api/tasks/:id
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID (UUID) |

**响应：**

```typescript
interface DeleteTaskResponse {
  success: true;
  data: {
    deleted: 1;
  };
}
```

**错误响应：**
- `2001`: 任务不存在

---

### 2.6 批量删除任务

```
POST /api/tasks/batch-delete
```

**请求体：**

```typescript
interface BatchDeleteTasksRequest {
  ids: string[];  // 任务 ID 数组
}
```

**响应：**

```typescript
interface BatchDeleteTasksResponse {
  success: true;
  data: {
    deleted: number;   // 成功删除数量
    failed: number;     // 失败数量
    errors?: string[];  // 失败详情
  };
}
```

---

### 2.7 完成任务

```
POST /api/tasks/:id/complete
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID (UUID) |

**响应：**

```typescript
interface CompleteTaskResponse {
  success: true;
  data: Task;  // 更新后的任务
}
```

**说明：** 将任务状态设置为 `completed`

---

### 2.8 状态变更（除完成外的状态变更）

```
POST /api/tasks/:id/transition
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID (UUID) |

**请求体：**

```typescript
interface TransitionTaskRequest {
  to_status: TaskStatus;  // 目标状态（不能是 completed）
  reason?: string;        // 变更原因（可选）
}
```

**允许的转换：**

| 当前状态 | 允许的目标状态 |
|---------|---------------|
| pending | in_progress, cancelled |
| in_progress | pending, cancelled |
| cancelled | pending（重新激活） |
| completed | (不允许从此接口变更) |

**响应：**

```typescript
interface TransitionTaskResponse {
  success: true;
  data: {
    task: Task;           // 更新后的任务
    from_status: TaskStatus;
    to_status: TaskStatus;
    transitioned_at: string;  // ISO 8601
  };
}
```

**错误响应：**
- `2001`: 任务不存在
- `2005`: 非法的状态转换
- `2006`: 不能将已完成任务从此接口变更（需用 complete 接口）

---

## 3. 实现细节

### 3.1 飞书表格操作

使用飞书多维表格 API：

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

### 3.2 字段类型映射

| 字段类型 | 飞书 type | 读取 | 写入 |
|---------|-----------|------|------|
| Text | 1 | string | string |
| Number | 2 | number | number |
| SingleSelect | 3 | string | { name: string } |
| MultiSelect | 4 | string[] | string[] |
| DateTime | 5 | timestamp(ms) | timestamp(ms) |
| Checkbox | 4 | boolean | boolean |
| URL | 15 | { link: string } | { link: string } |

### 3.3 状态转换图

```
                    ┌─────────────────┐
                    │                 │
         ┌──────────│    pending      │──────────┐
         │          │   (待处理)       │          │
         │          │                 │          │
         │          └────────┬────────┘          │
         │                   │                   │
         │          开始执行  │                   │ 取消
         │                   ▼                   │
         │          ┌────────────────┐            │
         │          │                │            │
    重新激活  │          │  in_progress   │            │
         │          │   (进行中)      │            │
         │          │                │            │
         │          └────────┬────────┘            │
         │                   │                     │
         │          完成  │                     │ 取消
         │                   ▼                     ▼
         │          ┌────────────────┐   ┌────────────────┐
         │          │                │   │                │
         └─────────▶│   completed    │   │   cancelled    │
                    │   (已完成)      │   │    (已取消)     │
                    │                │   │                │
                    └────────────────┘   └────────────────┘
                                                      │
                                            重新激活  │
                                                      ▼
                                            ┌────────────────┐
                                            │    pending     │
                                            │   (待处理)     │
                                            └────────────────┘
```

### 3.4 RRULE 构建规则

```typescript
function buildRRule(recurrenceType: RecurrenceType, rule?: string | object): string {
  switch (recurrenceType) {
    case 'none':
      return '';

    case 'daily':
      return 'RRULE:FREQ=DAILY';

    case 'weekly':
      // rule 格式: 1 (周一), 2 (周二), ...
      const weekDay = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][rule as number];
      return `RRULE:FREQ=WEEKLY;BYDAY=${weekDay}`;

    case 'weekly_n':
      // rule 格式: [2, 4] 表示周二、周四
      const weekDays = (rule as number[]).map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${weekDays}`;

    case 'monthly':
      // rule 格式: 15 (每月15号)
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${rule}`;

    case 'monthly_n':
      // rule 格式: [1, 15] (每月1号和15号)
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${(rule as number[]).join(',')}`;

    case 'yearly':
      // rule 格式: { month: 5, day: 15 } (每年5月15日)
      const yRule = rule as { month: number; day: number };
      return `RRULE:FREQ=YEARLY;BYMONTH=${yRule.month};BYMONTHDAY=${yRule.day}`;

    case 'yearly_n':
      // rule 格式: { months: [5, 10], days: [1, 1] } (每年5月1日和10月1日)
      const ynRule = rule as { months: number[]; days: number[] };
      const yearlyDates = ynRule.months.map((m, i) => `${m}${ynRule.days[i]}`).join(',');
      // 简化：使用 BYMONTH 和 BYMONTHDAY 的组合
      return `RRULE:FREQ=YEARLY;BYMONTH=${ynRule.months.join(',')};BYMONTHDAY=${ynRule.days.join(',')}`;

    default:
      return '';
  }
}
```

---

## 4. 错误码

| 错误码 | 常量 | 说明 |
|--------|------|------|
| 2001 | TASK_NOT_FOUND | 任务不存在 |
| 2002 | TASK_CREATE_FAILED | 任务创建失败 |
| 2003 | TASK_UPDATE_FAILED | 任务更新失败 |
| 2004 | TASK_DELETE_FAILED | 任务删除失败 |
| 2005 | TASK_INVALID_TRANSITION | 非法的状态转换 |
| 2006 | TASK_COMPLETED_NOT_TRANSITIONABLE | 已完成任务不能通过此接口变更 |
| 1001 | FEISHU_API_ERROR | 飞书 API 调用失败 |

---

## 5. 使用示例

### 5.1 创建每日循环任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "每日站立会议",
    "is_recurring": true,
    "recurrence_type": "daily",
    "start_time": "09:00",
    "end_time": "09:30"
  }'
```

### 5.2 创建每周二、周四的循环任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "投研投顾晨会",
    "is_recurring": true,
    "recurrence_type": "weekly_n",
    "recurrence_rule": [2, 4],
    "start_time": "08:45",
    "end_time": "09:30"
  }'
```

### 5.3 创建每月1号和15号的循环任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "账单日",
    "is_recurring": true,
    "recurrence_type": "monthly_n",
    "recurrence_rule": [1, 15]
  }'
```

### 5.4 创建每年特定日期的循环任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "公司成立纪念日",
    "is_recurring": true,
    "recurrence_type": "yearly",
    "recurrence_rule": {"month": 5, "day": 20}
  }'
```

### 5.5 状态变更

```bash
# 将任务从待处理改为进行中
curl -X POST http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000/transition \
  -H "Content-Type: application/json" \
  -d '{"to_status": "in_progress", "reason": "开始执行"}'

# 取消任务
curl -X POST http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000/transition \
  -H "Content-Type: application/json" \
  -d '{"to_status": "cancelled", "reason": "需求变更"}'

# 重新激活已取消的任务
curl -X POST http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000/transition \
  -H "Content-Type: application/json" \
  -d '{"to_status": "pending", "reason": "重新启动"}'
```

### 5.6 完成任务

```bash
curl -X POST http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000/complete
```

---

## 6. 飞书表格字段更新

需在飞书表格中新增 `任务名称` 字段，完整字段列表：

| 飞书字段名 | Task 属性 | 类型 | 说明 |
|-----------|-----------|------|------|
| 序号 | (自动) | AutoNumber | 飞书自增长序号，仅供展示 |
| 任务ID | id | Text | UUID |
| **任务名称** | **title** | **Text** | **用户输入的任务标题** |
| 描述 | description | Text | - |
| 状态 | status | SingleSelect | pending/in_progress/completed/cancelled |
| 优先级 | priority | SingleSelect | high/medium/low |
| 分类 | category | SingleSelect | 工作/个人/家庭共享 |
| 截止日期 | due_date | Text | YYYY-MM-DD |
| 开始日期 | start_date | Text | YYYY-MM-DD |
| 开始时间 | start_time | Text | HH:MM |
| 结束时间 | end_time | Text | HH:MM |
| 是否循环 | is_recurring | MultiSelect | "循环" |
| 循环类型 | recurrence_type | SingleSelect | 见循环类型枚举 |
| 循环规则 | recurrence_rule | Text | RRULE |
| iCloud事件ID | icloud_event_id | Text | - |
| 父任务ID | parent_id | Text | - |
| 来源 | source | Text | - |
| 创建时间 | created_at | Text | ISO 8601 |
| 更新时间 | updated_at | Text | ISO 8601 |

---

## 7. 后续扩展

### 7.1 子任务管理

通过 `parent_id` 字段支持嵌套：

```bash
# 创建子任务
curl -X POST http://localhost:3000/api/tasks \
  -d '{"title": "子任务", "parent_id": "parent-uuid"}'

# 查询子任务
curl "http://localhost:3000/api/tasks?parent_id=parent-uuid"
```

### 7.2 任务统计

```
GET /api/tasks/stats
```

```json
{
  "success": true,
  "data": {
    "total": 100,
    "by_status": {
      "pending": 30,
      "in_progress": 20,
      "completed": 45,
      "cancelled": 5
    },
    "by_priority": {
      "high": 15,
      "medium": 60,
      "low": 25
    },
    "overdue": 5
  }
}
```
