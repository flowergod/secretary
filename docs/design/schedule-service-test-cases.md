# 日程服务测试用例文档

## 更新日期

2026-05-04

---

## 一、测试范围

本文档涵盖：
- iCloud 连接器 (ICloudConnector)
- 日程服务 (ScheduleService)
- 日程路由 (event.routes.ts)
- iCloud 与飞书表格的同步逻辑

---

## 二、数据准备

### 2.1 测试配置

```yaml
icloud:
  appleId: "test@example.com"
  appPassword: "test-app-password"
  calendarMapping:
    工作: "work-calendar-id"
    个人: "personal-calendar-id"
    family: "family-calendar-id"
```

### 2.2 测试日历 ID

| 分类 | calendarId | 说明 |
|------|-----------|------|
| 工作类 | `D03AAE8F-D142-42CF-8FF2-BA7AB2E83092` | 主工作日历 |
| 个人类 | `F7D25790-4368-447C-96FF-4F7FE022AE1C` | 个人日历 |
| 家庭类 | `family-new` | 家庭共享日历 |

### 2.3 测试任务模板

```typescript
const baseTask = {
  id: "test-task-id",
  title: "测试日程",
  description: "测试描述",
  status: "pending" as const,
  priority: "medium" as const,
  category: "工作",
  due_date: "2026-05-10",
  start_date: "2026-05-05",
  start_time: "09:00",
  end_time: "10:00",
  is_recurring: false,
  recurrence_type: "none" as const,
  recurrence_rule: undefined,
  icloud_event_id: undefined,
  parent_id: undefined,
  source: "test",
  created_at: "2026-05-04T00:00:00Z",
  updated_at: "2026-05-04T00:00:00Z",
};
```

---

## 三、iCloud 连接器测试

### 3.1 createEvent 创建事件

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-E001 | 创建简单日程事件 | `{title, startDate, startTime}` | 返回有效 uid |
| IC-E002 | 创建完整日程事件 | 包含 title, description, startDate, startTime, endDate, endTime, location | uid 正确创建 |
| IC-E003 | 创建循环日程事件 | 包含 recurrenceRule (RRULE) | RRULE 正确保存 |
| IC-E004 | 跨天事件 | startDate: 05-05 09:00, endDate: 05-06 10:00 | 事件正确拆分 |
| IC-E005 | 无结束时间事件 | 只有 startDate, startTime | 使用默认时长 1 小时 |
| IC-E006 | 指定日历 | 指定 category=工作 | 事件写入对应日历 |
| IC-E007 | 不指定日历 | 无 category | 使用默认日历 |
| IC-E008 | 事件创建失败-认证失败 | 错误的 appleId/password | 抛出 ICLOUD_AUTH_ERROR |
| IC-E009 | 事件创建失败-日历不存在 | 指定不存在的 calendarId | 抛出 ICLOUD_CALENDAR_NOT_FOUND |

**边界值测试：**

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-E010 | 空标题 | title="" | 抛出 VALIDATION_ERROR |
| IC-E011 | 标题超长 | title 长度 500 字符 | 抛出 VALIDATION_ERROR 或截断 |
| IC-E012 | 过去时间 | startDate 为昨天 | 事件创建成功（历史事件） |
| IC-E013 | 极早时间 | startDate: 1970-01-01 | 事件创建成功 |
| IC-E014 | 极晚时间 | startDate: 2099-12-31 | 事件创建成功 |

---

### 3.2 updateEvent 更新事件

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-U001 | 更新标题 | uid + {title: "新标题"} | 标题已更新 |
| IC-U002 | 更新时间和日期 | uid + {startDate, startTime, endTime} | 时间已更新 |
| IC-U003 | 更新循环规则 | uid + {recurrenceRule} | 规则已更新 |
| IC-U004 | 清除可选字段 | uid + {description: null} | description 已清除 |
| IC-U005 | 更新失败-事件不存在 | 不存在的 uid | 抛出 ICLOUD_EVENT_NOT_FOUND |
| IC-U006 | 更新失败-无权限 | 其他用户的 uid | 抛出 ICLOUD_PERMISSION_DENIED |

---

