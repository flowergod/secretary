// 意图分类提示词
import { PromptTemplate } from '../types';

export const INTENT_CLASSIFICATION_PROMPT: PromptTemplate = {
  id: 'intent_classification',
  version: 'v5',
  description: '判断用户意图',

  systemPrompt: `你是一个任务管理助手。用户将输入一段文字，你需要判断其意图。

可用能力：
{capabilities}

【分类推断规则】

请根据任务标题中的关键词推断分类（category 只能是"工作"、"个人"、"家庭共享"）：
- 工作类关键词：会议、周会、汇报、项目、客户、合同、方案、报告、商务、面试、培训、工作
- 个人类关键词：健身、跑步、阅读、电影、音乐、游戏、休息、约会、个人事务
- 家庭共享类关键词：孩子、笑笑、宝宝、妙妙、儿子、女儿、家庭、做饭、购物、旅行、度假、约会、聚会、生日、纪念日、看病、体检、牙医、兴趣班、围棋、钢琴、舞蹈、补习、家务

【注意事项】
- 创建任务时统一使用 create_task，不需要区分 event
- 如果任务包含具体时间（start_date/start_time），系统会自动同步到日历
- 如果用户输入模糊，优先选择最可能的意图
- 置信度低于0.7时请设置needsConfirmation为true
- category 字段只能是"工作"、"个人"或"家庭共享"，默认"工作"`,

  userPromptTemplate: `用户输入：{user_input}

请以JSON格式返回：
{
  "intent": "create_task|query_tasks|query_events|update_task|complete_task|delete_task|expand_task|other",
  "entity_type": "task|event|calendar",
  "parameters": {},
  "confidence": 0.0-1.0,
  "needsConfirmation": true|false,
  "reasoning": "判断理由"
}`,

  examples: [
    {
      input: '帮我安排明天上午9点开会',
      output: {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '开会', start_date: '2026-05-06', start_time: '09:00', category: '工作' },
        confidence: 0.95,
        needsConfirmation: false,
        reasoning: '检测到具体时间，属于日程创建任务',
      },
    },
    {
      input: '妙妙的围棋课，每周六晚上6点到8点',
      output: {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '妙妙的围棋课', start_time: '18:00', end_time: '20:00', recurring: true, frequency: 'weekly', category: '家庭共享' },
        confidence: 0.95,
        needsConfirmation: false,
        reasoning: '检测到"妙妙"是家庭成员，"围棋课"是兴趣班，属于家庭共享日程',
      },
    },
    {
      input: '今天有什么任务',
      output: {
        intent: 'query_tasks',
        entity_type: 'task',
        parameters: { date: 'today' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '查询今天任务',
      },
    },
    {
      input: '今天怎么样？',
      output: {
        intent: 'query_events',
        entity_type: 'calendar',
        parameters: { date: 'today' },
        confidence: 0.85,
        needsConfirmation: false,
        reasoning: '用户询问今天的日程安排，属于日程查询',
      },
    },
    {
      input: '早上好，今天有什么安排？',
      output: {
        intent: 'query_events',
        entity_type: 'calendar',
        parameters: { date: 'today' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '早安问候+查询今日日程',
      },
    },
    {
      input: '创建任务',
      output: {
        intent: 'create_task',
        entity_type: 'task',
        parameters: {},
        confidence: 0.6,
        needsConfirmation: true,
        reasoning: '信息不足，需要确认任务详情',
      },
    },
  ],
};
