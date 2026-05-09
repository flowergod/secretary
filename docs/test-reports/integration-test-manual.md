# 任务模块集成测试文档

本文档提供集成测试场景及其对应的命令行测试代码，使用真实飞书API。

## 测试环境

| 项目 | 值 |
|------|-----|
| 测试框架 | Jest |
| 测试文件 | `tests/integration/task-service.integration.test.ts` |
| 运行命令 | `npx jest tests/integration/task-service.integration.test.ts --verbose` |

## 相关文档

- [日历模块集成测试文档](calendar-integration-test-manual.md) - iCloud 日历同步相关测试

---

## 测试前准备

### 1. 停止已运行的服务器

如果端口3000被占用，先停止：

```bash
# Windows CMD
netstat -ano | findstr :3000
taskkill /F /PID <进程号>

# Git Bash
netstat -ano | grep :3000 | head -1
taskkill //F //PID <进程号>
```

### 2. 构建并启动服务器

```bash
cd C:\Users\AILJ\Documents\Astalavista\secretary
npm run build
npm start
```

### 3. 清空飞书表格

```bash
node -e "
const { feishuConnector } = require('./dist/connectors/feishu');
async function clearAll() {
  const result = await feishuConnector.list({ page_size: 100 });
  console.log('当前任务数:', result.total);
  if (result.items.length > 0) {
    const ids = result.items.map(t => t.id);
    console.log('正在删除...');
    const deleteResult = await feishuConnector.batchDelete(ids);
    console.log('删除结果: deleted=' + deleteResult.deleted + ', failed=' + deleteResult.failed);
    if (deleteResult.failed > 0) {
      console.log('错误:', deleteResult.errors.slice(0, 3));
    }
    const checkResult = await feishuConnector.list({ page_size: 100 });
    console.log('删除后剩余任务数:', checkResult.total);
  } else {
    console.log('表格已是空的');
  }
}
clearAll().catch(console.error);
"
```

---

## 重要说明

### 关于任务与日历的关系

**当任务包含 `start_date` 时，该任务同时也是日程，会自动同步至 iCloud 日历。**

日历分配规则：
| 分类 | iCloud 日历 |
|------|-------------|
| `工作` / `work` | 工作日历 |
| `个人` / `personal` | 个人日历 |
| `家庭共享` / `family` | 家庭日历 |
| 无分类 | **默认个人日历** |

详细说明请参考 [日历模块集成测试文档](calendar-integration-test-manual.md)。

### 关于任务删除

系统使用两种ID标识任务：

1. **任务ID** (`id`): 用户可见的ID，存储在飞书的"任务ID"字段中
2. **Record ID** (`record_id`): 飞书系统生成的内部ID，用于API操作

**删除任务的正确方式**：

- **推荐**: 使用 `taskService.delete(task.id)` - 会自动处理ID转换
- **直接调用**: 使用 `feishuConnector.delete(task.record_id)` - 必须传入 record_id

**批量删除**：

- `feishuConnector.batchDelete(ids)` 会自动获取每个任务的 record_id 并删除

---

## 测试场景

### 场景 1: 创建任务 - 必填字段

**测试用例**: 创建只包含必填字段的任务，验证默认值

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建必填字段任务
  const createResult = await taskService.create({ title: '集成测试-必填字段' });
  console.log('创建结果:', JSON.stringify(createResult, null, 2));
  
  // 验证默认值
  if (createResult.success) {
    console.log('id:', createResult.data.id);
    console.log('title:', createResult.data.title);
    console.log('status (应为pending):', createResult.data.status);
    console.log('priority (应为medium):', createResult.data.priority);
  }
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `success: true`
- `status: 'pending'`
- `priority: 'medium'`

---

### 场景 2: 创建任务 - 完整字段

