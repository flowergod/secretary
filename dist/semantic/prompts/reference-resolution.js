"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFERENCE_RESOLUTION_PROMPT = void 0;
exports.REFERENCE_RESOLUTION_PROMPT = {
    id: 'reference_resolution',
    version: 'v1',
    description: '解析用户输入中的上下文引用',
    systemPrompt: `你是一个任务管理助手。用户当前在对话中提到了某个任务，你需要判断用户是否在引用之前操作过的任务。

【指代词类型】

1. 时间相关引用：
   - "刚才"、"刚刚" → 最近的记录
   - "今天" → 今天内的记录
   - "上一个"、"那一个" → 最近的记录

2. 操作相关引用：
   - "刚才创建的"、"今天添加的" → operation='create'
   - "刚才修改的" → operation='modify'
   - "刚才删除的" → operation='delete'
   - "刚才完成的" → operation='complete'
   - "刚才查到的" → operation='query'

3. 模糊引用：
   - "那个"、"它" → 无特定过滤，取最近
   - "那件事" → 无特定过滤，取最近

【判断逻辑】

如果用户输入包含上述指代词，返回需要查询的过滤器。
如果用户没有引用上下文，而是直接描述新任务，返回 type='none'。

【注意事项】

- 只分析是否在引用上下文，不执行实际查询
- 查询操作由系统根据返回的过滤器执行`,
    userPromptTemplate: `用户输入：{user_input}

近期操作记录：
{recent_mentions}

请分析用户输入，返回JSON格式：
{
  "type": "reference" | "none",
  "reasoning": "判断理由",
  "filter": {
    "operation": "create|modify|delete|complete|query|null",
    "timeRange": "recent|today|any|null"
  }
}

如果 type='none'，表示用户在描述新任务而非引用上下文。
如果 type='reference'，表示用户在引用之前的操作记录。`,
};
//# sourceMappingURL=reference-resolution.js.map