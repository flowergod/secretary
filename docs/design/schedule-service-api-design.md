# 日程服务与 iCloud 同步 API 设计

## 更新日期

2026-05-04

---

## 一、需求概述

### 1.1 核心规则

当任务包含 `start_date` 时，视为日程，需同步至 iCloud 日历。

| 操作 | 规则 |
|------|------|
| 创建任务（含 start_date） | 在 iCloud 创建日历事件 |
| 更新任务（含 start_date） | 更新 iCloud 日历事件 |
| 删除任务（含 icloud_event_id） | 删除 iCloud 日历事件 |
| 删除任务（无 icloud_event_id） | 仅删除飞书任务 |
| 查询日程 | 返回飞书中所有含 start_date 的任务 |

### 1.2 iCloud 配置

配置来源：`config.yaml` 中的 `icloud` 节点

```yaml
icloud:
  appleId: "mrd13817925342@icloud.com"
  appPassword: "vjwo-xsaa-yhgq-lawr"
  calendarMapping:
    工作: "D03AAE8F-D142-42CF-8FF2-BA7AB2E83092"
    个人: "F7D25790-4368-447C-96FF-4F7FE022AE1C"
    家庭共享: "family-new"
    work: "D03AAE8F-D142-42CF-8FF2-BA7AB2E83092"
    personal: "F7D25790-4368-447C-96FF-4F7FE022AE1C"
    family: "family-new"
```

---

## 二、iCloud 连接器

### 2.1 文件位置

`src/connectors/icloud.ts`

### 2.2 CalDAV 操作封装

```typescript
export class ICloudConnector {
  private appleId: string;
  private appPassword: string;
  private calendarMapping: Record<string, string>;

  /**
   * 创建日历事件
   * @param event 事件信息
   * @returns 创建后的 iCloud 事件 ID (uid)
   */
  async createEvent(event: ICloudEvent): Promise<string>;

  /**
   * 更新日历事件
   * @param uid 事件 UID
   * @param event 更新后的信息
   */
  async updateEvent(uid: string, event: Partial<ICloudEvent>): Promise<void>;

  /**
   * 删除日历事件
   * @param uid 事件 UID
   */
  async deleteEvent(uid: string): Promise<void>;

  /**
   * 查询指定日历的事件
   * @param calendarId 日历 ID
   * @param startDate 查询开始日期
   * @param endDate 查询结束日期
   */
  async queryEvents(
    calendarId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ICloudEvent[]>;

  /**
   * 获取日历列表
   */
  async listCalendars(): Promise<Calendar[]>;
}
```

### 2.3 数据结构

```typescript
interface ICloudEvent {
  uid: string;              // 事件唯一标识 (iCloud 格式: UUID@caldav.icloud.com)
  title: string;
  description?: string;
  startDate: string;        // YYYY-MM-DD
  startTime?: string;        // HH:MM
  endDate?: string;          // YYYY-MM-DD (跨日时需要)
  endTime?: string;          // HH:MM
  calendarId: string;        // 所属日历 ID
  recurrenceRule?: string;   // RRULE 格式
  location?: string;
}

interface Calendar {
  id: string;               // iCloud 日历 ID
  name: string;              // 显示名称
  color?: string;            // 日历颜色
}
```

---

## 三、日程服务 (ScheduleService)

### 3.1 文件位置

`src/services/schedule-service.ts`

### 3.2 核心职责

1. 接收任务创建/更新/删除时的日程同步请求
2. 管理 `icloud_event_id` 与任务的映射关系
3. 提供日程查询接口

### 3.3 日程与任务的对应关系

```
Task {
  id: "uuid",
  start_date: "2026-05-05",    ← 有此字段视为日程
  start_time: "09:00",
  end_time: "10:00",
  category: "工作",
  icloud_event_id: "uuid@caldav.icloud.com"  ← 关联的 iCloud 事件 ID
}
```

### 3.4 日程同步流程

#### 创建时同步

```
TaskService.create(task with start_date)
    │
    ▼
ScheduleService.syncToICalendar(task)
    │
    ├─── 创建 ICloudEvent
    ├─── ICloudConnector.createEvent()
    ├─── 获取返回的 uid
    └─── 更新 Task.icloud_event_id = uid
```

#### 更新时同步

```
TaskService.update(id, updates with start_date)
    │
    ▼
ScheduleService.syncToICalendar(updatedTask)
    │
    ├─── 检查 icloud_event_id 是否存在
    ├─── 存在 → ICloudConnector.updateEvent(uid, event)
    └─── 不存在 → ICloudConnector.createEvent() → 更新 icloud_event_id
```

#### 删除时同步

```
TaskService.delete(id)
    │
    ▼
检查 Task.icloud_event_id
    │
    ├─── 存在 → ICloudConnector.deleteEvent(uid)
    └─── 不存在 → 仅删除飞书记录
```

---

## 四、API 接口设计

### 4.1 日程路由

文件：`src/routes/event.routes.ts`

#### 4.1.1 查询日程

```
GET /api/events
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| date | string | 查询指定日期 (YYYY-MM-DD) |
| start_date | string | 查询开始日期 |
| end_date | string | 查询结束日期 |
| calendar | string | 日历分类 (工作/个人/family) |
| page | number | 页码，默认 1 |
| page_size | number | 每页数量，默认 20 |

**返回：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "会议",
        "start_date": "2026-05-05",
        "start_time": "09:00",
        "end_time": "10:00",
        "category": "工作",
        "icloud_event_id": "uuid@caldav.icloud.com",
        "status": "pending",
        "is_recurring": true,
        "recurrence_type": "weekly"
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 20
  }
}
```