**测试用例**: 创建包含所有字段的任务

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const createResult = await taskService.create({
    title: '集成测试-完整字段',
    description: '这是一个完整的集成测试任务',
    priority: 'high',
    category: '工作',
    due_date: '2026-05-10',
    start_date: '2026-05-01',
    start_time: '09:00',
    end_time: '10:00',
    is_recurring: true,
    recurrence_type: 'weekly',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
  });
  console.log('创建结果:', JSON.stringify(createResult, null, 2));
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
    console.log('已清理');
  }
}
test().catch(console.error);
"
```

**预期结果**: 所有字段正确保存并返回

---

### 场景 3: 创建任务 - 所有循环类型

**测试用例**: 创建8种不同循环类型的任务

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const types = ['none', 'daily', 'weekly', 'weekly_n', 'monthly', 'monthly_n', 'yearly', 'yearly_n'];
  
  for (const type of types) {
    const result = await taskService.create({
      title: '集成测试-循环类型-' + type,
      is_recurring: type !== 'none',
      recurrence_type: type,
    });
    console.log(type + ':', result.success ? '✅' : '❌', result.success ? '' : JSON.stringify(result.error));
    
    // 清理
    if (result.success) {
      await taskService.delete(result.data.id);
    }
  }
}
test().catch(console.error);
"
```

**预期结果**: 8种循环类型全部创建成功

---

### 场景 4: 获取任务

**测试用例**: 创建后通过ID获取任务

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建任务
  const createResult = await taskService.create({ title: '集成测试-GET' });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // 获取任务
  const getResult = await taskService.get(taskId);
  console.log('获取结果:', JSON.stringify(getResult, null, 2));
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `success: true`
- `id` 与创建时一致
- `title: '集成测试-GET'`

---

### 场景 5: 查询任务列表

**测试用例**: 分页查询和筛选

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const taskService = new TaskService();

