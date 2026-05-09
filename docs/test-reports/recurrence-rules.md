# 循环任务规则说明

## 循环类型 (recurrence_type)

| 类型 | 说明 | 是否需要 recurrence_rule |
|------|------|--------------------------|
| none | 不循环 | 否 |
| daily | 每天 | 否 |
| weekly | 每周（同一天） | 否 |
| monthly | 每月（同一日期） | 否 |
| yearly | 每年（同一日期） | 否 |
| weekly_n | 每周N次（指定星期几） | **是** |
| monthly_n | 每月N次（指定第几个星期几） | **是** |
| yearly_n | 每年N次（指定月份和日期） | **是** |

---

## RRULE 格式说明

循环规则遵循 [iCalendar RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) 标准。

### 基本语法

```
RRULE:FREQ=<频率>;BYDAY=<星期>;BYMONTH=<月份>;BYMONTHDAY=<日期>
```

---

## 星期缩写对照表

| 中文 | 英文缩写 | RRULE 缩写 |
|------|----------|-----------|
| 星期日 | Sunday | SU |
| 星期一 | Monday | MO |
| 星期二 | Tuesday | TU |
| 星期三 | Wednesday | WE |
| 星期四 | Thursday | TH |
| 星期五 | Friday | FR |
| 星期六 | Saturday | SA |

---

## 常见场景示例

### 1. 每周固定几天

**场景**: 每周二、周四

```javascript
{
  recurrence_type: 'weekly_n',
  recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH'
}
```

**场景**: 每周一、三、五

```javascript
{
  recurrence_type: 'weekly_n',
  recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'
}
```

**场景**: 工作日（周一到周五）

```javascript
{
  recurrence_type: 'weekly_n',
  recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
}
```

**场景**: 周末（周六、日）

```javascript
{
  recurrence_type: 'weekly_n',
  recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=SA,SU'
}
```

---

### 2. 每月固定日期

**场景**: 每月15号

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15'
}
```

**场景**: 每月1号和15号

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15'
}
```

---

### 3. 每月第N个星期几

**场景**: 每月第一个周一

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYDAY=1MO'
}
```

**场景**: 每月第二个周三

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYDAY=2WE'
}
```

**场景**: 每月最后一个周五

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYDAY=-1FR'
}
```

**说明**: 
- `1MO` = 第1个周一
- `2WE` = 第2个周三
- `-1FR` = 最后一个周五

---

### 4. 每年固定日期

**场景**: 每年3月15日

```javascript
{
  recurrence_type: 'yearly_n',
  recurrence_rule: 'RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15'
}
```

**场景**: 每年生日（5月20日）

```javascript
{
  recurrence_type: 'yearly_n',
  recurrence_rule: 'RRULE:FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=20'
}
```

**场景**: 每年春节（农历正月初一，需要手动调整）

```javascript
{
  recurrence_type: 'yearly',  // 使用简单yearly，每年手动调整
  // 不填 recurrence_rule
}
```

---

## 完整创建示例

### 示例1: 每周二、周四开会

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const taskService = new TaskService();

async function test() {
  const result = await taskService.create({
    title: '团队会议',
    description: '每周二、周四上午10点开会',
    priority: 'high',
    category: '工作',
    start_date: '2026-05-06',  // 从哪天开始（周二）
    due_date: '2026-05-06',
    start_time: '10:00',
    end_time: '11:00',
    is_recurring: true,
    recurrence_type: 'weekly_n',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH'
  });
  
  console.log('创建结果:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
"
```

### 示例2: 每月第一个周一复盘

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const taskService = new TaskService();

async function test() {
  const result = await taskService.create({
    title: '月度复盘',
    priority: 'high',
    category: '工作',
    start_date: '2026-05-05',  // 5月第一个周一
    due_date: '2026-05-05',
    is_recurring: true,
    recurrence_type: 'monthly_n',
    recurrence_rule: 'RRULE:FREQ=MONTHLY;BYDAY=1MO'
  });
  
  console.log('创建结果:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
"
```

### 示例3: 每月15号交租金

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const taskService = new TaskService();

async function test() {
  const result = await taskService.create({
    title: '交租金',
    priority: 'high',
    category: '生活',
    due_date: '2026-05-15',
    is_recurring: true,
    recurrence_type: 'monthly_n',
    recurrence_rule: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15'
  });
  
  console.log('创建结果:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
"
```

---

## RRULE 参数完整列表

| 参数 | 说明 | 示例 |
|------|------|------|
| FREQ | 频率 | DAILY, WEEKLY, MONTHLY, YEARLY |
| BYDAY | 星期几 | MO, TU, WE, TH, FR, SA, SU |
| BYMONTHDAY | 月份中的第几天 | 1-31 |
| BYMONTH | 月份 | 1-12 |
| BYSETPOS | 第N个 | 1=第一个, -1=最后一个 |
| INTERVAL | 间隔 | 2=每隔一次 |
| COUNT | 重复次数 | 10=重复10次后停止 |
| UNTIL | 结束日期 | 20261231T235959Z |

---

## 在线 RRULE 生成器

如果不确定如何编写 RRULE，可以使用在线工具：

1. **iCalendar.org RRULE Tool**: https://icalendar.org/rrule-tool.html
2. **RRULE Generator**: https://jakubroztocil.github.io/rrule/

生成后复制 `RRULE:` 后面的部分即可。

---

## 验证 RRULE 是否正确

### 方法1: 查看任务完成后的下一次日期

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const taskService = new TaskService();

async function test() {
  // 1. 创建任务
  const createResult = await taskService.create({
    title: '测试任务',
    due_date: '2026-05-06',  // 周二
    is_recurring: true,
    recurrence_type: 'weekly_n',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH'
  });
  
  if (createResult.success) {
    const taskId = createResult.data.id;
    console.log('原任务due_date:', createResult.data.due_date);
    
    // 2. 完成任务
    const completeResult = await taskService.complete(taskId);
    
    // 3. 查询下一个任务
    const listResult = await taskService.list({ parent_id: taskId });
    if (listResult.data.items.length > 0) {
      console.log('下一次due_date:', listResult.data.items[0].due_date);
      console.log('预期: 2026-05-08（周四）');
    }
    
    // 清理
    await taskService.delete(taskId);
    for (const t of listResult.data.items) {
      await taskService.delete(t.id);
    }
  }
}

test().catch(console.error);
"
```

---

## 注意事项

1. **BYDAY 顺序**：RRULE 中 BYDAY 的顺序不影响结果，`TU,TH` 和 `TH,TU` 效果相同
2. **起始日期**：`start_date` 和 `due_date` 应该是符合循环规则的日期
   - 例如：weekly_n 的 BYDAY=TU,TH，则 start_date 应该是周二或周四
3. **月末日期**：BYMONTHDAY=31 在2月会自动调整为28/29号
4. **时区**：系统使用本地时间，不涉及时区转换
5. **完成后计算**：完成任务时会根据 RRULE 计算下一次日期

---

## 快速参考卡片

```
┌─────────────────────────────────────────────────────┐
│ 每周二、四      RRULE:FREQ=WEEKLY;BYDAY=TU,TH      │
│ 工作日          RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR │
│ 每月15号        RRULE:FREQ=MONTHLY;BYMONTHDAY=15   │
│ 每月第一个周一   RRULE:FREQ=MONTHLY;BYDAY=1MO      │
│ 每年3月15日     RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15 │
└─────────────────────────────────────────────────────┘
```
