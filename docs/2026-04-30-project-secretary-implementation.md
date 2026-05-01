# Project Secretary 开发测试方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Project Secretary 双平台项目管理 AI 助理的核心功能开发和测试

**Architecture:** 采用分层架构，核心业务逻辑（自然语言解析、Connector、调度器）共用，平台适配层（OpenClaw SOUL.md/AGENTS.md、Claude Code SKILL.md）分离。AI 调用使用双链路设计，主链路火山方舟、备链路 MiniMax。

**Tech Stack:** TypeScript, Node.js, 飞书开放API, iCloud CalDAV API, 火山方舟API, MiniMax API

---

## 已完成模块

| 模块 | 状态 | 文件 |
|------|------|------|
| 自然语言解析引擎 | ✓ | `src/parser/nl-parser.ts` |
| 飞书表格连接器 | ✓ | `src/connectors/feishu.ts` |
| iCloud日历连接器 | ✓ | `src/connectors/icloud.ts` |
| 主动提醒调度器 | ✓ | `src/scheduler/reminder.ts` |
| 上下文管理 | ✓ | `src/memory/context.ts` |
| 共享工具 | ✓ | `src/shared/{types,config,retry}.ts` |
| 类型定义 | ✓ | `src/shared/types.ts` |
| 重试机制 | ✓ | `src/shared/retry.ts` |
| 配置管理 | ✓ | `src/shared/config.ts` |

---

## 待开发模块

### Phase 1: AI 模型调用层

#### Task 1: AI 模型双链路调用模块

**Files:**
- Create: `secretary/src/ai/client.ts` - AI 模型客户端封装
- Create: `secretary/src/ai/volcano.ts` - 火山方舟 API 实现
- Create: `secretary/src/ai/minimax.ts` - MiniMax API 实现
- Create: `secretary/src/ai/router.ts` - 双链路路由逻辑
- Create: `secretary/tests/ai/client.test.ts` - 单元测试

- [ ] **Step 1: 创建 AI 客户端接口定义**

```typescript
// secretary/src/ai/client.ts
export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export abstract class AIProvider {
  abstract chat(request: AIRequest): Promise<AIResponse>;
  abstract name(): string;
}
```

- [ ] **Step 2: 实现火山方舟 Provider**

```typescript
// secretary/src/ai/volcano.ts
import { AIProvider, AIRequest, AIResponse } from './client';
import { configManager } from '../shared/config';

export class VolcanoProvider extends AIProvider {
  name() { return 'volcano'; }

  async chat(request: AIRequest): Promise<AIResponse> {
    const config = configManager.get();
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.primary.apiKey}`,
      },
      body: JSON.stringify({
        model: 'coding-plan',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Volcano API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    };
  }
}
```

- [ ] **Step 3: 实现 MiniMax Provider**

```typescript
// secretary/src/ai/minimax.ts
import { AIProvider, AIRequest, AIResponse } from './client';
import { configManager } from '../shared/config';

export class MiniMaxProvider extends AIProvider {
  name() { return 'minimax'; }