### 3.3 deleteEvent 删除事件

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-D001 | 删除存在的事件 | 存在的 uid | 删除成功 |
| IC-D002 | 删除不存在的事件 | 不存在的 uid | 抛出 ICLOUD_EVENT_NOT_FOUND |
| IC-D003 | 删除失败-已删除 | 已经被删除的 uid | 抛出 ICLOUD_EVENT_NOT_FOUND |

---

### 3.4 queryEvents 查询事件

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-Q001 | 查询指定日期范围 | startDate=05-01, endDate=05-31 | 返回该月所有事件 |
| IC-Q002 | 查询单日 | date=05-05 | 返回该日所有事件 |
| IC-Q003 | 查询无结果 | 日期范围内无事件 | 返回空数组 |
| IC-Q004 | 查询指定日历 | calendarId=工作日历ID | 仅返回该日历事件 |
| IC-Q005 | 不指定日历 | 无 calendarId | 返回所有日历事件 |
| IC-Q006 | 分页查询 | pageSize=10, page=2 | 返回第 11-20 条 |
| IC-Q007 | 循环事件展开 | 循环事件按规则展开 | 返回所有实例 |

**时间边界测试：**

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-Q008 | 跨年查询 | startDate=2025-12-30, endDate=2026-01-02 | 正确返回 |
| IC-Q009 | 查询开始大于结束 | startDate=05-31, endDate=05-01 | 抛出 VALIDATION_ERROR |
| IC-Q010 | 查询时间跨度1年 | startDate=2025-01-01, endDate=2025-12-31 | 返回所有事件 |

---

### 3.5 listCalendars 获取日历列表

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| IC-L001 | 获取所有日历 | 无 | 返回日历列表 |
| IC-L002 | 日历属性验证 | 返回的日历 | 包含 id, name, color |
| IC-L003 | 获取失败-认证失败 | 错误的认证信息 | 抛出 ICLOUD_AUTH_ERROR |

---

## 四、日程服务测试

### 4.1 syncToICalendar 同步到 iCloud

| 用例编号 | 用例名称 | 场景 | 预期结果 |
|---------|---------|------|---------|
| SY-E001 | 新任务同步 | 新建含 start_date 的任务，无 icloud_event_id | 创建 iCloud 事件，更新 icloud_event_id |
| SY-E002 | 更新后同步 | 已有 icloud_event_id 的任务被更新 | 更新 iCloud 事件 |
| SY-E003 | 已有事件更新 | 任务已有 icloud_event_id 且未变 | 更新现有 iCloud 事件 |
| SY-E004 | 同步失败-飞书有iCloud无 | 飞书有 icloud_event_id 但 iCloud 事件不存在 | 清除 icloud_event_id 或报错 |
| SY-E005 | 同步失败-iCloud创建失败 | iCloud API 返回错误 | 记录错误，不更新 icloud_event_id |
| SY-E006 | 无 start_date 不同步 | 任务无 start_date | 不调用 iCloud |
| SY-E007 | 清除 start_date | 任务原来有 start_date，更新后移除 | 删除 iCloud 事件 |

---

### 4.2 syncFromICalendar 从 iCloud 同步

| 用例编号 | 用例名称 | 场景 | 预期结果 |
|---------|---------|------|---------|
| SY-F001 | 完整同步 | iCloud 有 10 个事件，飞书无 | 创建 10 个飞书任务 |
| SY-F002 | 部分同步 | iCloud 有 5 个新事件，飞书有 5 个旧事件 | 创建 5 个新任务 |
| SY-F003 | 更新同步 | 同一事件在两边都有但内容不同 | 更新飞书任务 |
| SY-F004 | iCloud 删除同步 | iCloud 事件被删除 | 从飞书表格移除对应任务 |
| SY-F005 | 冲突处理-飞书新 | 飞书修改时间比 iCloud 新 | 以飞书为准 |
| SY-F006 | 冲突处理-iCloud新 | iCloud 修改时间比飞书新 | 以 iCloud 为准 |

---

## 五、ScheduleService CRUD 测试

