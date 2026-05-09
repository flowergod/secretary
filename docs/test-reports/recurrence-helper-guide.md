# 循环规则助手使用指南

## 方案1: 使用自然语言助手（推荐）

### 安装使用

```bash
# 1. 构建项目
npm run build

# 2. 运行助手
npx ts-node scripts/create-recurring-task.ts
```

### 支持的自然语言

| 输入 | 识别结果 |
|------|---------|
| 不循环 | 一次性任务 |
| 每天 | 每天循环 |
| 每周 | 每周循环（同一天） |
| 每周二四 | 每周二、周四 |
| 每周一三五 | 每周一、三、五 |
| 工作日 | 周一到周五 |
| 周末 | 周六、周日 |
| 每月15号 | 每月15日 |
| 每月第一个周一 | 每月第1个周一 |
| 每月最后一个周五 | 每月最后一个周五 |
| 每年3月15日 | 每年3月15日 |

### 示例对话

```
=== 循环任务创建助手 ===

任务名称: 健身
任务描述（可选，按回车跳过）: 去健身房锻炼

优先级: 1-高 2-中 3-低
选择优先级（默认2-中）: 2

分类（如：工作/生活/学习，可选）: 生活

循环规则示例:
  - 不循环
  - 每天
  - 每周二四
  - 工作日
  - 每月15号
  - 每月第一个周一
  - 每年3月15日

请输入循环规则: 每周二四
识别为: 每周周二、周四

截止日期（格式: 2026-05-10，可选）: 2026-05-06
开始日期（格式: 2026-05-10，可选）: 2026-05-06
开始时间（格式: 09:00，可选）: 18:00
结束时间（格式: 10:00，可选）: 19:30

=== 任务预览 ===
标题: 健身
描述: 去健身房锻炼
优先级: medium
分类: 生活
循环: 每周周二、周四
截止日期: 2026-05-06
开始日期: 2026-05-06
开始时间: 18:00
结束时间: 19:30

确认创建？(y/n): y

✅ 任务创建成功！
ID: xxx-xxx-xxx
```

---

## 方案2: 在代码中使用助手

```javascript
const { parseRecurrence } = require('./dist/shared/recurrence-helper');
const { taskService } = require('./dist/services/task-service');

async function createTask() {
  // 解析自然语言
  const recurrence = parseRecurrence('每周二四');
  
  // 创建任务
  const result = await taskService.create({
    title: '健身',
    priority: 'medium',
    category: '生活',
    due_date: '2026-05-06',
    start_time: '18:00',
    end_time: '19:30',
    ...recurrence,  // 自动填充 recurrence_type, recurrence_rule, is_recurring
  });
  
  console.log('创建结果:', result);
}

createTask();
```

---

## 方案3: 使用在线工具

如果需要更复杂的规则，可以使用在线 RRULE 生成器：

1. **iCalendar.org RRULE Tool**  
   https://icalendar.org/rrule-tool.html

2. **RRULE Generator**  
   https://jakubroztocil.github.io/rrule/

使用步骤：
1. 在网站上选择循环规则
2. 复制生成的 RRULE（例如：`RRULE:FREQ=WEEKLY;BYDAY=TU,TH`）
3. 填入任务的 `recurrence_rule` 字段

---

## 方案4: 常用模板

### 模板1: 每周固定几天

```javascript
{
  recurrence_type: 'weekly_n',
  recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',  // 修改这里的星期
  is_recurring: true
}
```

### 模板2: 每月固定日期

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15',  // 修改这里的日期
  is_recurring: true
}
```

### 模板3: 每月第N个星期几

```javascript
{
  recurrence_type: 'monthly_n',
  recurrence_rule: 'RRULE:FREQ=MONTHLY;BYDAY=1MO',  // 修改这里的数字和星期
  is_recurring: true
}
```

---

## 测试循环规则助手

运行测试验证所有功能：

```bash
npm test -- recurrence-helper.test.ts
```

预期输出：
```
 PASS  tests/recurrence-helper.test.ts
  RecurrenceHelper
    parseRecurrence - 解析自然语言
      ✓ 应该解析"不循环"
      ✓ 应该解析"每天"
      ✓ 应该解析"每周"
      ✓ 应该解析"每周二四"
      ✓ 应该解析"工作日"
      ✓ 应该解析"每月15号"
      ✓ 应该解析"每月第一个周一"
      ✓ 应该解析"每年3月15日"
    describeRecurrence - 生成中文描述
      ✓ 应该描述每周二四
      ✓ 应该描述每月15号
```

---

## 常见问题

### Q: 能识别哪些格式？

A: 目前支持：
- 周几：周一、星期一、一
- 序数：第一、第1、最后
- 多个日期：每周二四、每周一三五

### Q: 如果识别错误怎么办？

A: 助手会在控制台显示识别结果，创建前可以确认。如果识别错误，输入 `n` 取消，然后换个说法重试。

### Q: 支持更复杂的规则吗？

A: 对于特别复杂的规则（例如"每隔2周的周二"），建议使用在线工具生成 RRULE。

### Q: 可以修改助手吗？

A: 可以！编辑 `src/shared/recurrence-helper.ts` 添加更多匹配规则。

---

## 快速参考

```bash
# 创建任务（交互式）
npx ts-node scripts/create-recurring-task.ts

# 在代码中使用
const { parseRecurrence } = require('./dist/shared/recurrence-helper');
const config = parseRecurrence('每周二四');
```
