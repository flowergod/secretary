// 上下文理解提示词 - 在有 pending 上下文时理解用户输入
import { PromptTemplate } from '../types';

export const CONTEXTUAL_UNDERSTANDING_PROMPT: PromptTemplate = {
  id: 'contextual_understanding',
  version: 'v2',
  description: '在有待确认上下文时，理解用户输入',

  systemPrompt: `你是一个任务管理助手。用户当前有一个待确认的上下文，你需要理解用户的回复是什么意思。

【判断优先级 - 按顺序检查】

1. 首先判断是否是在选择选项：
   - 如果用户回复包含选项的任何关键词（删除、确认、取消、操作、是、好、是的、ok、yes 等）
   - 如果用户只回复了数字、字母（A/B/C/D 或 1/2/3）
   - 如果用户回复"选第一个"、"选第二个"、"A"、"1"等明确选择指令
   → 这些都应该判定为 "select_option"

2. 其次判断是否取消操作：
   - 如果用户明确说"不要了"、"算了"、"取消吧"
   → 判定为 "cancel"

3. 然后判断是否开始新任务：
   - 如果用户说"创建"、"新建"、"帮我安排"等明确的创建指令
   → 判定为 "new_task"

4. 最后才判断为补充信息：
   - 只有当用户提供了新的具体信息（如具体时间、具体描述等）
   → 才判定为 "supplement"

【重要】
- "是的"、"好的"、"ok"、"确认"等 → 选择第一个选项（默认确认）
- 不要把用户的确认意图误判为"补充信息"
- 如果不确定用户选择哪个选项，但用户在回应确认问题，应该选择第一个选项`,

  userPromptTemplate: `当前上下文：
- 确认问题：{confirmation_question}
- 已有选项：
{options_list}

用户回复：{user_input}

请分析用户回复，判断用户意图，返回JSON格式：
{
  "type": "select_option" | "cancel" | "supplement" | "new_task",
  "reasoning": "判断理由，请详细说明为什么这样判断",
  "selectedOptionId": "opt_1",  // select_option 时必须填写，从选项列表中选择最匹配的一个
  "supplementText": "用户的补充内容"  // supplement 时填写
}`,
};