### 5.1 createSchedule 创建日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| SC-C001 | 创建简单日程 | title, start_date, start_time | 创建成功，返回任务ID |
| SC-C002 | 创建全天日程 | 只有 start_date，无时间 | 创建成功 |
| SC-C003 | 创建循环日程 | 包含 recurrence_type 和 recurrence_rule | iCloud 事件带 RRULE |
| SC-C004 | 创建跨天日程 | start_time 和 end_time 跨天 | 正确处理 |
| SC-C005 | 创建失败-无标题 | title 为空 | 返回 VALIDATION_ERROR |
| SC-C006 | 创建失败-无开始时间 | 无 start_date 且无 start_time | 返回 VALIDATION_ERROR |
| SC-C007 | 创建失败-iCloud失败 | iCloud API 不可用 | 飞书任务创建成功，iCloud同步失败标记 |
| SC-C008 | 创建并指定分类 | category=个人 | 写入个人日历 |
| SC-C009 | 创建无分类 | 无 category | 使用默认日历 |

---

### 5.2 updateSchedule 更新日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| SC-U001 | 更新标题 | id, {title: "新标题"} | iCloud 事件同步更新 |
| SC-U002 | 更新时间 | id, {start_time, end_time} | iCloud 事件同步更新 |
| SC-U003 | 更新循环规则 | id, {recurrence_rule} | iCloud 事件同步更新 |
| SC-U004 | 更新分类 | id, {category: "个人"} | 移动到个人日历 |
| SC-U005 | 更新失败-不存在 | 不存在的 id | 返回 NOT_FOUND |
| SC-U006 | 清除可选字段 | id, {description: null} | iCloud description 清除 |
| SC-U007 | 取消循环 | id, {is_recurring: false, recurrence_type: "none"} | iCloud 循环规则移除 |

---

### 5.3 deleteSchedule 删除日程

| 用例编号 | 用例名称 | 场景 | 预期结果 |
|---------|---------|------|---------|
| SC-D001 | 删除有iCloud事件 | 任务有 icloud_event_id | 删除飞书任务 + iCloud 事件 |
| SC-D002 | 删除无iCloud事件 | 任务无 icloud_event_id | 仅删除飞书任务 |
| SC-D003 | 删除失败-不存在 | 不存在的 id | 返回 NOT_FOUND |
| SC-D004 | 删除失败-iCloud已删 | icloud_event_id 存在但 iCloud 事件已不存在 | 删除飞书任务，记录警告 |
| SC-D005 | 批量删除 | ids=[id1, id2, id3] | 全部删除成功 |

---

### 5.4 querySchedule 查询日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| SC-Q001 | 查询全部 | 无参数 | 返回所有含 start_date 的任务 |
| SC-Q002 | 按日期查询 | date=2026-05-05 | 返回该日所有日程 |
| SC-Q003 | 按日期范围查询 | start_date=05-01, end_date=05-31 | 返回该范围日程 |
| SC-Q004 | 按分类查询 | category=工作 | 返回工作类日程 |
| SC-Q005 | 按分类和日期组合 | category=工作, date=05-05 | 返回该日工作日程 |
| SC-Q006 | 按循环类型查询 | is_recurring=true | 返回所有循环日程 |
| SC-Q007 | 分页查询 | page=2, page_size=10 | 返回第 11-20 条 |
| SC-Q008 | 排序查询 | sort_by=start_date, sort_order=asc | 按开始日期升序 |
| SC-Q009 | 查询无结果 | date=2099-01-01 | 返回空数组 |
| SC-Q010 | 查询含时间范围 | start_time=09:00, end_time=18:00 | 仅返回该时间段内的日程 |

---

### 5.5 completeSchedule 完成日程

| 用例编号 | 用例名称 | 场景 | 预期结果 |
|---------|---------|------|---------|
| SC-CM001 | 完成循环日程 | 循环日程完成 | 创建下一个循环实例 |
| SC-CM002 | 完成普通日程 | 非循环日程完成 | 状态变为 completed |
| SC-CM003 | 完成并保持iCloud同步 | 循环日程 | iCloud 事件自动更新 |
| SC-CM004 | 完成失败-不存在 | 不存在的 id | 返回 NOT_FOUND |

---

## 六、API 路由测试

