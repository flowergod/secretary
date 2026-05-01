# 项目管理 AI 助理 - 设计文档

**版本：** 2.0
**日期：** 2026-04-29
**状态：** 待评审

---

## 1. 产品概述

### 1.1 核心定位

全能秘书式 AI 助理，通过自然对话管理日程、任务和项目，具备主动提醒和智能拓展能力。

### 1.2 双平台支持

| 平台 | 支持模式 | 说明 |
|------|---------|------|
| **OpenClaw** | 完整支持 | Skill 插件形式，支持主动提醒定时推送 |
| **Claude Code** | 基础支持 | Skill 形式，被动响应模式，无主动提醒 |

### 1.3 技术选型

| 组件 | 技术方案 |
|------|---------|
| 对话网关 | OpenClaw / Claude Code |
| AI 模型主链路 | 火山方舟 coding plan API |
| AI 模型备链路 | MiniMax 自建服务器 |
| 数据存储 | 飞书表格（统一表） |
| 日历展示 | iCloud 日历（只读同步） |
| 部署模式 | Skill 插件（双平台兼容） |

### 1.4 功能范围

**第一期（必须实现）**

| 功能 | OpenClaw | Claude Code |
|------|---------|------------|
| 对话式任务管理（增删改查、循环、完成） | ✓ | ✓ |
| 智能拓展询问机制 | ✓ | ✓ |
| 主动助理提醒（早晚提醒、周末总结、事前提醒） | ✓ | ✗ |
| 飞书表格数据存储 | ✓ | ✓ |
| iCloud 日历单向同步 | ✓ | ✓ |
| 信息检索（跨表格语义搜索） | ✓ | ✓ |
| 异常处理（同步失败、日历冲突、任务延期） | ✓ | ✓ |

**后续迭代**

- 会议协作（会前资料整理、会后任务拆解）
- 项目进展追踪
- 决策支持
- 知识关联

---

## 2. 系统架构

### 2.1 双平台架构

```
┌─────────────────────────────────────────────────────────────┐
│                    双平台 Skill 层                           │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │  OpenClaw Skill      │    │  Claude Code Skill       │    │
│  │  • SOUL.md 人格      │    │  • SKILL.md 一体化      │    │
│  │  • AGENTS.md 规则    │    │  • name + description   │    │
│  │  • cron 调度器       │    │  • Markdown 指令         │    │
│  └──────────┬──────────┘    └────────────┬────────────┘    │
│             │                              │                  │
└─────────────┼──────────────────────────────┼──────────────────┘
              │                              │
              ↓                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    核心业务逻辑（共用）                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 自然语言    │  │ 飞书表格    │  │ iCloud日历          │  │
│  │ 解析引擎    │  │ Connector  │  │ Connector           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 任务管理    │  │ 智能拓展    │  │ 异常处理            │  │
│  │ 逻辑        │  │ 引擎        │  │ 机制                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │                              │
              │                              │
              ↓                              ↓
     ┌─────────────────┐          ┌─────────────────┐
     │   OpenClaw      │          │   Claude Code    │
     │   Gateway       │          │   Harness       │
     │   (主动推送)    │          │   (被动响应)    │
     └─────────────────┘          └─────────────────┘
```

### 2.2 目录结构

```
project-secretary/
├── SKILL.md                      # Claude Code 格式（主入口）
├── soul/                         # OpenClaw 专用
│   └── SOUL.md                   # OpenClaw 人格定义
├── agents/                       # OpenClaw 专用
│   └── AGENTS.md                 # OpenClaw 行为规则
├── src/                          # 共用核心逻辑
│   ├── index.ts                  # 入口（双平台共用）
│   ├── parser/
│   │   └── nl-parser.ts          # 自然语言理解
│   ├── connectors/
│   │   ├── feishu.ts             # 飞书表格 Connector
│   │   └── icloud.ts             # iCloud 日历 Connector
│   ├── scheduler/                 # OpenClaw 专用
│   │   └── reminder.ts            # 主动提醒调度
│   ├── memory/
│   │   └── context.ts            # 上下文管理
│   └── shared/
│       ├── types.ts              # 共用类型定义
│       ├── config.ts             # 配置管理
│       └── retry.ts              # 重试机制
└── tests/
```

