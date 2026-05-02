// 任务服务
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';
import { expansionEngine } from '../engine/expansion';

export interface CreateTaskResult {
  task: TaskEntity;
  expansionSuggestion?: string;
}

export class TaskService {
  /**
   * 创建任务
   */
  async createTask(intent: ParsedIntent): Promise<CreateTaskResult> {
    const now = new Date().toISOString();
    const task: TaskEntity = {
      id: uuidv4(),
      type: intent.entityType || 'task',
      title: intent.entity.title || '未命名任务',
      description: intent.entity.description,
      status: 'pending',
      priority: intent.entity.priority || '中',
      due_date: intent.entity.due_date,
      start_date: intent.entity.start_date,
      start_time: intent.entity.start_time,
      is_recurring: intent.entity.is_recurring || false,
      recurrence_type: intent.entity.recurrence_type,
      recurrence_rule: intent.entity.recurrence_rule,
      parent_id: intent.entity.parent_id,
      project_id: intent.entity.project_id,
      needs_expansion: intent.needsExpansion || false,
      expansion_type: intent.expansionType,
      created_at: now,
      updated_at: now,
    };

    const created = await feishuConnector.create(task);

    // 检查是否需要智能拓展
    let expansionSuggestion: string | undefined;
    if (intent.needsExpansion) {
      const expansion = await expansionEngine.shouldExpand(created);
      if (expansion.shouldExpand && expansion.tasks.length > 0) {
        expansionSuggestion = expansion.reasoning
          ? `是否需要我帮你${expansion.reasoning}？`
          : '是否需要我帮你规划后续步骤？';
      }
    }

    return { task: created, expansionSuggestion };
  }

  /**
   * 计算循环任务的下次发生日期
   */
  private calculateNextOccurrence(recurrenceType: string, recurrenceRule: string | undefined, currentDate: Date): Date | null {
    const next = new Date(currentDate);

    // 解析循环规则中的星期几
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

    // 根据 recurrenceType 或 recurrenceRule 确定周期
    if (recurrenceType === '每周一' || (recurrenceRule && recurrenceRule.includes('MO'))) {
      next.setDate(next.getDate() + ((1 - next.getDay() + 7) % 7 || 7));
    } else if (recurrenceType === '每周五' || (recurrenceRule && recurrenceRule.includes('FR'))) {
      next.setDate(next.getDate() + ((5 - next.getDay() + 7) % 7 || 7));
    } else if (recurrenceType === '每周' || recurrenceType === 'weekly') {
      // 从 recurrenceRule 解析星期几，或默认加7天
      if (recurrenceRule) {
        const match = recurrenceRule.match(/BYDAY=([A-Z]{2})/);
        if (match && dayMap[match[1]] !== undefined) {
          const targetDay = dayMap[match[1]];
          next.setDate(next.getDate() + ((targetDay - next.getDay() + 7) % 7 || 7));
        } else {
          next.setDate(next.getDate() + 7);
        }
      } else {
        next.setDate(next.getDate() + 7);
      }
    } else if (recurrenceType === '每月' || recurrenceType === 'monthly') {
      // 下个月同一日
      next.setMonth(next.getMonth() + 1);
    } else if (recurrenceType === 'after_complete' || recurrenceType === 'after_complete') {
      // 基于完成时间的循环，由调用方处理
      return null;
    } else if (recurrenceType === '不循环' || recurrenceType === 'none' || recurrenceType === '不循环') {
      return null;
    } else {
      // 默认加7天
      next.setDate(next.getDate() + 7);
    }

    // 确保日期是未来
    if (next.getTime() <= currentDate.getTime()) {
      next.setDate(next.getDate() + 7);
    }

    return next;
  }

  /**
   * 创建循环任务的下次发生
   */
  private async createNextOccurrence(task: TaskEntity): Promise<void> {
    const recurrenceType = task.recurrence_type as string;
    const recurrenceRule = task.recurrence_rule as string | undefined;

    // 不处理 after_complete 类型（由完成时处理）
    if (recurrenceType === 'after_complete' || recurrenceType === 'after_complete') {
      return;
    }

    // 不处理非循环任务
    if (!task.is_recurring || !recurrenceType ||
        recurrenceType === '不循环' || recurrenceType === 'none') {
      return;
    }

    const nextDate = this.calculateNextOccurrence(recurrenceType, recurrenceRule, new Date());
    if (!nextDate) return;

    const nextTaskIntent: ParsedIntent = {
      action: 'create',
      entityType: 'task',
      entity: {
        title: task.title,
        status: 'pending',
        priority: task.priority,
        start_date: nextDate.toISOString().split('T')[0],
        is_recurring: task.is_recurring,
        recurrence_type: recurrenceType as any,
        recurrence_rule: task.recurrence_rule,
        parent_id: task.parent_id,
        project_name: task.project_name,
        description: task.description,
      },
    };

    await this.createTask(nextTaskIntent);
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string): Promise<TaskEntity> {
    const task = await feishuConnector.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated = await feishuConnector.update(taskId, {
      status: 'completed',
      completion_date: new Date().toISOString(),
      completion_count: (task.completion_count || 0) + 1,
    });

    // 处理基于完成时间的循环任务
    if (task.recurrence_type === 'after_complete' && task.recurrence_rule) {
      const daysAfter = (task.recurrence_rule as unknown as { days_after?: number }).days_after || 90;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + daysAfter);

      const nextTaskIntent: ParsedIntent = {
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
      };

      await this.createTask(nextTaskIntent);
    } else if (task.is_recurring && task.recurrence_type) {
      // 处理时间循环任务（每周、每月等）
      await this.createNextOccurrence(task);
    }

    return updated;
  }

  /**
   * 更新任务
   */
  async updateTask(taskId: string, updates: Partial<TaskEntity>): Promise<TaskEntity> {
    return feishuConnector.update(taskId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    return feishuConnector.delete(taskId);
  }

  /**
   * 查询任务列表
   */
  async queryTasks(filter: {
    status?: string;
    priority?: string;
    start_date?: string;
    due_date?: string;
  }): Promise<TaskEntity[]> {
    return feishuConnector.query({ ...filter, type: 'task' });
  }

  /**
   * 根据标题查找任务
   */
  async findTaskByTitle(title: string): Promise<TaskEntity | null> {
    const results = await feishuConnector.search(title);
    return results.find(r => r.title === title && r.type === 'task') || null;
  }
}

export const taskService = new TaskService();