async function test() {
  // 分页查询
  const result = await taskService.list({ page: 1, page_size: 10 });
  console.log('分页查询:', JSON.stringify(result.success ? {
    total: result.data.total,
    page: result.data.page,
    page_size: result.data.page_size,
    total_pages: result.data.total_pages,
    items_count: result.data.items.length
  } : result.error, null, 2));
}
test().catch(console.error);
"
```

---

### 场景 6: 更新任务

**测试用例**: 更新任务字段

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建任务
  const createResult = await taskService.create({ title: '更新前标题' });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // 更新标题
  const updateResult = await taskService.update(taskId, { title: '更新后标题' });
  console.log('更新结果:', JSON.stringify(updateResult, null, 2));
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**: `title` 变为 `'更新后标题'`

---

### 场景 7: 状态转换 - pending → in_progress

**测试用例**: 合法的状态转换

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建任务
  const createResult = await taskService.create({ title: '状态变更测试' });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // pending → in_progress
  const result = await taskService.transition(taskId, 'in_progress');
  console.log('状态转换结果:', JSON.stringify(result, null, 2));
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `success: true`
- `from_status: 'pending'`
- `to_status: 'in_progress'`

---

### 场景 8: 状态转换 - pending → completed (非法)

**测试用例**: 验证非法转换被拒绝

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建任务
  const createResult = await taskService.create({ title: '状态变更测试-非法' });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // pending → completed (非法，应被拒绝)
  const result = await taskService.transition(taskId, 'completed');
  console.log('非法转换结果:', JSON.stringify(result, null, 2));
  console.log('应被拒绝:', !result.success ? '✅' : '❌');
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `success: false`
- `error.code: 2005` (TASK_INVALID_TRANSITION)

---

### 场景 9: 完成任务 - 非循环任务

**测试用例**: 非循环任务完成后不创建新任务

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建非循环任务
  const createResult = await taskService.create({
    title: '完成普通任务',
    is_recurring: false,
    recurrence_type: 'none',
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // 完成任务
  const result = await taskService.complete(taskId);
  console.log('完成结果:', JSON.stringify(result, null, 2));
  
  // 验证状态
  if (result.success) {
    const getResult = await taskService.get(taskId);
    console.log('完成后状态:', getResult.data.status);
  }
  
  // 清理
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**:
- `status: 'completed'`
- 不创建新任务

---

### 场景 10: 完成任务 - 循环任务 (daily)

**测试用例**: 完成每日循环任务后创建下一个

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建每日循环任务
  const createResult = await taskService.create({
    title: '每日循环任务',
    is_recurring: true,
    recurrence_type: 'daily',
    due_date: '2026-05-04',
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  console.log('原任务ID:', taskId);
  console.log('原任务due_date:', createResult.success ? createResult.data.due_date : 'N/A');
  
  // 完成任务
  const result = await taskService.complete(taskId);
  console.log('完成结果:', result.success ? '成功' : '失败');
  
  // 查询子任务
  if (result.success) {
    const listResult = await taskService.list({ parent_id: taskId });
    console.log('子任务数量:', listResult.data.items.length);
    if (listResult.data.items.length > 0) {
      console.log('子任务ID:', listResult.data.items[0].id);
      console.log('子任务due_date:', listResult.data.items[0].due_date);
    }
  }
  
  // 清理 (包括子任务)
  const listResult = await taskService.list({ parent_id: taskId });
  for (const t of listResult.data.items) {
    await taskService.delete(t.id);
  }
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

**预期结果**:
- 创建新的每日循环任务
- 新任务的 `due_date` 应为 `2026-05-05` (+1天)
- 新任务的 `parent_id` 指向原任务

---

### 场景 11: 完成任务 - 循环任务 (weekly)

**测试用例**: 完成每周循环任务后创建下一个

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const createResult = await taskService.create({
    title: '每周循环任务',
    is_recurring: true,
    recurrence_type: 'weekly',
    due_date: '2026-05-04',
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  console.log('原任务due_date:', createResult.success ? createResult.data.due_date : 'N/A');
  
  const result = await taskService.complete(taskId);
  console.log('完成结果:', result.success ? '成功' : '失败');
  
  if (result.success) {
    const listResult = await taskService.list({ parent_id: taskId });
    console.log('子任务数量:', listResult.data.items.length);
    if (listResult.data.items.length > 0) {
      console.log('子任务due_date:', listResult.data.items[0].due_date);
      console.log('应为2026-05-11 (+7天)');
    }
  }
  
  // 清理
  const listResult = await taskService.list({ parent_id: taskId });
  for (const t of listResult.data.items) {
    await taskService.delete(t.id);
  }
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

---

### 场景 12: 完成任务 - 循环任务 (monthly)

**测试用例**: 完成每月循环任务后创建下一个

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const createResult = await taskService.create({
    title: '每月循环任务',
    is_recurring: true,
    recurrence_type: 'monthly',
    due_date: '2026-05-04',
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  console.log('原任务due_date:', createResult.success ? createResult.data.due_date : 'N/A');
  
  const result = await taskService.complete(taskId);
  
  if (result.success) {
    const listResult = await taskService.list({ parent_id: taskId });
    console.log('子任务due_date:', listResult.data.items[0]?.due_date);
    console.log('应为2026-06-04 (+1月)');
  }
  
  // 清理
  const listResult = await taskService.list({ parent_id: taskId });
  for (const t of listResult.data.items) {
    await taskService.delete(t.id);
  }
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

---

### 场景 13: 完成任务 - 循环任务 (yearly)

**测试用例**: 完成每年循环任务后创建下一个

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const createResult = await taskService.create({
    title: '每年循环任务',
    is_recurring: true,
    recurrence_type: 'yearly',
    due_date: '2026-05-04',
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  console.log('原任务due_date:', createResult.success ? createResult.data.due_date : 'N/A');
  
  const result = await taskService.complete(taskId);
  
  if (result.success) {
    const listResult = await taskService.list({ parent_id: taskId });
    console.log('子任务due_date:', listResult.data.items[0]?.due_date);
    console.log('应为2027-05-04 (+1年)');
  }
  
  // 清理
  const listResult = await taskService.list({ parent_id: taskId });
  for (const t of listResult.data.items) {
    await taskService.delete(t.id);
  }
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

---

### 场景 14: 完成任务 - 循环任务 (weekly_n)

**测试用例**: 完成每周N次循环任务，解析RRULE

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  const createResult = await taskService.create({
    title: '每周N次循环任务',
    is_recurring: true,
    recurrence_type: 'weekly_n',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
    due_date: '2026-05-04', // 星期一
  });
  const taskId = createResult.success ? createResult.data.id : '';
  
  console.log('原任务due_date:', createResult.success ? createResult.data.due_date : 'N/A');
  console.log('原任务是MO，下一个应该是WE (2026-05-06)');
  
  const result = await taskService.complete(taskId);
  
  if (result.success) {
    const listResult = await taskService.list({ parent_id: taskId });
    console.log('子任务due_date:', listResult.data.items[0]?.due_date);
  }
  
  // 清理
  const listResult = await taskService.list({ parent_id: taskId });
  for (const t of listResult.data.items) {
    await taskService.delete(t.id);
  }
  if (createResult.success) {
    await taskService.delete(createResult.data.id);
  }
}
test().catch(console.error);
"
```

