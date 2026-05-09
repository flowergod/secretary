# Issue: 循环任务截止日期支持不完整

## 问题描述

当前系统对有截止日期的循环任务支持不完整，主要体现在 `UNTIL` 日期格式转换上。

## 已知情况

### 已实现的部分

| 组件 | 支持情况 |
|------|----------|
| LLM 解析 | ✓ 能从自然语言提取 `count` 和 `until` |
| RRULE 生成 | ✓ 能生成 `RRULE:FREQ=DAILY;COUNT=5` |
| TaskService | ✓ 能存储 `recurrence_rule` 字段 |
| Feishu | ✓ "循环规则" 字段已映射 |
| iCloud | ✓ `recurrenceRule` 被写入 VEVENT |

### 需要改进的问题

#### 1. UNTIL 日期格式转换

**问题：** iCloud CalDAV 要求 UNTIL 格式为 `YYYYMMDDTHHMMSSZ`（如 `20251015T000000Z`），但 LLM 可能返回自然语言如 "10月15日" 或 "2025-10-15"。

**当前代码 (capability-dispatcher.ts):**
```typescript
if (recurring.until) {
  recurrenceRule = `RRULE:FREQ=${pattern.toUpperCase()};UNTIL=${recurring.until}`;
  // 问题：recurring.until 可能是 "10月15日" 或 "2025-10-15"
  // 需要转换为: "20251015T000000Z"
}
```

**需要实现：**
```typescript
function normalizeUntilDate(dateStr: string, startDate?: string): string {
  // 输入: "10月15日", "2025-10-15", "10/15"
  // 参考 startDate 确定年份
  // 输出: "20251015T000000Z" (iCal UTC格式)
}
```

#### 2. COUNT vs UNTIL 的 LLM 解析

**当前状态：** LLM 返回的结构可能不一致：
```json
// 情况A: COUNT 格式
{ "recurring": { "pattern": "daily", "count": 5 } }

// 情况B: UNTIL 格式
{ "recurring": { "pattern": "daily", "until": "2025-10-15" } }

// 情况C: 自然语言
{ "recurring": { "pattern": "daily", "until": "10月15日" } }
```

需要统一 LLM prompt 确保返回格式一致。

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│  用户输入: "后面5天，每天9-10点都有要开例会"                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LLM 解析                                                       │
│  {                                                            │
│    "recurring": { "pattern": "daily", "count": 5 }           │
│  }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CapabilityDispatcher.createTask()                              │
│  生成: RRULE:FREQ=DAILY;COUNT=5                               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  Feishu Bitable        │     │  iCloud Calendar         │
│  - 循环规则: COUNT=5   │     │  - VEVENT with RRULE    │
│  - 循环类型: daily     │     │  - 生成5个实例事件        │
└─────────────────────────┘     └─────────────────────────┘
```

## 待办事项

- [ ] 实现 `normalizeUntilDate()` 函数
- [ ] 更新 LLM prompt 确保 UNTIL 返回标准日期格式
- [ ] 添加单元测试
- [ ] 测试 "循环5次" 场景
- [ ] 测试 "循环到10月15日" 场景

## 相关文件

- `src/semantic/capability-dispatcher.ts` - RRULE 生成逻辑
- `src/semantic/prompts/intent-classification.ts` - LLM prompt
- `src/semantic/prompts/parameter-extraction.ts` - 参数提取 prompt
- `src/shared/recurrence-helper.ts` - 循环规则辅助函数
- `src/connectors/icloud.ts` - iCloud 事件同步

## 创建时间

2026-05-05

## 优先级

Medium

## 标签

- recurring-tasks
- date-format
- rrule