  async chat(request: AIRequest): Promise<AIResponse> {
    const config = configManager.get();
    const response = await fetch(`${config.ai.fallback.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.fallback.apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    };
  }
}
```

- [ ] **Step 4: 实现双链路路由**

```typescript
// secretary/src/ai/router.ts
import { AIProvider, AIRequest, AIResponse } from './client';
import { VolcanoProvider } from './volcano';
import { MiniMaxProvider } from './minimax';
import { RetryError } from '../shared/retry';

export class AIRouter {
  private primary: AIProvider;
  private fallback: AIProvider;

  constructor() {
    this.primary = new VolcanoProvider();
    this.fallback = new MiniMaxProvider();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    try {
      return await this.primary.chat(request);
    } catch (error) {
      console.warn(`Primary AI failed, trying fallback: ${error}`);
      return this.fallback.chat(request);
    }
  }
}

export const aiRouter = new AIRouter();
```

- [ ] **Step 5: 编写单元测试**

```typescript
// secretary/tests/ai/client.test.ts
import { AIRouter } from '../../src/ai/router';
import { AIProvider, AIRequest } from '../../src/ai/client';

// Mock implementations for testing
class MockProvider extends AIProvider {
  constructor(private shouldFail = false) { super(); }
  name() { return 'mock'; }
  async chat(request: AIRequest): Promise<AIResponse> {
    if (this.shouldFail) throw new Error('Mock failure');
    return { content: 'Mock response', model: 'mock-model' };
  }
}

describe('AIRouter', () => {
  it('should use primary provider by default', async () => {
    const router = new AIRouter();
    // Test would use actual API or further mocking
  });
});
```

- [ ] **Step 6: 提交代码**

```bash
cd secretary
git add src/ai/ tests/ai/
git commit -m "feat: add AI client with dual-provider routing"
```

---

#### Task 2: 自然语言解析增强

**Files:**
- Modify: `secretary/src/parser/nl-parser.ts` - 增强解析能力
- Create: `secretary/tests/parser/nl-parser.test.ts` - 扩展测试

- [ ] **Step 1: 添加测试用例覆盖更多场景**

```typescript
// secretary/tests/parser/nl-parser.test.ts (新增)
it('should parse project creation with deadline', () => {
  const result = parser.parse('项目A需要在5月15日前完成');
  expect(result[0].action).toBe('create');
  expect(result[0].entityType).toBe('project');
  expect(result[0].entity.due_date).toBe('2024-05-15');
});

it('should parse after-complete recurring task', () => {
  const result = parser.parse('看完医生后3个月提醒复查');
  expect(result[0].entity.is_recurring).toBe(true);
  expect(result[0].entity.recurrence_type).toBe('after_complete');
});

it('should parse completion with needs_expansion', () => {
  const result = parser.parse('完成需求后自动规划开发');
  expect(result[0].needsExpansion).toBe(true);
  expect(result[0].expansionType).toBe('development_planning');
});
```

- [ ] **Step 2: 运行测试验证现有解析**

```bash
cd secretary
npm test -- tests/parser/nl-parser.test.ts
```

- [ ] **Step 3: 根据测试结果增强解析器**

根据测试失败情况，修复 `nl-parser.ts` 中的解析逻辑。

- [ ] **Step 4: 提交代码**

```bash
git add src/parser/ tests/parser/
git commit -m "test: add nl-parser test coverage and fix parsing issues"
```

---

### Phase 2: 智能拓展引擎

#### Task 3: 智能拓展引擎实现

**Files:**
- Create: `secretary/src/engine/expansion.ts` - 智能拓展引擎
- Create: `secretary/src/engine/templates/` - 拓展模板
- Create: `secretary/tests/engine/expansion.test.ts` - 测试

- [ ] **Step 1: 创建拓展引擎基础结构**

```typescript
// secretary/src/engine/expansion.ts
import { TaskEntity } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';
import { aiRouter } from '../ai/router';

export interface ExpansionResult {
  shouldExpand: boolean;
  tasks: Partial<TaskEntity>[];
  reasoning?: string;
}

export class ExpansionEngine {
  /**
   * 判断是否需要智能拓展
   */
  async shouldExpand(task: TaskEntity): Promise<ExpansionResult> {
    if (!task.needs_expansion || !task.expansion_type) {
      return { shouldExpand: false, tasks: [] };
    }

    switch (task.expansion_type) {
      case 'development_planning':
        return this.expandDevelopmentPlanning(task);
      case 'medical_followup':
        return this.expandMedicalFollowup(task);
      default:
        return { shouldExpand: false, tasks: [] };
    }
  }

  /**
   * 开发进度规划拓展
   */
  private async expandDevelopmentPlanning(task: TaskEntity): Promise<ExpansionResult> {
    const prompt = `基于任务"${task.title}"，请规划其后续开发步骤。
返回JSON格式：
{
  "tasks": [
    {"title": "步骤1", "priority": "high", "days": 2},
    {"title": "步骤2", "priority": "medium", "days": 3}
  ],
  "reasoning": "规划理由"
}`;

    try {
      const response = await aiRouter.chat({
        messages: [{ role: 'user', content: prompt }],
      });

      const parsed = JSON.parse(response.content);
      return {
        shouldExpand: true,
        tasks: parsed.tasks.map((t: { title: string; priority: string; days: number }) => ({
          title: t.title,
          priority: t.priority as TaskEntity['priority'],
          status: 'pending',
          is_recurring: false,
          parent_id: task.id,
        })),
        reasoning: parsed.reasoning,
      };
    } catch {
      return { shouldExpand: false, tasks: [] };
    }
  }

  /**
   * 医疗复查拓展
   */
  private async expandMedicalFollowup(task: TaskEntity): Promise<ExpansionResult> {
    return {
      shouldExpand: true,
      tasks: [{
        title: `复查：${task.title}`,
        status: 'pending',
        priority: 'medium',
        is_recurring: true,
        recurrence_type: 'after_complete',
        recurrence_rule: {
          type: 'after_complete',
          days_after: 90,
          reminder: true,
        },
        parent_id: task.id,
      }],
      reasoning: '根据医疗常规，建议3个月后复查',
    };
  }
}

export const expansionEngine = new ExpansionEngine();
```

- [ ] **Step 2: 创建测试**

```typescript
// secretary/tests/engine/expansion.test.ts
import { ExpansionEngine } from '../../src/engine/expansion';
import { TaskEntity } from '../../src/shared/types';

describe('ExpansionEngine', () => {
  const engine = new ExpansionEngine();

  describe('shouldExpand', () => {
    it('should return false when needs_expansion is false', async () => {
      const task = { needs_expansion: false } as TaskEntity;
      const result = await engine.shouldExpand(task);
      expect(result.shouldExpand).toBe(false);
    });

    it('should expand medical followup correctly', async () => {
      const task = {
        id: 'test-1',
        title: '看牙医',
        needs_expansion: true,
        expansion_type: 'medical_followup',
      } as TaskEntity;

      const result = await engine.shouldExpand(task);
      expect(result.shouldExpand).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toContain('复查');
    });
  });
});
```

- [ ] **Step 3: 提交代码**

```bash
git add src/engine/ tests/engine/
git commit -m "feat: add expansion engine for smart task expansion"
```

---

### Phase 3: 业务服务层

#### Task 4: 任务服务实现

**Files:**
- Create: `secretary/src/services/task-service.ts` - 任务服务
- Create: `secretary/src/services/schedule-service.ts` - 日程服务
- Create: `secretary/src/services/project-service.ts` - 项目服务
- Create: `secretary/tests/services/` - 服务测试

- [ ] **Step 1: 创建任务服务**

```typescript
// secretary/src/services/task-service.ts
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';
import { icloudConnector } from '../connectors/icloud';
import { expansionEngine } from '../engine/expansion';

export class TaskService {
  async createTask(intent: ParsedIntent): Promise<{ task: TaskEntity; expansionSuggestion?: string }> {
    const now = new Date().toISOString();
    const task: TaskEntity = {
      id: uuidv4(),
      ...intent.entity,
      status: 'pending',
      is_recurring: intent.entity.is_recurring ?? false,
      created_at: now,
      updated_at: now,
    } as TaskEntity;

    const created = await feishuConnector.create(task);

    // 检查是否需要智能拓展
    let expansionSuggestion: string | undefined;
    if (intent.needsExpansion) {
      const expansion = await expansionEngine.shouldExpand(created);
      if (expansion.shouldExpand) {
        expansionSuggestion = `是否需要我帮你规划${expansion.reasoning || '后续步骤'}？`;
      }
    }

    return { task: created, expansionSuggestion };
  }

  async completeTask(taskId: string): Promise<TaskEntity> {
    const task = await feishuConnector.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const updated = await feishuConnector.update(taskId, {
      status: 'completed',
      completion_date: new Date().toISOString(),
    });

    // 检查是否有基于完成时间的循环任务需要创建
    if (task.recurrence_type === 'after_complete' && task.recurrence_rule) {
      const daysAfter = task.recurrence_rule.days_after || 90;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + daysAfter);

      await this.createTask({
        action: 'create',
        entityType: 'task',
        entity: {
          title: task.title,
          status: 'pending',
          priority: task.priority,
          start_date: nextDate.toISOString().split('T')[0],
          is_recurring: task.is_recurring,
          recurrence_type: task.recurrence_type,
          recurrence_rule: task.recurrence_rule,
          parent_id: task.parent_id,
        },
      });
    }

    return updated;
  }

  async queryTasks(filter: { status?: string; priority?: string; date?: string }): Promise<TaskEntity[]> {
    return feishuConnector.query(filter);
  }
}

export const taskService = new TaskService();
```

- [ ] **Step 2: 创建日程服务**

```typescript
// secretary/src/services/schedule-service.ts
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';
import { icloudConnector } from '../connectors/icloud';

export class ScheduleService {
  async createEvent(intent: ParsedIntent): Promise<TaskEntity> {
    const now = new Date().toISOString();
    const event: TaskEntity = {
      id: uuidv4(),
      type: 'event',
      ...intent.entity,
      status: 'pending',
      is_recurring: false,
      created_at: now,
      updated_at: now,
    } as TaskEntity;

    const created = await feishuConnector.create(event);

    // 同步到 iCloud 日历
    try {
      await icloudConnector.createEvent(created);
    } catch (error) {
      console.error('Failed to sync to iCloud:', error);
    }

    return created;
  }

  async getTodayEvents(): Promise<TaskEntity[]> {
    const today = new Date().toISOString().split('T')[0];
    return feishuConnector.query({ type: 'event', start_date: today });
  }

  async getUpcomingEvents(minutes: number = 15): Promise<TaskEntity[]> {
    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60 * 1000);
    const allEvents = await feishuConnector.query({ type: 'event' });

    return allEvents.filter(event => {
      if (!event.start_date || !event.start_time) return false;
      const eventTime = new Date(`${event.start_date}T${event.start_time}`);
      return eventTime >= now && eventTime <= future;
    });
  }
}

export const scheduleService = new ScheduleService();
```

- [ ] **Step 3: 创建项目服务**

```typescript
// secretary/src/services/project-service.ts
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';

export class ProjectService {
  async createProject(intent: ParsedIntent): Promise<TaskEntity> {
    const now = new Date().toISOString();
    const project: TaskEntity = {
      id: uuidv4(),
      type: 'project',
      ...intent.entity,
      status: 'pending',
      is_recurring: false,
      created_at: now,
      updated_at: now,
    } as TaskEntity;

    return feishuConnector.create(project);
  }

  async getProjectTasks(projectId: string): Promise<TaskEntity[]> {
    return feishuConnector.query({ type: 'task', project_id: projectId });
  }

  async getProjectProgress(projectId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const tasks = await this.getProjectTasks(projectId);
    const completed = tasks.filter(t => t.status === 'completed').length;
    return {
      total: tasks.length,
      completed,
      percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }
}

export const projectService = new ProjectService();
```

- [ ] **Step 4: 创建服务测试**

```typescript
// secretary/tests/services/task-service.test.ts
import { TaskService } from '../../src/services/task-service';

describe('TaskService', () => {
  const service = new TaskService();

  // Mock feishuConnector
  jest.mock('../../src/connectors/feishu', () => ({
    feishuConnector: {
      create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      update: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
    },
  }));

  it('should create task with correct defaults', async () => {
    // Test implementation
  });
});
```

- [ ] **Step 5: 提交代码**

```bash
git add src/services/ tests/services/
git commit -m "feat: add task, schedule and project services"
```

---

### Phase 4: 端到端集成

#### Task 5: 对话处理流程实现

**Files:**
- Create: `secretary/src/core/conversation.ts` - 对话处理核心
- Create: `secretary/src/core/response-formatter.ts` - 响应格式化
- Create: `secretary/tests/core/conversation.test.ts` - 集成测试

- [ ] **Step 1: 创建响应格式化器**

```typescript
// secretary/src/core/response-formatter.ts
import { TaskEntity } from '../shared/types';

export class ResponseFormatter {
  formatTaskCreated(task: TaskEntity, suggestion?: string): string {
    let response = `✓ 已添加任务「${task.title}」\n`;
    response += `- 类型：${task.type}\n`;
    if (task.start_date) response += `- 日期：${task.start_date}\n`;
    if (task.due_date) response += `- 截止日期：${task.due_date}\n`;
    response += `- 优先级：${this.formatPriority(task.priority)}\n`;
    response += `- 状态：待处理\n`;

    if (suggestion) {
      response += `\n💡 提示：${suggestion}`;
    }

    return response;
  }

  formatTaskCompleted(task: TaskEntity): string {
    return `✓ 已完成任务「${task.title}」\n完成时间：${task.completion_date}`;
  }

  formatScheduleList(events: TaskEntity[]): string {
    if (events.length === 0) {
      return '今天没有安排的事项。';
    }

    let response = `今天共有${events.length}件事：\n`;
    for (const event of events) {
      const time = event.start_time || '全天';
      response += `- ${time} ${event.title}\n`;
    }
    return response;
  }

  formatSearchResults(results: TaskEntity[]): string {
    if (results.length === 0) {
      return '没有找到相关记录。';
    }

    let response = `找到${results.length}条相关记录：\n`;
    for (const item of results.slice(0, 10)) {
      const date = item.due_date || item.start_date || '无日期';
      response += `- [${item.type}] ${item.title} (${date})\n`;
    }
    if (results.length > 10) {
      response += `...还有${results.length - 10}条记录`;
    }
    return response;
  }

  private formatPriority(priority: string): string {
    const map: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };
    return map[priority] || priority;
  }
}

export const responseFormatter = new ResponseFormatter();
```

- [ ] **Step 2: 创建对话处理核心**

```typescript
// secretary/src/core/conversation.ts
import { nlParser } from '../parser/nl-parser';
import { taskService } from '../services/task-service';
import { scheduleService } from '../services/schedule-service';
import { projectService } from '../services/project-service';
import { feishuConnector } from '../connectors/feishu';
import { responseFormatter } from './response-formatter';

export interface ConversationRequest {
  userId: string;
  message: string;
}

export class ConversationEngine {
  async process(request: ConversationRequest): Promise<string> {
    const intents = nlParser.parse(request.message);

    if (intents.length === 0) {
      return '抱歉，我没有理解您的意思。请尝试更详细的描述。';
    }

    // 只处理第一个意图
    const intent = intents[0];

    switch (intent.action) {
      case 'create':
        return this.handleCreate(intent);
      case 'update':
        return this.handleUpdate(intent);
      case 'complete':
        return this.handleComplete(intent);
      case 'query':
        return this.handleQuery(intent);
      case 'search':
        return this.handleSearch(intent);
      default:
        return '抱歉，该操作暂不支持。';
    }
  }

  private async handleCreate(intent: any): Promise<string> {
    const { entityType, needsExpansion, expansionType } = intent;

    if (entityType === 'event') {
      const event = await scheduleService.createEvent(intent);
      return responseFormatter.formatTaskCreated(event);
    } else if (entityType === 'project') {
      const project = await projectService.createProject(intent);
      return responseFormatter.formatTaskCreated(project);
    } else {
      const { task, expansionSuggestion } = await taskService.createTask(intent);
      return responseFormatter.formatTaskCreated(task, expansionSuggestion);
    }
  }

  private async handleComplete(intent: any): Promise<string> {
    const task = await taskService.completeTask(intent.entity.title);
    return responseFormatter.formatTaskCompleted(task);
  }

  private async handleQuery(intent: any): Promise<string> {
    if (intent.queryType === 'today_schedule') {
      const events = await scheduleService.getTodayEvents();
      return responseFormatter.formatScheduleList(events);
    }
    return '暂不支持该查询类型';
  }

  private async handleSearch(intent: any): Promise<string> {
    const results = await feishuConnector.search(intent.searchQuery);
    return responseFormatter.formatSearchResults(results);
  }

  private async handleUpdate(intent: any): Promise<string> {
    return '更新功能开发中';
  }
}

export const conversationEngine = new ConversationEngine();
```

- [ ] **Step 3: 创建集成测试**

```typescript
// secretary/tests/core/conversation.test.ts
import { ConversationEngine } from '../../src/core/conversation';

describe('ConversationEngine', () => {
  const engine = new ConversationEngine();

  it('should process create task request', async () => {
    const result = await engine.process({
      userId: 'test-user',
      message: '帮我安排下周三下午3点开会',
    });
    expect(result).toContain('已添加');
  });

  it('should process query today schedule', async () => {
    const result = await engine.process({
      userId: 'test-user',
      message: '今天有什么安排？',
    });
    expect(result).toBeDefined();
  });

  it('should process search request', async () => {
    const result = await engine.process({
      userId: 'test-user',
      message: '查找Q3的项目记录',
    });
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 4: 提交代码**

```bash
git add src/core/ tests/core/
git commit -m "feat: add conversation engine and response formatter"
```

---

### Phase 5: Skill 打包与发布

#### Task 6: OpenClaw Skill 打包

**Files:**
- Modify: `secretary/package.json` - 添加打包脚本
- Create: `secretary/scripts/openclaw-pack.js` - OpenClaw 打包脚本
- Create: `secretary/dist/openclaw/` - 打包输出目录

- [ ] **Step 1: 添加 OpenClaw 打包配置到 package.json**

```json
{
  "scripts": {
    "pack:openclaw": "node scripts/openclaw-pack.js"
  }
}
```

- [ ] **Step 2: 创建打包脚本**

```javascript
// secretary/scripts/openclaw-pack.js
const fs = require('fs-extra');
const path = require('path');

async function packOpenClawSkill() {
  const outputDir = path.join(__dirname, '../dist/openclaw');

  // 清理输出目录
  await fs.emptyDir(outputDir);

  // 复制 OpenClaw 专用文件
  await fs.copy(path.join(__dirname, '../soul'), path.join(outputDir, 'soul'));
  await fs.copy(path.join(__dirname, '../agents'), path.join(outputDir, 'agents'));
  await fs.copy(path.join(__dirname, '../SKILL.md'), path.join(outputDir, 'SKILL.md'));

  // 编译 TypeScript
  // ...

  console.log('OpenClaw skill packed to:', outputDir);
}

packOpenClawSkill().catch(console.error);
```

- [ ] **Step 3: 运行打包**

```bash
cd secretary
npm run pack:openclaw
```

- [ ] **Step 4: 提交代码**

```bash
git add scripts/ package.json
git commit -m "feat: add OpenClaw skill packaging"
```

---

#### Task 7: Claude Code Skill 打包

**Files:**
- Modify: `secretary/package.json` - 添加 Claude Code 打包脚本

- [ ] **Step 1: 添加 Claude Code 打包配置**

```json
{
  "scripts": {
    "pack:claude": "npm run build && node scripts/claude-pack.js"
  }
}
```

- [ ] **Step 2: 提交代码**

```bash
git add package.json
git commit -m "feat: add Claude Code skill packaging"
```

---

### Phase 6: 测试与验证

#### Task 8: 完整测试套件

**Files:**
- Create: `secretary/tests/integration/` - 集成测试
- Modify: `secretary/jest.config.js` - Jest 配置

- [ ] **Step 1: 配置 Jest**

```javascript
// secretary/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 2: 运行完整测试**

```bash
cd secretary
npm test -- --coverage
```

- [ ] **Step 3: 查看覆盖率报告**

确保核心模块（parser, services, engine）覆盖率 > 80%

- [ ] **Step 4: 提交测试配置**

```bash
git add jest.config.js package.json
git commit -m "test: add Jest configuration and run full test suite"
```

---

## 开发任务清单

| Phase | Task | 描述 | 预计时间 |
|-------|------|------|---------|
| 1 | Task 1 | AI 模型双链路调用 | 2h |
| 1 | Task 2 | 自然语言解析增强 | 1h |
| 2 | Task 3 | 智能拓展引擎 | 2h |
| 3 | Task 4 | 任务/日程/项目服务 | 3h |
| 4 | Task 5 | 对话处理流程 | 2h |
| 5 | Task 6 | OpenClaw Skill 打包 | 1h |
| 5 | Task 7 | Claude Code Skill 打包 | 1h |
| 6 | Task 8 | 完整测试套件 | 2h |

**总计：约 14 小时**

---

## 部署检查清单

- [ ] 所有测试通过 (`npm test`)
- [ ] 代码覆盖率 > 80%
- [ ] `npm run build` 成功
- [ ] `npm run pack:openclaw` 成功
- [ ] `npm run pack:claude` 成功
- [ ] 配置 `config.yaml` 完成
- [ ] 环境变量配置完成
- [ ] 飞书应用配置完成
- [ ] iCloud CalDAV 配置完成

---

## 文档更新

- [ ] 更新 `README.md` - 添加安装和使用说明
- [ ] 更新 `SKILL.md` - 确保与代码同步
- [ ] 添加 `docs/API.md` - API 接口文档
- [ ] 添加 `docs/DEPLOY.md` - 部署指南