### 6.1 GET /api/events 查询日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| API-G001 | 查询所有日程 | GET /api/events | 返回 200 和日程列表 |
| API-G002 | 带分页参数 | GET /api/events?page=2&page_size=10 | 返回分页数据 |
| API-G003 | 带过滤参数 | GET /api/events?date=2026-05-05 | 返回过滤后数据 |
| API-G004 | 参数组合 | GET /api/events?category=工作&page=1 | 返回组合过滤数据 |
| API-G005 | 无数据 | GET /api/events?date=2099-01-01 | 返回空数组 |
| API-G006 | 无效参数 | GET /api/events?page=-1 | 返回 400 错误 |
| API-G007 | 未分类日程 | GET /api/events?category=未分类 | 返回空或带 null category 的日程 |

---

### 6.2 GET /api/events/:id 获取单个日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| API-GS001 | 获取存在的日程 | GET /api/events/{id} | 返回 200 和日程详情 |
| API-GS002 | 获取不存在的日程 | GET /api/events/not-exist-id | 返回 404 |
| API-GS003 | 获取含iCloud状态 | GET /api/events/{id} | 包含 icloud_sync_status |

---

### 6.3 POST /api/events 创建日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| API-C001 | 创建有效日程 | POST /api/events + 完整数据 | 返回 201 和创建的数据 |
| API-C002 | 创建最小日程 | POST /api/events + 最小数据 | 返回 201 |
| API-C003 | 创建循环日程 | POST /api/events + 循环数据 | iCloud 事件带循环规则 |
| API-C004 | 创建失败-无效数据 | POST /api/events + 无效数据 | 返回 400 和错误详情 |
| API-C005 | 创建失败-飞书错误 | 飞书 API 不可用 | 返回 500 |
| API-C006 | 创建失败-iCloud失败 | 飞书成功，iCloud 失败 | 返回 201 但 sync_status=error |

---

### 6.4 PUT /api/events/:id 更新日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| API-U001 | 更新存在日程 | PUT /api/events/{id} + 更新数据 | 返回 200 和更新后数据 |
| API-U002 | 更新不存在日程 | PUT /api/events/not-exist-id | 返回 404 |
| API-U003 | 部分更新 | PUT /api/events/{id} + 部分字段 | 仅更新指定字段 |
| API-U004 | 更新失败-无效数据 | PUT /api/events/{id} + 无效数据 | 返回 400 |
| API-U005 | 更新循环规则 | PUT /api/events/{id} + 新 RRULE | iCloud 事件同步更新 |

---

### 6.5 DELETE /api/events/:id 删除日程

| 用例编号 | 用例名称 | 输入 | 预期结果 |
|---------|---------|------|---------|
| API-D001 | 删除存在日程 | DELETE /api/events/{id} | 返回 200 |
| API-D002 | 删除不存在日程 | DELETE /api/events/not-exist-id | 返回 404 |
| API-D003 | 删除带iCloud同步 | DELETE /api/events/{id} 有 icloud_event_id | iCloud 事件同步删除 |
| API-D004 | 批量删除 | POST /api/events/batch-delete | 返回删除结果统计 |

---

### 6.6 POST /api/events/sync-from-icloud 全量同步

| 用例编号 | 用例名称 | 场景 | 预期结果 |
|---------|---------|------|---------|
| API-S001 | 首次同步 | iCloud 有数据，飞书为空 | 创建所有事件 |
| API-S002 | 增量同步 | 两边都有部分数据 | 创建新的，更新变化 |
| API-S003 | 同步失败-iCloud错误 | iCloud API 不可用 | 返回 500，记录错误 |
| API-S004 | 同步统计 | 同步完成 | 返回 created/updated/errors 统计 |
| API-S005 | 同步并解决冲突 | 同一事件在两边有不同版本 | 按规则解决冲突 |
| API-S006 | 同步空日历 | iCloud 日历为空 | 无操作，返回空统计 |

---

## 七、同步场景测试

### 7.1 创建时同步