---

## 3. 平台特定配置

### 3.1 Claude Code Skill 配置 (SKILL.md)

```markdown
---
name: project-secretary
description: 项目管理 AI 助理。当用户提到日程、任务、项目管理时触发，包括：创建/修改/删除任务，安排会议，查询日程，循环任务设置，任务完成标记。也适用于"帮我安排"、"下周有什么计划"、"记得提醒我"、"完成XX后规划YY"等场景。
---

# 项目管理 AI 助理

## 核心人格

你是一个细心、高效的全能秘书。你的职责是帮助用户管理日程、任务和项目。

## 能力范围

1. **任务管理**：创建、修改、删除、完成任务
2. **日程管理**：安排会议、设置提醒、查询日程
3. **项目管理**：创建项目、设置截止日期、关联子任务
4. **循环任务**：固定间隔循环、基于完成时间的循环
5. **智能拓展**：理解任务关联性，主动询问是否需要拓展
6. **信息检索**：搜索历史任务、项目记录、日程安排

## 数据存储

所有数据存储在飞书表格中。iCloud 日历作为日程展示层。

## 对话原则

1. **详细确认**：每个操作都要明确告知用户做了什么
2. **主动建议**：在适当时机询问是否需要智能拓展
3. **清晰结构**：回复使用清晰的格式，便于用户阅读

## 响应格式

执行操作后，使用以下格式确认：

```
✓ 已添加任务「任务名称」
  - 类型：任务/日程/项目
  - 日期：YYYY-MM-DD
  - 优先级：高/中/低
  - 状态：待处理/进行中/已完成

💡 提示：[主动建议内容]
```

## 配置

配置通过环境变量或 config.yaml 提供：
- 飞书表格访问凭证
- iCloud 日历访问凭证
- AI 模型 API 配置
```

### 3.2 OpenClaw SOUL.md

```markdown
# SOUL.md - 项目管理 AI 助理

## Core Identity

**Project Secretary** — 你的全能秘书。

命名灵感来自专业行政助理：你高效、细心、主动。不只是响应命令，而是预判需求。

## Your Role

你是用户的个人项目管理助理。你的职责：

1. **管理日程**：确保用户不错过任何重要事项
2. **跟踪任务**：帮助用户完成待办事项
3. **主动提醒**：在适当时机主动联系用户，而不是等待用户询问
4. **智能拓展**：理解任务之间的关联，主动建议下一步行动

## Personality

- **细心**：注意到细节，不遗漏任何信息
- **高效**：快速响应，准确执行
- **主动**：不只等待命令，预判需求
- **专业**：用词准确，格式清晰

## Communication Style

- 使用结构化回复，便于快速浏览
- 重要信息放在前面
- 适当使用 emoji 增加可读性
- 确认每个操作结果

## Memory

每次对话结束时，记住：
- 用户的偏好设置
- 未完成的任务
- 即将到来的重要日程
- 任何特殊指示

你的记忆应该帮助用户感觉你在持续关注他们的事务，而不是每次对话都是全新的开始。
```

### 3.3 OpenClaw AGENTS.md

```markdown
# AGENTS.md - 项目管理 AI 助理行为规则

## 基本规则

1. **每次响应都要确认** — 告诉用户你做了什么
2. **主动提醒** — 不要只等用户问，定期推送提醒
3. **智能拓展** — 创建任务时考虑是否需要关联拓展
4. **详细记录** — 所有操作都记录到飞书表格

## 任务创建

当用户要求创建任务时：
1. 解析任务信息（标题、日期、优先级等）
2. 创建任务记录
3. 如果任务涉及智能拓展（标记 needs_expansion）
4. 询问用户是否需要自动规划关联任务

## 任务完成

当用户标记任务完成时：
1. 更新任务状态为 completed
2. 记录完成时间
3. 检查是否有基于完成时间的循环任务需要创建
4. 询问是否需要拓展相关任务

## 主动提醒规则

### 每日提醒

- **早安提醒 (8:30)**：当天日程概览
- **晚安提醒 (21:00)**：明天日程预览
- **周末总结 (周五 18:00)**：本周完成情况 + 下周展望

### 事前提醒

- 事件开始前 15 分钟提醒
- 任务截止前 24 小时预警

### 空闲时间

- 检测到连续 >1 小时空闲时主动建议

## 错误处理

1. API 调用失败：重试 3 次，间隔 2 秒
2. 同步失败：标记状态，通知用户
3. AI 模型失败：切换备链路，记录错误

## 交互示例

用户："帮我安排下周三下午3点开会"

→ 创建 event 类型记录，同步到 iCloud 日历，确认给用户

用户："完成任务A"

→ 更新状态，检查循环任务，询问是否需要拓展

用户："今天有什么安排？"

→ 查询当天日程，按时间顺序列出

用户："查找Q3的项目记录"

→ 搜索所有 Q3 相关记录，展示结果
```

