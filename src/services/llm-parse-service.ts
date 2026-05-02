// LLM 自然语言解析服务
// 当规则解析无法处理时，调用大模型进行解析
// 并从成功的解析中学习规则

import { ParsedIntent, TaskEntity, ActionType, EntityType, Priority, RecurrenceType, NLParseConfig } from '../shared/types';
import { aiRouter } from '../ai/router';
import { configManager } from '../shared/config';
import * as fs from 'fs';
import * as path from 'path';

// 获取当前年份
const CURRENT_YEAR = new Date().getFullYear();

interface LearnedRule {
  pattern: string;        // 匹配模式（简化正则）
  action: ActionType;
  entityType: EntityType;
  priority: Priority;
  keywords: string[];     // 触发关键词
  calendarCategory?: string;
  recurrenceType?: RecurrenceType;
  confidence: number;    // 置信度
  useCount: number;       // 使用次数
  lastUsed: string;       // 最后使用时间
}

interface LLMParseResult {
  success: boolean;
  intent?: ParsedIntent;
  confidence: number;     // 0-1
  reasoning?: string;
  learnedRule?: Partial<LearnedRule>;  // 从这次解析中学到的规则
}

// LLM 解析的系统提示
const LLM_PARSE_SYSTEM_PROMPT = `你是任务解析专家，负责将用户输入解析为结构化任务。

## 你的任务
分析用户输入，提取意图和实体，输出结构化的任务信息。

## 支持的操作类型
- create: 创建新任务/日程
- update: 更新现有任务/日程
- delete: 删除任务/日程
- complete: 标记任务完成
- query: 查询任务/日程
- search: 搜索任务

## 支持的实体类型
- task: 普通任务
- event: 日程/会议（有明确时间）
- project: 项目

## 优先级（必须使用中文）
- 高: 紧急、重要的事情
- 中: 普通优先级
- 低: 不紧急、可延后

## 循环类型
- none: 不循环
- weekly: 每周循环
- weekly_monday ~ weekly_sunday: 每周特定星期几
- monthly: 每月循环
- after_complete: 完成后触发

## 日历分类
- 工作: 开会、会议、项目、报告、商务等
- 个人: 运动、读书、朋友聚会等
- 家庭共享: 孩子、家庭、医生等

## 输出格式
请输出JSON格式（不要包含其他内容）：
{
  "action": "create|update|delete|complete|query|search",
  "entityType": "task|event|project",
  "title": "任务标题（提取核心内容，移除时间前缀）",
  "priority": "高|中|低",
  "startDate": "YYYY-MM-DD（如果能从相对时间计算，如"下周一"→具体日期）",
  "startTime": "HH:mm（如10:00）",
  "endTime": "HH:mm（如11:30）",
  "isRecurring": true|false,
  "recurrenceType": "none|weekly|weekly_monday|...",
  "calendarCategory": "工作|个人|家庭共享",
  "group": "日程表|其他",
  "confidence": 0.0-1.0,
  "reasoning": "解析思路说明"
}

## 示例
输入: "每周五下午3点开会讨论项目"
输出: {
  "action": "create",
  "entityType": "event",
  "title": "开会讨论项目",
  "priority": "高",
  "startTime": "15:00",
  "isRecurring": true,
  "recurrenceType": "weekly_friday",
  "calendarCategory": "工作",
  "confidence": 0.95,
  "reasoning": "检测到每周五循环，有明确时间15:00，分类为工作"
}

输入: "帮我安排下周出差"
输出: {
  "action": "create",
  "entityType": "task",
  "title": "出差",
  "priority": "中",
  "startDate": "2026-05-11（计算出的下周一的日期）",
  "isRecurring": false,
  "calendarCategory": "工作",
  "confidence": 0.85,
  "reasoning": "检测到创建动作，有明确时间下周，出差属于工作相关"
}`;

export class LLMParseService {
  private config: NLParseConfig;
  private learnedRulesPath: string;
  private learnedRules: Map<string, LearnedRule> = new Map();

  constructor() {
    const appConfig = configManager.get();
    this.config = appConfig.nlParse || {
      enabled: true,
      fallbackThreshold: 0.5,
      learnFromSuccess: true,
      maxRetries: 2,
    };
    this.learnedRulesPath = path.join(process.cwd(), 'data', 'learned-rules.json');
    this.loadLearnedRules();
  }