| 用例编号 | 场景 | 飞书任务 | iCloud | 预期结果 |
|---------|------|---------|--------|---------|
| SY-C001 | 正常创建 | start_date=05-05 | 新建事件 | 事件创建成功 |
| SY-C002 | 创建无日期 | start_date=null | 无操作 | 飞书任务创建，无iCloud同步 |
| SY-C003 | 创建有日期无时间 | start_date=05-05 | 全天事件 | 创建全天事件 |
| SY-C004 | 创建失败-iCloud失败 | start_date=05-05 | API错误 | 飞书成功，iCloud标记error |
| SY-C005 | 创建循环任务 | start_date=05-05 + RRULE | 循环事件 | 创建循环事件 |

---

### 7.2 更新时同步

| 用例编号 | 场景 | 原值 | 更新值 | 预期结果 |
|---------|------|------|-------|---------|
| SY-UP001 | 更新时间 | start_time=09:00 | start_time=10:00 | iCloud 事件更新 |
| SY-UP002 | 添加循环 | is_recurring=false | is_recurring=true | iCloud 添加循环规则 |
| SY-UP003 | 移除循环 | is_recurring=true | is_recurring=false | iCloud 移除循环规则 |
| SY-UP004 | 改变分类 | category=工作 | category=个人 | iCloud 移动事件到新日历 |
| SY-UP005 | 添加开始时间 | start_date 存在，start_time=null | start_time=09:00 | iCloud 事件添加时间 |
| SY-UP006 | 移除开始时间 | start_date+start_time | start_time=null | iCloud 变为全天事件 |

---

### 7.3 删除时同步

| 用例编号 | 场景 | 任务状态 | 预期结果 |
|---------|------|---------|---------|
| SY-DL001 | 正常删除 | 有 icloud_event_id | 删除飞书+iCloud |
| SY-DL002 | 删除无iCloud | 无 icloud_event_id | 仅删除飞书 |
| SY-DL003 | iCloud已删 | icloud_event_id 存在，事件不存在 | 删除飞书，记录警告 |
| SY-DL004 | 批量删除 | 多个任务含不同状态 | 全部删除 |

---

## 八、错误处理测试

### 8.1 iCloud 错误

| 用例编号 | 错误场景 | 预期行为 |
|---------|---------|---------|
| ERR-IC001 | iCloud 认证失败 | 抛出 ICLOUD_AUTH_ERROR，HTTP 401 |
| ERR-IC002 | 日历不存在 | 抛出 ICLOUD_CALENDAR_NOT_FOUND，HTTP 404 |
| ERR-IC003 | 事件不存在 | 抛出 ICLOUD_EVENT_NOT_FOUND，HTTP 404 |
| ERR-IC004 | 网络超时 | 抛出 ICLOUD_NETWORK_ERROR，重试 3 次 |
| ERR-IC005 | 服务不可用 | 抛出 ICLOUD_SERVICE_UNAVAILABLE，HTTP 503 |
| ERR-IC006 | 限额超限 | 抛出 ICLOUD_RATE_LIMITED，HTTP 429 |

---

### 8.2 飞书错误

| 用例编号 | 错误场景 | 预期行为 |
|---------|---------|---------|
| ERR-FS001 | 飞书认证失败 | 抛出 FEISHU_AUTH_ERROR，HTTP 401 |
| ERR-FS002 | 记录不存在 | 抛出 FEISHU_RECORD_NOT_FOUND，HTTP 404 |
| ERR-FS003 | 飞书API限流 | 抛出 FEISHU_RATE_LIMITED，HTTP 429 |
| ERR-FS004 | 网络超时 | 抛出 FEISHU_NETWORK_ERROR |

---

### 8.3 数据验证错误

| 用例编号 | 错误场景 | 预期行为 |
|---------|---------|---------|
| ERR-V001 | 缺少必填字段 | 抛出 VALIDATION_ERROR，HTTP 400 |
| ERR-V002 | 字段格式错误 | 抛出 VALIDATION_ERROR |
| ERR-V003 | 日期格式错误 | 抛出 VALIDATION_ERROR，提示正确格式 |
| ERR-V004 | 时间格式错误 | 抛出 VALIDATION_ERROR |
| ERR-V005 | 无效的 RRULE | 抛出 VALIDATION_ERROR |

---

## 九、循环事件测试

### 9.1 每日循环