#### 4.1.2 获取单个日程

```
GET /api/events/:id
```

**返回：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "会议",
    "start_date": "2026-05-05",
    "start_time": "09:00",
    "end_time": "10:00",
    "category": "工作",
    "icloud_event_id": "uuid@caldav.icloud.com",
    "icloud_sync_status": "synced"
  }
}
```

#### 4.1.3 创建日程

```
POST /api/events
```

**入参：**
```json
{
  "title": "投研投顾晨会",
  "description": "周二、周四晨会",
  "start_date": "2026-05-05",
  "start_time": "08:45",
  "end_time": "09:30",
  "category": "工作",
  "is_recurring": true,
  "recurrence_type": "weekly",
  "recurrence_rule": "RRULE:FREQ=WEEKLY;BYDAY=TU,TH"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "icloud_event_id": "uuid@caldav.icloud.com",
    "title": "投研投顾晨会",
    "start_date": "2026-05-05",
    "start_time": "08:45",
    "end_time": "09:30",
    "icloud_sync_status": "synced"
  }
}
```

#### 4.1.4 更新日程

```
PUT /api/events/:id
```

**入参：**
```json
{
  "title": "更新后的标题",
  "start_time": "10:00",
  "end_time": "11:00"
}
```

**返回：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "icloud_event_id": "uuid@caldav.icloud.com",
    "icloud_sync_status": "synced"
  }
}
```

#### 4.1.5 删除日程

```
DELETE /api/events/:id
```

**返回：**
```json
{
  "success": true,
  "data": {
    "deleted": 1,
    "icloud_deleted": true
  }
}
```

#### 4.1.6 全量同步 iCloud 到飞书

```
POST /api/events/sync-from-icloud
```

**说明：** 从 iCloud 拉取所有事件，与飞书表格对比，找出缺失的任务并补全。

**返回：**
```json
{
  "success": true,
  "data": {
    "synced": 15,
    "created": 3,
    "updated": 12,
    "errors": []
  }
}
```

---

## 五、错误码

| 错误码 | 说明 |
|--------|------|
| 3001 | iCloud API 调用失败 |
| 3002 | 日程同步失败 |
| 3003 | iCloud 认证失败 |
| 3004 | 日历不存在 |

---

## 六、关键实现细节

### 6.1 iCloud CalDAV 接口

iCloud 使用标准 CalDAV 协议，接入点：

```
https://caldav.icloud.com/
```

认证方式：HTTP Basic Auth with Apple ID + App Password

### 6.2 iCaldav 库选择

建议使用 `node-icloud` 或原生 fetch + CalDAV XML

主要操作：

```typescript
// 创建事件
PUT /{userId}/calendars/{calendarId}/{uid}.ics
Content-Type: text/calendar

BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:{uid}
DTSTART:20260505T084500
DTEND:20260505T093000
SUMMARY:投研投顾晨会
RRULE:FREQ=WEEKLY;BYDAY=TU,TH
END:VEVENT
END:VCALENDAR

// 查询事件
REPORT /{userId}/calendars/{calendarId}/
Content-Type: application/xml
C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
  C:filter>
    C:time-range start="2026-05-01T00:00:00Z" end="2026-05-31T23:59:59Z"/>
  </C:filter>
</C:calendar-query>

// 删除事件
DELETE /{userId}/calendars/{calendarId}/{uid}.ics
```

### 6.3 日历分类映射

根据 `category` 字段决定写入哪个 iCloud 日历：

```typescript
const calendarMapping: Record<string, string> = {
  '工作': 'D03AAE8F-D142-42CF-8FF2-BA7AB2E83092',
  'work': 'D03AAE8F-D142-42CF-8FF2-BA7AB2E83092',
  '个人': 'F7D25790-4368-447C-96FF-4F7FE022AE1C',
  'personal': 'F7D25790-4368-447C-96FF-4F7FE022AE1C',
  '家庭共享': 'family-new',
  'family': 'family-new',
};
```

### 6.4 同步状态字段

在 Task 类型中增加 `icloud_sync_status` 字段（可选）：

```typescript
interface Task {
  // ... existing fields
  icloud_sync_status?: 'synced' | 'pending' | 'error';
}
```

---

## 七、与 TaskService 的集成点

### 7.1 集成位置

TaskService 中的 create/update/delete/complete 方法需要调用 ScheduleService 进行日程同步。

### 7.2 集成代码示例

```typescript
// TaskService.create() 中
const created = await feishuConnector.create(task);
logger.info(`[TaskService] Created task: ${created.id}`);

// 如果有 start_date，同步到 iCloud
if (created.start_date) {
  const syncResult = await scheduleService.syncToICalendar(created);
  if (syncResult.success) {
    // 更新 icloud_event_id
    await feishuConnector.update(created.id, {
      icloud_event_id: syncResult.icloud_event_id
    });
  }
}

return { success: true, data: created };
```

---

## 八、待验证问题

1. **iCloud App Password**：当前配置中的密码是演示用密码，需替换为真实 App Specific Password
2. **日历 ID 映射**：`family-new` 是日历名还是日历 ID 需确认
3. **时区处理**：iCloud 使用什么时区，需测试验证
4. **事件 UID 格式**：iCloud 返回的 UID 格式需实测确定