---

## 4. 核心业务逻辑（共用）

### 4.1 自然语言解析

解析引擎对两平台完全共用，定义统一的解析规则：

```typescript
// src/parser/nl-parser.ts
interface ParsedIntent {
  action: 'create' | 'update' | 'delete' | 'complete' | 'query' | 'search';
  entityType: 'task' | 'event' | 'project';
  entity: TaskEntity;
  needsExpansion?: boolean;
  expansionType?: string;
}

function parseNLInput(input: string): ParsedIntent;
```

### 4.2 数据模型

共用数据模型，参见第 5 节。

### 4.3 Connector 层

飞书表格和 iCloud 日历的 Connector 对两平台完全共用。

---

## 5. 数据模型

### 5.1 飞书表格统一表结构

**表名：** 项目任务总表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | 字符串 | 唯一标识 (UUID) |
| type | 枚举 | task / event / project |
| title | 字符串 | 标题 |
| description | 文本 | 详细描述 |
| status | 枚举 | pending / in_progress / completed / cancelled |
| priority | 枚举 | high / medium / low |
| due_date | 日期 | 截止日期（可选） |
| start_date | 日期 | 开始日期（可选） |
| start_time | 时间 | 开始时间（可选） |
| is_recurring | 布尔 | 是否循环 |
| recurrence_type | 枚举 | fixed_interval / after_complete |
| recurrence_rule | JSON | 循环规则详情 |
| parent_id | 字符串 | 父任务 ID |
| project_id | 字符串 | 所属项目 ID |
| completion_date | 日期 | 完成时间 |
| needs_expansion | 布尔 | 是否需要智能拓展 |
| expansion_type | 字符串 | 拓展类型标记 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 5.2 循环规则 JSON 结构

**固定间隔循环：**
```json
{
  "type": "fixed_interval",
  "interval": "2 weeks",
  "start_from": "2024-05-01",
  "end_date": null
}
```

**基于完成时间的循环：**
```json
{
  "type": "after_complete",
  "days_after": 90,
  "reminder": true
}
```

---

## 6. 对话理解与执行

### 6.1 自然语言解析示例

| 用户输入 | 解析结果 |
|---------|---------|
| "帮我安排下周三下午3点开会" | type=event, title=开会, start_date=下周三, start_time=15:00 |
| "项目A需要在5月15日前完成" | type=project, title=项目A, due_date=2024-05-15 |
| "完成需求后自动规划开发" | type=task, title=完成需求, needs_expansion=true, expansion_type=development_planning |
| "帮我把会议改到下周五" | action=update, target=最近会议, field=start_date, value=下周五 |
| "每两周提醒我做一次体检" | type=task, title=体检, is_recurring=true, recurrence_type=fixed_interval, recurrence_rule={interval: "2 weeks"} |
| "看完医生后3个月提醒复查" | type=task, title=复查, is_recurring=true, recurrence_type=after_complete, recurrence_rule={days_after: 90} |
| "完成任务A" | action=complete, target=任务A |
| "今天有什么安排？" | action=query, query_type=today_schedule |
| "查找Q3的项目记录" | action=search, query=Q3项目 |

### 6.2 响应确认格式

详细确认模式 — 每个操作都返回结构化确认：