| 用例编号 | 输入 | 预期结果 |
|---------|------|---------|
| REC-D001 | FREQ=DAILY | 每天重复 |
| REC-D002 | FREQ=DAILY;COUNT=10 | 每天重复，共 10 次 |
| REC-D003 | FREQ=DAILY;UNTIL=20261231 | 每天重复，直到指定日期 |

---

### 9.2 每周循环

| 用例编号 | 输入 | 预期结果 |
|---------|------|---------|
| REC-W001 | FREQ=WEEKLY;BYDAY=MO | 每周一 |
| REC-W002 | FREQ=WEEKLY;BYDAY=TU,TH | 每周二、四 |
| REC-W003 | FREQ=WEEKLY;BYDAY=MO,WE,FR | 每周一、三、五 |
| REC-W004 | FREQ=WEEKLY;BYDAY=SA;BYSETPOS=1 | 每月第一个周六 |

---

### 9.3 每月循环

| 用例编号 | 输入 | 预期结果 |
|---------|------|---------|
| REC-M001 | FREQ=MONTHLY;BYMONTHDAY=15 | 每月 15 号 |
| REC-M002 | FREQ=MONTHLY;BYDAY=1TU | 每月第一个周二 |
| REC-M003 | FREQ=MONTHLY;BYDAY=-1FR | 每月最后一个周五 |

---

### 9.4 每年循环

| 用例编号 | 输入 | 预期结果 |
|---------|------|---------|
| REC-Y001 | FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15 | 每年 3 月 15 日 |
| REC-Y002 | FREQ=YEARLY;BYMONTH=1;BYDAY=1MO | 每年 1 月第一个周一 |

---

## 十、性能与边界测试

| 用例编号 | 测试场景 | 预期结果 |
|---------|---------|---------|
| PERF-001 | 一次同步 1000 个事件 | 在 60 秒内完成 |
| PERF-002 | 频繁同步 | 30分钟内同步 100 次 | 正确处理，无积压 |
| PERF-003 | 大循环规则 | RRULE 长度 500 字符 | 正确存储和解析 |
| PERF-004 | 长时间事件 | startTime=00:00, endTime=23:59 | 正确处理全天 |
| PERF-005 | 跨年事件 | startDate=2026-12-30, endDate=2027-01-02 | 正确拆分 |

---

## 十一、恢复与重试测试

| 用例编号 | 测试场景 | 预期结果 |
|---------|---------|---------|
| REC-001 | iCloud 临时不可用时创建 | 重试 3 次后失败，飞书任务保留 |
| REC-002 | 同步中断恢复 | 从中断点继续，不重复同步 |
| REC-003 | 幂等性测试 | 同一请求执行多次，结果一致 |
| REC-004 | 并发更新同一事件 | 最后一次更新生效，无数据损坏 |

---

## 十二、测试检查清单

### 12.1 iCloud 连接器

- [ ] createEvent - 基础创建
- [ ] createEvent - 完整字段
- [ ] createEvent - 循环事件
- [ ] createEvent - 跨天事件
- [ ] createEvent - 错误处理
- [ ] updateEvent - 基础更新
- [ ] updateEvent - 更新循环
- [ ] updateEvent - 错误处理
- [ ] deleteEvent - 基础删除
- [ ] deleteEvent - 错误处理
- [ ] queryEvents - 基础查询
- [ ] queryEvents - 日期范围
- [ ] queryEvents - 分页
- [ ] listCalendars - 基础列表

### 12.2 日程服务

- [ ] syncToICalendar - 新建同步
- [ ] syncToICalendar - 更新同步
- [ ] syncToICalendar - 不同步场景
- [ ] syncFromICalendar - 完整同步
- [ ] syncFromICalendar - 增量同步
- [ ] syncFromICalendar - 冲突处理

### 12.3 API 路由

- [ ] GET /api/events - 查询
- [ ] GET /api/events/:id - 获取单个
- [ ] POST /api/events - 创建
- [ ] PUT /api/events/:id - 更新
- [ ] DELETE /api/events/:id - 删除
- [ ] POST /api/events/sync-from-icloud - 全量同步

### 12.4 错误处理

- [ ] iCloud 认证错误
- [ ] iCloud 网络错误
- [ ] 飞书认证错误
- [ ] 数据验证错误
- [ ] 循环规则解析错误