# 日历模块集成测试文档

本文档提供日历模块（iCloud 同步）的集成测试场景及其对应的命令行测试代码。

## 测试环境

| 项目 | 值 |
|------|-----|
| 测试框架 | Jest |
| 测试文件 | `tests/integration/task-service.integration.test.ts` |
| 日历配置 | `config.yaml` 中的 `icloud.calendarMapping` |

---

## 核心概念

### 日历与任务的关联

**规则**: 当任务包含 `start_date` 字段时，该任务视为**日程事件**，需同步至 iCloud 日历。

```
任务 (有 start_date) ──同步──→ iCloud 日历事件
```

### 日历分配规则

根据任务的 `category` 字段，决定同步到哪个 iCloud 日历：

| category | iCloud 日历 ID | 说明 |
|----------|----------------|------|
| `工作` / `work` | `D03AAE8F-D142-42CF-8FF2-BA7AB2E83092` | 工作日历 |
| `个人` / `personal` | `F7D25790-4368-447C-96FF-4F7FE022AE1C` | 个人日历 |
| `家庭共享` / `family` | `family-new` | 家庭日历 |
| 无分类 / 空 | `F7D25790-4368-447C-96FF-4F7FE022AE1C` | **默认使用个人日历** |

---

## 测试前准备

### 1. 验证日历配置

```bash
node -e "
const { icloudConnector } = require('./dist/connectors/icloud');
console.log('日历配置:');
console.log(JSON.stringify(icloudConnector.calendarMapping, null, 2));
console.log('\\n测试查找:');
console.log('工作 ->', icloudConnector.getCalendarIdByCategory('工作'));
console.log('个人 ->', icloudConnector.getCalendarIdByCategory('个人'));
console.log('无分类 ->', icloudConnector.getCalendarIdByCategory(undefined));
"
```

**预期输出**:
```json
{
  "工作": "D03AAE8F-D142-42CF-8FF2-BA7AB2E83092",
  "个人": "F7D25790-4368-447C-96FF-4F7FE022AE1C",
  "家庭共享": "family-new"
}

工作 -> D03AAE8F-D142-42CF-8FF2-BA7AB2E83092
个人 -> F7D25790-4368-447C-96FF-4F7FE022AE1C
无分类 -> F7D25790-4368-447C-96FF-4F7FE022AE1C
```

---

## 测试场景

### 场景 1: 创建日程事件 - 工作分类

**测试用例**: 创建带 `start_date` 的工作分类任务，验证日历分配

```bash
node -e "
const { taskService } = require('./dist/services');
const { icloudConnector } = require('./dist/connectors/icloud');

async function test() {
  console.log('=== 场景1: 创建工作分类日程 ===');

  // 创建带 start_date 的工作分类任务
  const result = await taskService.create({
    title: '集成测试-工作日程',
    start_date: '2026-05-10',
    start_time: '14:00',
    end_time: '15:00',
    category: '工作',
    description: '这是一项工作日程',
  });

  console.log('创建结果:', result.success ? '✅ 成功' : '❌ 失败');
  if (result.success) {
    console.log('任务ID:', result.data.id);
    console.log('iCloud Event ID:', result.data.icloud_event_id || '(未同步)');
    console.log('分配日历ID:', icloudConnector.getCalendarIdByCategory('工作'));

    // 清理
    await taskService.delete(result.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `icloud_event_id` 存在（如果 iCloud 连接正常）
- 日历分配到工作日历

---

### 场景 2: 创建日程事件 - 个人分类

**测试用例**: 创建个人分类日程，验证分配到个人日历

```bash
node -e "
const { taskService } = require('./dist/services');
const { icloudConnector } = require('./dist/connectors/icloud');

