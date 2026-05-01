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
      priority: intent.entity.priority || 'medium',
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
    });

    // 检查是否有基于完成时间的循环任务需要创建
    if (task.recurrence_type === 'after_complete' && task.recurrence_rule) {
      const daysAfter = task.recurrence_rule.days_after || 90;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + daysAfter);

      // 创建下一个循环任务
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