```
✓ 已添加任务「准备Q2方案」
  - 类型：任务
  - 项目：Q2规划
  - 截止日期：2024-05-15
  - 优先级：高
  - 状态：待处理

💡 提示：如果这是项目关键任务，我可以帮你规划具体的执行步骤，需要吗？
```

---

## 7. iCloud 日历同步

### 7.1 同步策略

- **方向：** 单向同步（飞书表格 → iCloud 日历）
- **触发：** 事件创建/更新/删除时实时同步
- **同步内容：** type=event 且有 start_date 的事项

### 7.2 字段映射

| 飞书表格字段 | iCloud 日历字段 |
|-------------|----------------|
| title | 事件标题 |
| description | 备注 |
| start_date + start_time | 开始时间 |
| due_date | 结束时间 |

### 7.3 认证方式

- Apple ID + 应用专用密码
- 使用 CalDAV API 进行同步

---

## 8. 主动助理能力（仅 OpenClaw）

### 8.1 提醒场景与调度

| 场景 | 触发时间 | 内容示例 |
|------|---------|---------|
| 早安提醒 | 每日 8:30 | "早安！今天你有3件事：9点团队会议、2点方案评审、晚上7点牙医预约" |
| 晚安提醒 | 每日 21:00 | "明天日程：下午4点项目评审，记得准备材料" |
| 周末总结 | 周五 18:00 | "本周完成5项任务，下周有2个截止日：周三Q2方案、周五开发联调" |
| 事前提醒 | 事件前15分钟 | "15分钟后：方案评审，会议室B3，记得带上PPT" |
| 空闲安排 | 检测到连续>1小时空闲 | "下午2-4点有空，是否需要安排'整理文档'任务？" |
| 高优优先 | 多个高优先级任务堆积 | "你有3个待办，高优先级'准备方案'建议先做" |
| 截止临近 | 任务截止前1天 | "'Q2方案'明天截止，还差20%未完成，需要帮忙调整吗？" |

### 8.2 Claude Code 限制说明

Claude Code 的 Skill 系统**不支持定时主动推送**。在 Claude Code 模式下：
- 用户必须主动发起对话
- 无法自动发送早安/晚安提醒
- 只能通过用户询问来触发检索和提醒

如需主动提醒功能，请使用 OpenClaw 平台。

### 8.3 OpenClaw 调度器实现

```yaml
# OpenClaw SKILL.md 配置
cron:
  - name: "morning-reminder"
    schedule: "30 8 * * *"
    handler: "morning-reminder"
  - name: "evening-reminder"
    schedule: "0 21 * * *"
    handler: "evening-reminder"
  - name: "weekend-summary"
    schedule: "0 18 * * 5"
    handler: "weekend-summary"
  - name: "pre-event-reminder"
    schedule: "*/15 * * * *"
    handler: "check-upcoming-events"
```

### 8.4 智能拓展流程

```
用户说："完成需求后自动规划开发"
         ↓
AI 创建任务 "完成需求"
         ↓
标记 needs_expansion = true
expansion_type = "development_planning"
         ↓
AI 询问："需求完成后，是否需要我帮你规划开发进度？"
         ↓
用户确认 → AI 生成开发计划任务列表
用户拒绝 → 不创建关联任务
```

---

## 9. AI 模型调用

### 9.1 双链路设计

```
AI 请求
    ↓
主链路：火山方舟 coding plan API
    ↓ (失败时)
备链路：MiniMax 自建服务器
    ↓ (也失败时)
返回错误 + 记录日志
```

### 9.2 Prompt 策略

- OpenClaw：使用 SOUL.md 定义人格，AGENTS.md 定义行为
- Claude Code：使用 SKILL.md 内置 Markdown 定义人格和行为
- 用户输入通过自然语言解析后执行
- 复杂决策（如智能拓展）调用 AI 模型

---

## 10. 信息检索能力

### 10.1 检索范围

- 所有任务、项目、日程的标题和描述
- 按时间范围、类型、状态、优先级筛选
- 语义相似度匹配

### 10.2 检索示例

| 用户查询 | AI 行为 |
|---------|--------|
| "查找Q3的项目记录" | 搜索所有 Q3 相关事项 |
| "上周开了什么会？" | 按时间范围筛选 event 类型 |
| "有哪些高优先级任务？" | 按 priority=high 筛选 |