async function test() {
  console.log('=== 场景2: 创建个人分类日程 ===');

  const result = await taskService.create({
    title: '集成测试-个人日程',
    start_date: '2026-05-12',
    start_time: '19:00',
    end_time: '21:00',
    category: '个人',
  });

  console.log('创建结果:', result.success ? '✅ 成功' : '❌ 失败');
  if (result.success) {
    console.log('任务ID:', result.data.id);
    console.log('分配日历ID:', icloudConnector.getCalendarIdByCategory('个人'));

    // 清理
    await taskService.delete(result.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

---

### 场景 3: 创建日程事件 - 无分类（默认个人日历）

**测试用例**: 不指定 category，验证默认使用个人日历

```bash
node -e "
const { taskService } = require('./dist/services');
const { icloudConnector } = require('./dist/connectors/icloud');

async function test() {
  console.log('=== 场景3: 无分类日程(默认个人日历) ===');

  const result = await taskService.create({
    title: '集成测试-无分类日程',
    start_date: '2026-05-15',
    start_time: '10:00',
    category: undefined, // 不指定分类
  });

  console.log('创建结果:', result.success ? '✅ 成功' : '❌ 失败');
  if (result.success) {
    console.log('默认日历ID:', icloudConnector.getCalendarIdByCategory(undefined));

    // 清理
    await taskService.delete(result.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

---

### 场景 4: 创建日程事件 - 带循环规则

**测试用例**: 创建每周重复的日程

```bash
node -e "
const { taskService } = require('./dist/services');

async function test() {
  console.log('=== 场景4: 创建循环日程 ===');

  const result = await taskService.create({
    title: '集成测试-每周例会',
    start_date: '2026-05-11',
    start_time: '09:00',
    end_time: '10:00',
    category: '工作',
    is_recurring: true,
    recurrence_type: 'weekly',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
  });

  console.log('创建结果:', result.success ? '✅ 成功' : '❌ 失败');
  if (result.success) {
    console.log('任务ID:', result.data.id);
    console.log('循环类型:', result.data.recurrence_type);
    console.log('循环规则:', result.data.recurrence_rule);

    // 清理
    await taskService.delete(result.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

---

### 场景 5: 查询日程列表

**测试用例**: 查询所有含有 `start_date` 的任务（日程）

```bash
node -e "
const { scheduleService } = require('./dist/services');

async function test() {
  console.log('=== 场景5: 查询日程列表 ===');

  const result = await scheduleService.querySchedules({
    page: 1,
    pageSize: 10,
  });

  console.log('总日程数:', result.total);
  console.log('返回日程数:', result.items.length);

  result.items.slice(0, 5).forEach((item, i) => {
    console.log(\`  \${i+1}. \${item.title} | \${item.start_date} \${item.start_time || ''} | \${item.category || '无分类'}\`);
  });
}
test().catch(console.error);
"
```

---

### 场景 6: 按日期查询日程

**测试用例**: 查询特定日期的日程

```bash
node -e "
const { scheduleService } = require('./dist/services');

async function test() {
  console.log('=== 场景6: 按日期查询日程 ===');

  // 查询 2026-05-05 的日程
  const result = await scheduleService.querySchedules({
    date: '2026-05-05',
  });

  console.log('2026-05-05 日程数:', result.items.length);
  result.items.forEach((item, i) => {
    console.log(\`  \${i+1}. \${item.title} | \${item.start_date} \${item.start_time || ''}\`);
  });
}
test().catch(console.error);
"
```

---

### 场景 7: 按分类查询日程

**测试用例**: 只查询工作分类的日程

```bash
node -e "
const { scheduleService } = require('./dist/services');

async function test() {
  console.log('=== 场景7: 按分类查询日程 ===');

  const result = await scheduleService.querySchedules({
    category: '工作',
  });

  console.log('工作分类日程数:', result.items.length);
  result.items.forEach((item, i) => {
    console.log(\`  \${i+1}. \${item.title} | \${item.start_date} | \${item.category}\`);
  });
}
test().catch(console.error);
"
```

---

### 场景 8: 获取单个日程

**测试用例**: 通过 ID 获取日程详情

```bash
node -e "
const { taskService } = require('./dist/services');

async function test() {
  console.log('=== 场景8: 获取单个日程 ===');

  // 先创建一个日程
  const createResult = await taskService.create({
    title: '集成测试-待获取日程',
    start_date: '2026-05-20',
    start_time: '14:00',
    category: '工作',
  });

  if (createResult.success) {
    const taskId = createResult.data.id;
    console.log('创建的任务ID:', taskId);

    // 获取日程
    const getResult = await taskService.get(taskId);
    console.log('获取结果:', getResult.success ? '✅ 成功' : '❌ 失败');
    if (getResult.success) {
      console.log('  标题:', getResult.data.title);
      console.log('  开始日期:', getResult.data.start_date);
      console.log('  开始时间:', getResult.data.start_time);
      console.log('  分类:', getResult.data.category);
      console.log('  iCloud Event ID:', getResult.data.icloud_event_id || '(无)');
    }

    // 清理
    await taskService.delete(taskId);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

---

### 场景 9: 更新日程

**测试用例**: 更新日程的时间和信息

```bash
node -e "
const { taskService } = require('./dist/services');

async function test() {
  console.log('=== 场景9: 更新日程 ===');

  // 先创建
  const createResult = await taskService.create({
    title: '集成测试-待更新日程',
    start_date: '2026-05-25',
    start_time: '10:00',
    category: '个人',
  });

  if (createResult.success) {
    const taskId = createResult.data.id;
    console.log('原标题:', createResult.data.title);
    console.log('原时间:', createResult.data.start_date, createResult.data.start_time);

    // 更新
    const updateResult = await taskService.update(taskId, {
      title: '已更新-集成测试日程',
      start_date: '2026-05-26',
      start_time: '15:00',
    });

    console.log('更新结果:', updateResult.success ? '✅ 成功' : '❌ 失败');
    if (updateResult.success) {
      console.log('新标题:', updateResult.data.title);
      console.log('新时间:', updateResult.data.start_date, updateResult.data.start_time);
    }

    // 清理
    await taskService.delete(taskId);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

---

### 场景 10: 删除日程

**测试用例**: 删除日程（同时删除 iCloud 事件）

```bash
node -e "
const { taskService } = require('./dist/services');

async function test() {
  console.log('=== 场景10: 删除日程 ===');

  // 先创建
  const createResult = await taskService.create({
    title: '集成测试-待删除日程',
    start_date: '2026-05-30',
    start_time: '16:00',
    category: '工作',
  });

  if (createResult.success) {
    const taskId = createResult.data.id;
    console.log('任务ID:', taskId);
    console.log('iCloud Event ID:', createResult.data.icloud_event_id || '(无)');

    // 删除
    const deleteResult = await taskService.delete(taskId);
    console.log('删除结果:', deleteResult.success ? '✅ 成功' : '❌ 失败');

    // 验证已删除
    const getResult = await taskService.get(taskId);
    console.log('验证:', getResult.success ? '❌ 仍存在' : '✅ 已删除');
  }
}
test().catch(console.error);
"
```

---

### 场景 11: API 路由测试 - GET /api/events

**测试用例**: 通过 HTTP API 查询日程

```bash
# 确保服务器已启动 (npm start)
# 然后在另一个终端执行:

curl http://localhost:3000/api/events
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "xxx",
        "title": "日程标题",
        "start_date": "2026-05-10",
        "start_time": "14:00",
        "category": "工作",
        "icloud_sync_status": "synced"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 场景 12: API 路由测试 - POST /api/events

**测试用例**: 通过 HTTP API 创建日程

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API创建日程",
    "start_date": "2026-06-01",
    "start_time": "10:00",
    "category": "工作"
  }'
```

---

### 场景 13: API 路由测试 - 按日期筛选

**测试用例**: 查询特定日期的日程

```bash
curl "http://localhost:3000/api/events?date=2026-05-10"
```

---

## 日历分配验证脚本

验证所有分类的日历分配：

```bash
node -e "
const { icloudConnector } = require('./dist/connectors/icloud');

console.log('=== 日历分配验证 ===\\n');

const testCases = [
  { category: '工作', expected: 'D03AAE8F-D142-42CF-8FF2-BA7AB2E83092' },
  { category: '个人', expected: 'F7D25790-4368-447C-96FF-4F7FE022AE1C' },
  { category: '家庭共享', expected: 'family-new' },
  { category: 'work', expected: 'D03AAE8F-D142-42CF-8FF2-BA7AB2E83092' },
  { category: 'personal', expected: 'F7D25790-4368-447C-96FF-4F7FE022AE1C' },
  { category: 'family', expected: 'family-new' },
  { category: undefined, expected: 'F7D25790-4368-447C-96FF-4F7FE022AE1C' },
  { category: '', expected: 'F7D25790-4368-447C-96FF-4F7FE022AE1C' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ category, expected }) => {
  const result = icloudConnector.getCalendarIdByCategory(category);
  const status = result === expected ? '✅' : '❌';
  if (result === expected) passed++; else failed++;
  console.log(status, 'category:', JSON.stringify(category) || '(空)', '->', result);
});

console.log(\`\\n结果: \${passed} 通过, \${failed} 失败\`);
"
```

---

## iCloud 连接测试

### 测试 iCloud 凭证有效性

```bash
node -e "
const { icloudConnector } = require('./dist/connectors/icloud');

async function test() {
  console.log('=== iCloud 凭证验证 ===');
  const isValid = await icloudConnector.validateCredentials();
  console.log('凭证有效:', isValid ? '✅' : '❌');
}
test().catch(e => console.error('错误:', e.message));
"
```

### 查询 iCloud 日历列表

```bash
node -e "
const { icloudConnector } = require('./dist/connectors/icloud');

async function test() {
  console.log('=== 查询 iCloud 日历列表 ===');
  try {
    const calendars = await icloudConnector.listCalendars();
    console.log('日历数:', calendars.length);
    calendars.forEach((cal, i) => {
      console.log(\`  \${i+1}. \${cal.id} - \${cal.name}\`);
    });
  } catch (e) {
    console.error('错误:', e.message);
  }
}
test().catch(console.error);
"
```

---

## 运行所有日历相关测试

```bash
cd C:\Users\AILJ\Documents\Astalavista\secretary
npm run build

# 运行单元测试
npx jest tests/unit/icloud-connector.test.ts --verbose

# 运行集成测试
npx jest tests/integration/task-service.integration.test.ts --verbose
```

---

## 测试结果记录

| 测试日期 | 单元测试 | 集成测试 | iCloud 连接 | 备注 |
|----------|----------|----------|-------------|------|
| 2026-05-05 | 27/27 ✅ | 28/28 ✅ | 待验证 | 配置已修复 |