---

### 场景 15: 父子任务关系

**测试用例**: 创建父子任务，验证ID链

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');

async function test() {
  // 创建父任务
  const parentTask = {
    title: '父任务-项目策划',
    description: '完整字段测试',
    priority: 'high',
    category: '工作',
    due_date: '2026-06-30',
    start_date: '2026-06-01',
    is_recurring: true,
    recurrence_type: 'weekly',
    recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
  };
  const parentResult = await feishuConnector.create(parentTask);
  console.log('父任务ID:', parentResult.id);
  
  // 创建子任务
  const childTask = {
    title: '子任务-项目策划-第一周',
    description: '继承父任务属性',
    priority: 'high',
    category: '工作',
    due_date: '2026-06-08',
    is_recurring: true,
    recurrence_type: 'weekly',
    parent_id: parentResult.id, // 指向父任务
  };
  const childResult = await feishuConnector.create(childTask);
  console.log('子任务ID:', childResult.id);
  console.log('子任务的parent_id:', childResult.parent_id);
  console.log('匹配?', childResult.parent_id === parentResult.id ? '✅ 是' : '❌ 否');
  
  // 清理
  if (childResult.record_id) await feishuConnector.delete(childResult.record_id);
  if (parentResult.record_id) await feishuConnector.delete(parentResult.record_id);
}
test().catch(console.error);
"
```

**预期结果**:
- 父任务 `id` 与子任务 `parent_id` 匹配

---

### 场景 16: 删除任务

**测试用例**: 删除任务后验证不存在

```bash
node -e "
const { TaskService } = require('./dist/services/task-service');
const { feishuConnector } = require('./dist/connectors/feishu');
const taskService = new TaskService();

async function test() {
  // 创建任务
  const createResult = await taskService.create({ title: '待删除任务' });
  const taskId = createResult.success ? createResult.data.id : '';
  
  // 删除任务
  const deleteResult = await taskService.delete(taskId);
  console.log('删除结果:', JSON.stringify(deleteResult, null, 2));
  
  // 验证已删除
  const getResult = await taskService.get(taskId);
  console.log('验证删除后:', getResult.success ? '❌ 还存在' : '✅ 已删除');
}
test().catch(console.error);
"
```

**预期结果**:
- `success: true`
- `deleted: 1`
- 再次查询返回 `success: false`

---

## 循环任务日期计算规则

| 循环类型 | 计算方式 | 示例 |
|----------|----------|------|
| daily | +1天 | 2026-05-04 → 2026-05-05 |
| weekly | +7天 | 2026-05-04 → 2026-05-11 |
| monthly | +1月 | 2026-05-04 → 2026-06-04 |
| yearly | +1年 | 2026-05-04 → 2027-05-04 |
| weekly_n | 解析RRULE BYDAY | MO,WE,FR → 找下一个匹配日 |
| monthly_n | 解析RRULE | BYDAY+BYSETPOS 或 BYMONTHDAY |
| yearly_n | 解析RRULE | BYMONTH+BYMONTHDAY |

---

## 状态转换规则

| 从状态 | 可转换到 | 说明 |
|--------|----------|------|
| pending | in_progress, cancelled | 可开始或取消 |
| in_progress | pending, cancelled | 可暂停或取消 |
| completed | *(不可转换)* | 需使用 complete 接口 |
| cancelled | pending | 可重新激活 |

---

## 运行所有集成测试

```bash
cd C:\Users\AILJ\Documents\Astalavista\secretary
npx jest tests/integration/task-service.integration.test.ts --verbose
```