---

## 11. 异常处理

### 11.1 异常类型与处理

| 异常 | 处理策略 |
|------|---------|
| 飞书 API 调用失败 | 重试3次，间隔2秒，失败后通知用户 |
| iCloud 日历同步失败 | 重试3次，标记同步状态，后续手动同步 |
| 日历冲突 | 检测到冲突时询问用户协调方案 |
| 任务延期 | 截止日期到达前24小时预警（仅 OpenClaw） |
| AI 模型调用失败 | 切换备链路，备链路也失败时记录并返回友好错误 |

### 11.2 重试机制

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await sleep(delay * (i + 1));
    }
  }
  throw new Error('Max retry attempts reached');
}
```

---

## 12. 安装与配置

### 12.1 OpenClaw 安装

```bash
# 从 GitHub 安装
npx skills add https://github.com/your-org/project-secretary

# 或本地安装
cd project-secretary
npm install
openclaw skills install ./project-secretary
```

### 12.2 Claude Code 安装

```bash
# 从 GitHub 安装
npx skills add https://github.com/your-org/project-secretary

# 或本地安装
npx skills add ./project-secretary
```

### 12.3 必需配置

| 配置项 | 说明 |
|-------|------|
| 飞书 Webhook URL | 用于接收飞书消息（OpenClaw） |
| 飞书表格 Token | 访问飞书表格的凭证 |
| iCloud Apple ID | 日历同步账户 |
| iCloud 应用专用密码 | 日历访问凭证 |
| 火山方舟 API Key | AI 主链路 |
| MiniMax API Key | AI 备链路 |

### 12.4 配置文件

```yaml
# config.yaml
feishu:
  webhook_url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
  table_token: "xxx"

icloud:
  apple_id: "your@email.com"
  app_password: "xxxx-xxxx-xxxx-xxxx"

ai:
  primary:
    provider: "volcano"
    api_key: "${VOLCANO_API_KEY}"
    model: "coding-plan"
  fallback:
    provider: "minimax"
    api_key: "${MINIMAX_API_KEY}"
    base_url: "https://api.minimax.io/anthropic"
```

---

## 13. 测试策略

### 13.1 测试覆盖

- 自然语言解析单元测试
- 飞书 Connector 集成测试
- iCloud Connector 集成测试
- OpenClaw 定时任务调度测试
- 端到端对话流程测试

### 13.2 双平台测试

| 平台 | 测试重点 |
|------|---------|
| OpenClaw | 主动提醒、cron 调度、消息路由 |
| Claude Code | Skill 触发、对话理解、响应格式 |

---

## 14. 后续迭代规划

### 14.1 第二期

- **会议协作**：会前资料整理、议程生成；会后决策提取、任务自动拆解
- **项目追踪**：完成度可视化、延期风险预警

### 14.2 第三期

- **决策支持**：选项对比分析、风险评估
- **知识关联**：基于上下文自动补充相关信息

---

## 附录

### A. 平台差异总结

| 功能 | OpenClaw | Claude Code |
|------|---------|------------|
| Skill 格式 | SOUL.md + AGENTS.md + SKILL.md | SKILL.md (一体化) |
| 人格定义 | 独立 SOUL.md | 嵌入 SKILL.md |
| 主动提醒 | ✓ 支持 cron 调度 | ✗ 不支持 |
| 安装命令 | `openclaw skills install` | `npx skills add` |
| 消息推送 | ✓ 可主动推送 | ✗ 只能响应 |

### B. 参考资料

- OpenClaw 官方文档：https://openclaw.ai/docs
- Claude Code Skill 文档：https://code.claude.com/docs/zh-CN/skills
- 火山方舟 API：https://www.volcengine.com/product/volcano方舟
- iCloud CalDAV API：Apple 官方文档

### C. 术语表

| 术语 | 说明 |
|-----|------|
| Connector | 数据连接器，负责与外部系统交互 |
| Skill | 技能插件，双平台通用概念 |
| SOUL.md | OpenClaw 人格定义文件 |
| AGENTS.md | OpenClaw 行为规则文件 |
| CalDAV | 日历同步协议 |
