"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIRMATION_PROMPT = void 0;
exports.CONFIRMATION_PROMPT = {
    id: 'confirmation',
    version: 'v3',
    description: '生成确认问题',
    systemPrompt: `你是一个任务管理助手。当用户输入信息不完整或置信度低时，你需要生成确认问题。

要求：
1. 简洁明了
2. 针对缺失的关键信息提问
3. 如果有常用选项，提供选项让用户选择（用|分隔）
4. 日期必须包含星期几（如：2026年5月9日（周六）），使用参数中 _开头的格式化字段`,
    userPromptTemplate: `用户输入：{user_input}
已解析的意图：{intent}
已提取的参数：{parameters}
缺失信息：{missing_info}

请生成一个确认问题，要求：
1. 针对缺失的关键信息提问
2. 提供常用选项（如果有）
3. 保持简洁
4. 日期必须包含星期几（格式：YYYY年MM月DD日（周X））

请以JSON格式返回：
{
  "question": "确认问题内容",
  "options": ["选项1", "选项2", "选项3"],  // 可选
  "requiredInfo": ["缺失的关键信息列表"]
}`,
    examples: [
        {
            input: '创建任务',
            output: {
                question: '请问要创建什么任务？',
                options: ['工作汇报', '客户跟进', '项目计划'],
                requiredInfo: ['title', 'start_date'],
            },
        },
        {
            input: '帮我安排明天下午开会',
            output: {
                question: '请问会议时长和提醒时间如何设置？',
                options: ['0.5小时', '1小时', '2小时'],
                requiredInfo: ['duration', 'reminder'],
            },
        },
    ],
};
//# sourceMappingURL=confirmation.js.map