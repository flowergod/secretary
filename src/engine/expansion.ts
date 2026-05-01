// 智能拓展引擎
import { TaskEntity } from '../shared/types';
import { aiRouter } from '../ai/router';

export interface ExpansionResult {
  shouldExpand: boolean;
  tasks: Partial<TaskEntity>[];
  reasoning?: string;
}

interface ExpansionTemplate {
  pattern: RegExp;
  type: string;
  generate: (task: TaskEntity) => Promise<ExpansionResult>;
}

export class ExpansionEngine {
  private templates: ExpansionTemplate[] = [
    {
      pattern: /医生|体检|复查|检查/,
      type: 'medical_followup',
      generate: this.generateMedicalFollowup.bind(this),
    },
    {
      pattern: /需求|产品/,
      type: 'development_planning',
      generate: this.generateDevelopmentPlanning.bind(this),
    },
  ];

  /**
   * 判断是否需要智能拓展
   */
  async shouldExpand(task: TaskEntity): Promise<ExpansionResult> {
    if (!task.needs_expansion || !task.expansion_type) {
      return { shouldExpand: false, tasks: [] };
    }

    for (const template of this.templates) {
      if (template.type === task.expansion_type && template.pattern.test(task.title)) {
        return template.generate(task);
      }
    }

    // 默认拓展逻辑
    return this.generateDefaultExpansion(task);
  }

  /**
   * 医疗复查拓展 - 3个月后提醒
   */
  private async generateMedicalFollowup(task: TaskEntity): Promise<ExpansionResult> {
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

  /**
   * 开发进度规划拓展
   */
  private async generateDevelopmentPlanning(task: TaskEntity): Promise<ExpansionResult> {
    const prompt = `基于任务"${task.title}"，请规划其后续开发步骤。
请返回一个JSON格式的数组，每个步骤包含：title（标题）、priority（high/medium/low）、days（预计天数）。

只返回JSON数组，不要其他内容。格式示例：
[
  {"title": "完成技术方案设计", "priority": "high", "days": 2},
  {"title": "开发核心功能", "priority": "high", "days": 5},
  {"title": "编写单元测试", "priority": "medium", "days": 2},
  {"title": "集成测试", "priority": "medium", "days": 1}
]`;

    try {
      const response = await aiRouter.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const tasks = this.parseTasksFromResponse(response.content, task.id);
      return {
        shouldExpand: true,
        tasks,
        reasoning: '已自动规划开发步骤',
      };
    } catch (error) {
      console.error('[ExpansionEngine] Failed to generate development planning:', error);
      return { shouldExpand: false, tasks: [] };
    }
  }

  /**
   * 默认拓展逻辑
   */
  private async generateDefaultExpansion(task: TaskEntity): Promise<ExpansionResult> {
    const prompt = `任务"${task.title}"是一个${task.type}类型的事项。
请判断是否需要创建相关的后续任务。如果需要，返回一个JSON数组，每个任务包含：title（标题）、priority（high/medium/low）。
如果不需要拓展，返回空数组[]。

只返回JSON，不要其他内容。`;

    try {
      const response = await aiRouter.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 500,
      });

      const tasks = this.parseTasksFromResponse(response.content, task.id);
      return {
        shouldExpand: tasks.length > 0,
        tasks,
        reasoning: tasks.length > 0 ? '已自动建议相关任务' : '暂无相关建议',
      };
    } catch (error) {
      console.error('[ExpansionEngine] Failed to generate default expansion:', error);
      return { shouldExpand: false, tasks: [] };
    }
  }

  /**
   * 解析 AI 返回的任务列表
   */
  private parseTasksFromResponse(content: string, parentId: string): Partial<TaskEntity>[] {
    try {
      // 尝试提取 JSON 数组
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const tasks = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(tasks)) {
        return [];
      }

      return tasks.map((t: { title: string; priority?: string; days?: number }) => ({
        title: t.title,
        priority: (t.priority || 'medium') as TaskEntity['priority'],
        status: 'pending' as const,
        is_recurring: false,
        parent_id: parentId,
      }));
    } catch (error) {
      console.error('[ExpansionEngine] Failed to parse tasks from response:', error);
      return [];
    }
  }
}

export const expansionEngine = new ExpansionEngine();