  /**
   * 解析用户输入
   * @param input 用户输入
   * @param context 上下文信息（可选）
   */
  async parse(input: string, context?: { recentTasks?: string[] }): Promise<LLMParseResult> {
    try {
      // 构建提示词
      const userPrompt = this.buildUserPrompt(input, context);

      // 调用 LLM
      const response = await aiRouter.chat({
        messages: [
          { role: 'system', content: LLM_PARSE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,  // 低温度保证一致性
        maxTokens: 500,
      });

      // 解析 LLM 返回
      const result = this.parseLLMResponse(response.content);

      if (result.success && result.intent) {
        // 学习成功解析的规则
        if (this.config.learnFromSuccess && result.confidence > 0.8) {
          this.learnFromSuccess(input, result.intent);
        }
      }

      return result;
    } catch (error) {
      console.error('[LLMParseService] LLM parsing failed:', error);
      return { success: false, confidence: 0 };
    }
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(input: string, context?: { recentTasks?: string[] }): string {
    let prompt = `请解析以下用户输入：\n"${input}"`;
    prompt += `\n\n【重要】当前年份是 ${CURRENT_YEAR} 年。解析日期时，如果用户只说"5月9日"而没有指定年份，默认就是 ${CURRENT_YEAR} 年（如"5月9日"应解析为 "${CURRENT_YEAR}-05-09"）。`;

    if (context?.recentTasks && context.recentTasks.length > 0) {
      prompt += `\n\n参考信息（用户最近的任务，可帮助理解上下文）：`;
      context.recentTasks.slice(0, 5).forEach((task, i) => {
        prompt += `\n${i + 1}. ${task}`;
      });
    }

    prompt += `\n\n请直接输出JSON，不要包含其他内容。`;

    return prompt;
  }

  /**
   * 解析 LLM 返回的 JSON
   */
  private parseLLMResponse(content: string): LLMParseResult {
    try {
      // 提取 JSON
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      const intent: ParsedIntent = {
        action: this.normalizeAction(parsed.action),
        entityType: this.normalizeEntityType(parsed.entityType),
        entity: {
          type: this.normalizeEntityType(parsed.entityType),
          title: parsed.title || '未命名',
          priority: this.normalizePriority(parsed.priority),
          start_date: parsed.startDate,
          start_time: parsed.startTime,
          end_time: parsed.endTime,
          is_recurring: parsed.isRecurring || false,
          recurrence_type: this.normalizeRecurrenceType(parsed.recurrenceType),
          calendar_category: parsed.calendarCategory,
          group: this.normalizeGroup(parsed.group),
        },
      };

      return {
        success: true,
        intent,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error('[LLMParseService] Failed to parse LLM response:', error);
      return { success: false, confidence: 0 };
    }
  }

  /**
   * 规范化动作类型
   */
  private normalizeAction(action: string): ActionType {
    const actionMap: Record<string, ActionType> = {
      'create': 'create',
      '新建': 'create',
      '添加': 'create',
      'update': 'update',
      '修改': 'update',
      '更新': 'update',
      'delete': 'delete',
      '删除': 'delete',
      'complete': 'complete',
      '完成': 'complete',
      'query': 'query',
      '查询': 'query',
      'search': 'search',
      '搜索': 'search',
    };
    return actionMap[action?.toLowerCase()] || 'create';
  }

  /**
   * 规范化实体类型
   */
  private normalizeEntityType(type: string): EntityType {
    const typeMap: Record<string, EntityType> = {
      'task': 'task',
      '任务': 'task',
      'event': 'event',
      '日程': 'event',
      '会议': 'event',
      'project': 'project',
      '项目': 'project',
    };
    return typeMap[type?.toLowerCase()] || 'task';
  }

  /**
   * 规范化优先级
   */
  private normalizePriority(priority: string): Priority {
    const priorityMap: Record<string, Priority> = {
      '高': '高',
      '高优先级': '高',
      '重要': '高',
      '紧急': '高',
      '中': '中',
      '中优先级': '中',
      '普通': '中',
      '低': '低',
      '低优先级': '低',
      '不急': '低',
    };
    return priorityMap[priority] || '中';
  }

  /**
   * 规范化循环类型
   */
  private normalizeRecurrenceType(type: string | undefined): RecurrenceType {
    if (!type || type === 'none' || type === '不循环') {
      return 'none';
    }
    const typeMap: Record<string, RecurrenceType> = {
      'weekly': 'weekly',
      'weekly_monday': 'weekly_monday',
      'weekly_tuesday': 'weekly_tuesday',
      'weekly_wednesday': 'weekly_wednesday',
      'weekly_thursday': 'weekly_thursday',
      'weekly_friday': 'weekly_friday',
      'weekly_saturday': 'weekly_saturday',
      'weekly_sunday': 'weekly_sunday',
      'monthly': 'monthly',
      'after_complete': 'after_complete',
    };
    return typeMap[type.toLowerCase()] || 'weekly';
  }

  /**
   * 规范化分组
   */
  private normalizeGroup(group: string | undefined): '日程表' | '其他' | '工作' | '生活' | '个人' | undefined {
    const groupMap: Record<string, '日程表' | '其他' | '工作' | '生活' | '个人'> = {
      '日程表': '日程表',
      '其他': '其他',
      '工作': '工作',
      '生活': '生活',
      '个人': '个人',
    };
    return group ? (groupMap[group] || '其他') : undefined;
  }

  /**
   * 从成功的解析中学习规则
   */
  private learnFromSuccess(input: string, intent: ParsedIntent): void {
    // 提取关键词（简化处理：取输入的前10个字符作为模式）
    const pattern = this.extractPattern(input);
    const key = this.generateRuleKey(input);

    const rule: LearnedRule = {
      pattern,
      action: intent.action,
      entityType: intent.entityType,
      priority: intent.entity.priority || '中',
      keywords: this.extractKeywords(input),
      calendarCategory: intent.entity.calendar_category,
      recurrenceType: intent.entity.recurrence_type,
      confidence: 0.9,  // LLM 解析的初始置信度
      useCount: 0,
      lastUsed: new Date().toISOString(),
    };

    this.learnedRules.set(key, rule);
    this.saveLearnedRules();

    console.log(`[LLMParseService] Learned rule: ${key}`);
  }

  /**
   * 提取模式（简化实现）
   */
  private extractPattern(input: string): string {
    // 取输入的前20个字符作为模式标识
    return input.slice(0, 20);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(input: string): string[] {
    // 简单分词：按标点和空格分割
    const words = input.split(/[,，。、；;\s]+/).filter(w => w.length > 1);
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * 生成规则唯一标识
   */
  private generateRuleKey(input: string): string {
    // 使用输入的hash作为key
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `rule_${Math.abs(hash).toString(16)}`;
  }

  /**
   * 检查是否有已学习的规则匹配
   */
  checkLearnedRules(input: string): LearnedRule | undefined {
    for (const [key, rule] of this.learnedRules.entries()) {
      // 简单匹配：检查关键词
      const matchCount = rule.keywords.filter(kw => input.includes(kw)).length;
      if (matchCount >= Math.min(2, rule.keywords.length)) {
        // 更新使用统计
        rule.useCount++;
        rule.lastUsed = new Date().toISOString();
        return rule;
      }
    }
    return undefined;
  }

  /**
   * 获取学习到的规则数量
   */
  getLearnedRulesCount(): number {
    return this.learnedRules.size;
  }

  /**
   * 加载已学习的规则
   */
  private loadLearnedRules(): void {
    try {
      if (fs.existsSync(this.learnedRulesPath)) {
        const data = JSON.parse(fs.readFileSync(this.learnedRulesPath, 'utf-8'));
        for (const [key, rule] of Object.entries(data)) {
          this.learnedRules.set(key, rule as LearnedRule);
        }
        console.log(`[LLMParseService] Loaded ${this.learnedRules.size} learned rules`);
      }
    } catch (error) {
      console.error('[LLMParseService] Failed to load learned rules:', error);
    }
  }

  /**
   * 保存已学习的规则
   */
  private saveLearnedRules(): void {
    try {
      const data = Object.fromEntries(this.learnedRules);
      const dir = path.dirname(this.learnedRulesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.learnedRulesPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[LLMParseService] Failed to save learned rules:', error);
    }
  }
}

export const llmParseService = new LLMParseService();
