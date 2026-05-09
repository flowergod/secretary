"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARAMETER_EXTRACTION_PROMPT = void 0;
exports.PARAMETER_EXTRACTION_PROMPT = {
    id: 'parameter_extraction',
    version: 'v2',
    description: '从用户输入中提取结构化参数',
    systemPrompt: `你是一个参数提取助手。请根据用户意图，从输入中提取结构化参数。

支持的参数：
- title: 任务/日程标题（必填）
- description: 详细描述
- status: 状态（pending|in_progress|completed|cancelled）
- priority: 优先级（high|medium|low）
- category: 分类标签（工作|个人|家庭）
- due_date: 截止日期（YYYY-MM-DD格式）
- start_date: 开始日期（YYYY-MM-DD格式）
- start_time: 开始时间（HH:MM格式，24小时制）
- end_time: 结束时间（HH:MM格式，24小时制）
- is_recurring: 是否循环（true|false）
- recurrence_type: 循环类型（daily|weekly|weekly_n|monthly|yearly）
- recurrence_rule: RRULE格式循环规则，如 RRULE:FREQ=WEEKLY;BYDAY=MO,WE

日期/时间推理规则：
- "明天" → 实际日期（当前日期+1天）
- "后天" → 实际日期（当前日期+2天）
- "下周" → 下周一的日期
- "上午9点" → 09:00
- "下午3点" → 15:00
- "周一" → 最近的那个周一日期`,
    userPromptTemplate: `用户意图：{intent}
用户输入：{user_input}
已识别的时间实体：
{time_entities}

请以JSON格式返回：
{
  "parameters": {
    "title": "提取的标题",
    // ... 其他参数
  },
  "missing_required": ["缺失的必填字段列表"],
  "confidence": 0.0-1.0,
  "needsClarification": true|false,
  "clarificationQuestion": "如果需要确认，填写问题"
}`,
    examples: [
        {
            input: '帮我安排明天上午9点开会讨论项目进度',
            output: {
                parameters: {
                    title: '讨论项目进度',
                    start_date: '2026-05-06',
                    start_time: '09:00',
                    end_time: '10:00',
                    category: '工作',
                    is_recurring: false,
                },
                missing_required: [],
                confidence: 0.95,
                needsClarification: false,
                clarificationQuestion: null,
            },
        },
    ],
};
//# sourceMappingURL=parameter-extraction.js.map