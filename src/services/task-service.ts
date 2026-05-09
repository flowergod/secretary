// 任务服务
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskStatus,
  TaskPriority,
  RecurrenceType,
  CreateTaskRequest,
  UpdateTaskRequest,
  ListTasksQuery,
  ListTasksResponse,
  TransitionTaskResponse,
  BatchDeleteTasksResponse,
  ApiResponse,
  ApiError,
} from '../shared/types';
import { feishuConnector } from '../connectors';
import { scheduleService } from './schedule-service';
import { logger } from '../shared/logger';

// 错误码
export const ErrorCodes = {
  TASK_NOT_FOUND: 2001,
  TASK_CREATE_FAILED: 2002,
  TASK_UPDATE_FAILED: 2003,
  TASK_DELETE_FAILED: 2004,
  TASK_INVALID_TRANSITION: 2005,
  TASK_COMPLETED_NOT_TRANSITIONABLE: 2006,
  FEISHU_API_ERROR: 1001,
  RECURRING_TASK_CREATE_FAILED: 2007,
  RECURRING_SERIES_DELETE_FAILED: 2008,
};

// 允许的状态转换
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'pending': ['in_progress', 'cancelled'],
  'in_progress': ['pending', 'cancelled'],
  'completed': [], // 不能从 completed 转换
  'cancelled': ['pending'], // 可以重新激活
};

export class TaskService {
  /**
   * 创建任务
   */
  async create(req: CreateTaskRequest): Promise<ApiResponse<Task> | ApiError> {
    try {
      const now = new Date().toISOString();
      const task: Task = {
        id: uuidv4(),
        title: req.title,
        description: req.description,
        status: 'pending',
        priority: req.priority || 'medium',
        category: req.category,
        due_date: req.due_date,
        start_date: req.start_date,
        start_time: req.start_time,
        end_time: req.end_time,
        is_recurring: req.is_recurring || false,
        recurrence_type: req.recurrence_type || 'none',
        recurrence_rule: req.recurrence_rule,
        icloud_event_id: req.icloud_event_id,
        parent_id: req.parent_id,
        source: req.source,
        created_at: now,
        updated_at: now,
      };

      const created = await feishuConnector.create(task);
      logger.info(`[TaskService] Created task: ${created.id}`);

      // 如果任务有 start_date，同步到 iCloud
      if (created.start_date) {
        const syncResult = await scheduleService.syncToICalendar(created);
        if (syncResult.success && syncResult.icloud_event_id) {
          // 更新 icloud_event_id
          await feishuConnector.update(created.id, {
            icloud_event_id: syncResult.icloud_event_id,
          });
          created.icloud_event_id = syncResult.icloud_event_id;
          logger.info(`[TaskService] Synced task ${created.id} to iCloud: ${syncResult.icloud_event_id}`);
        } else if (!syncResult.success) {
          logger.warn(`[TaskService] Failed to sync task ${created.id} to iCloud: ${syncResult.error}`);
        }
      }

      return { success: true, data: created };
    } catch (e) {
      logger.error(`[TaskService] Failed to create task:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_CREATE_FAILED,
          message: '任务创建失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 获取单个任务
   */
  async get(id: string): Promise<ApiResponse<Task> | ApiError> {
    try {
      const task = await feishuConnector.get(id);
      if (!task) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      return { success: true, data: task };
    } catch (e) {
      logger.error(`[TaskService] Failed to get task ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.FEISHU_API_ERROR,
          message: '获取任务失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 查询任务列表
   */
  async list(query: ListTasksQuery): Promise<ApiResponse<ListTasksResponse> | ApiError> {
    try {
      const page = Math.max(1, query.page || 1);
      const pageSize = Math.min(100, Math.max(1, query.page_size || 20));

      const result = await feishuConnector.list({
        status: query.status,
        priority: query.priority,
        category: query.category,
        due_date_from: query.due_date_from,
        due_date_to: query.due_date_to,
        start_date_from: query.start_date_from,
        start_date_to: query.start_date_to,
        is_recurring: query.is_recurring,
        parent_id: query.parent_id,
        page,
        page_size: pageSize,
      });

      const totalPages = Math.ceil(result.total / pageSize);

      // 排序
      let items = result.items;
      if (query.sort_by) {
        const sortKey = query.sort_by as keyof Task;
        const sortOrder = query.sort_order === 'asc' ? 1 : -1;
        items = items.sort((a, b) => {
          const aVal = a[sortKey] || '';
          const bVal = b[sortKey] || '';
          return aVal < bVal ? -sortOrder : aVal > bVal ? sortOrder : 0;
        });
      }

      return {
        success: true,
        data: {
          items,
          total: result.total,
          page,
          page_size: pageSize,
          total_pages: totalPages,
        },
      };
    } catch (e) {
      logger.error(`[TaskService] Failed to list tasks:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.FEISHU_API_ERROR,
          message: '查询任务列表失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 更新任务
   */
  async update(id: string, req: UpdateTaskRequest): Promise<ApiResponse<Task> | ApiError> {
    try {
      // 检查任务是否存在
      const existing = await feishuConnector.get(id);
      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      const updates: Partial<Task> = {
        ...req,
        updated_at: new Date().toISOString(),
      };

      const updated = await feishuConnector.update(id, updates);
      logger.info(`[TaskService] Updated task: ${id}`);

      // 如果任务有 start_date，同步到 iCloud
      // 但如果 category 发生了变化，应该由 CapabilityDispatcher.moveICloudEvent 处理，不在这里同步
      const categoryChanged = req.category && existing.category !== req.category;
      if (updated.start_date && !categoryChanged) {
        const syncResult = await scheduleService.syncToICalendar(updated);
        if (syncResult.success && syncResult.icloud_event_id && !updated.icloud_event_id) {
          // 新增了 icloud_event_id，需要更新回去
          await feishuConnector.update(id, {
            icloud_event_id: syncResult.icloud_event_id,
          });
          updated.icloud_event_id = syncResult.icloud_event_id;
        } else if (!syncResult.success) {
          logger.warn(`[TaskService] Failed to sync updated task ${id} to iCloud: ${syncResult.error}`);
        }
      } else if (categoryChanged) {
        logger.info(`[TaskService] Category changed, iCloud sync will be handled by CapabilityDispatcher`);
      }

      return { success: true, data: updated };
    } catch (e) {
      logger.error(`[TaskService] Failed to update task ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_UPDATE_FAILED,
          message: '任务更新失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 删除任务
   */
  async delete(id: string): Promise<ApiResponse<{ deleted: number }> | ApiError> {
    try {
      const existing = await feishuConnector.get(id);
      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      // 如果是循环任务（有 is_recurring 或有 parent_id），调用删除全系列
      if (existing.is_recurring || existing.parent_id) {
        logger.info(`[TaskService] Task ${id} is recurring, delegating to deleteRecurringSeries`);
        return this.deleteRecurringSeries(id);
      }

      // 优先使用record_id，否则用id
      const deleteId = existing.record_id || id;
      await feishuConnector.delete(deleteId);
      logger.info(`[TaskService] Deleted task: ${id}`);

      // 如果任务有 icloud_event_id，删除 iCloud 事件
      if (existing.icloud_event_id) {
        const deleteResult = await scheduleService.deleteFromICalendar(existing);
        if (deleteResult.success) {
          logger.info(`[TaskService] Deleted iCloud event: ${existing.icloud_event_id}`);
        } else {
          logger.warn(`[TaskService] Failed to delete iCloud event ${existing.icloud_event_id}: ${deleteResult.error}`);
        }
      }

      return { success: true, data: { deleted: 1 } };
    } catch (e) {
      logger.error(`[TaskService] Failed to delete task ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_DELETE_FAILED,
          message: '任务删除失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 删除循环任务全系列
   * 根据给定任务的 parent_id 找到所有关联的父子任务并删除
   * @param id 任意一个任务的ID（会自动查找全系列）
   */
  async deleteRecurringSeries(id: string): Promise<ApiResponse<{ deleted: number; seriesDeleted: number }> | ApiError> {
    try {
      const existing = await feishuConnector.get(id);
      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      // 确定系列根ID：如果有 parent_id，则是子任务，用 parent_id；否则用自己的 id
      const seriesRootId = existing.parent_id || existing.id;
      logger.info(`[TaskService] Deleting recurring series rooted at: ${seriesRootId}`);

      // 查询所有属于该系列的任务（包括父任务和所有子任务）
      const listResult = await feishuConnector.list({ page_size: 100 });
      const seriesTasks = listResult.items.filter(t =>
        t.id === seriesRootId || t.parent_id === seriesRootId || t.id === existing.parent_id
      );

      logger.info(`[TaskService] Found ${seriesTasks.length} tasks in series`);

      // 收集所有需要删除的任务ID
      const idsToDelete: string[] = [];
      const icloudEventIdsToDelete: string[] = [];

      for (const task of seriesTasks) {
        const deleteId = task.record_id || task.id;
        if (!idsToDelete.includes(deleteId)) {
          idsToDelete.push(deleteId);
        }
        if (task.icloud_event_id && !icloudEventIdsToDelete.includes(task.icloud_event_id)) {
          icloudEventIdsToDelete.push(task.icloud_event_id);
        }
      }

      // 删除 iCloud 事件（如果有的话）
      for (const icloudEventId of icloudEventIdsToDelete) {
        const taskWithEvent = seriesTasks.find(t => t.icloud_event_id === icloudEventId);
        if (taskWithEvent) {
          const deleteResult = await scheduleService.deleteFromICalendar(taskWithEvent);
          if (deleteResult.success) {
            logger.info(`[TaskService] Deleted iCloud event: ${icloudEventId}`);
          } else {
            logger.warn(`[TaskService] Failed to delete iCloud event ${icloudEventId}: ${deleteResult.error}`);
          }
        }
      }

      // 批量删除飞书任务
      let deletedCount = 0;
      for (const deleteId of idsToDelete) {
        try {
          await feishuConnector.delete(deleteId);
          deletedCount++;
        } catch (e) {
          logger.warn(`[TaskService] Failed to delete task ${deleteId}:`, e);
        }
      }

      logger.info(`[TaskService] Deleted recurring series: ${deletedCount} tasks, ${icloudEventIdsToDelete.length} iCloud events`);

      return {
        success: true,
        data: {
          deleted: deletedCount,
          seriesDeleted: seriesTasks.length,
        },
      };
    } catch (e) {
      logger.error(`[TaskService] Failed to delete recurring series ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.RECURRING_SERIES_DELETE_FAILED,
          message: '删除循环系列失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 批量删除任务
   */
  async batchDelete(ids: string[]): Promise<ApiResponse<BatchDeleteTasksResponse> | ApiError> {
    try {
      const result = await feishuConnector.batchDelete(ids);
      logger.info(`[TaskService] Batch deleted: ${result.deleted} succeeded, ${result.failed} failed`);

      return { success: true, data: result };
    } catch (e) {
      logger.error(`[TaskService] Failed to batch delete:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_DELETE_FAILED,
          message: '批量删除失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 计算下一次循环任务的日期
   */
  private calculateNextOccurrence(task: Task): Partial<Task> {
    const addDays = (dateStr: string, days: number): string => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    };

    const addMonths = (dateStr: string, months: number): string => {
      const date = new Date(dateStr);
      date.setMonth(date.getMonth() + months);
      return date.toISOString().split('T')[0];
    };

    const addYears = (dateStr: string, years: number): string => {
      const date = new Date(dateStr);
      date.setFullYear(date.getFullYear() + years);
      return date.toISOString().split('T')[0];
    };

    const updates: Partial<Task> = {};

    switch (task.recurrence_type) {
      case 'daily':
        if (task.due_date) updates.due_date = addDays(task.due_date, 1);
        if (task.start_date) updates.start_date = addDays(task.start_date, 1);
        break;

      case 'weekly':
        if (task.due_date) updates.due_date = addDays(task.due_date, 7);
        if (task.start_date) updates.start_date = addDays(task.start_date, 7);
        break;

      case 'weekly_n':
        // For weekly_n, we need to parse recurrence_rule to find the next occurrence
        const referenceDate = task.due_date || task.start_date;
        if (task.recurrence_rule && referenceDate) {
          // RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
          const bydayMatch = task.recurrence_rule.match(/BYDAY=([^;]+)/);
          if (bydayMatch) {
            const days = bydayMatch[1].split(',');
            const currentDate = new Date(referenceDate);
            // Find next occurrence day
            let nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            let attempts = 0;
            while (attempts < 14) { // Max 2 weeks to find next
              const dayName = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][nextDate.getDay()];
              if (days.includes(dayName)) {
                const daysDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
                if (task.due_date) updates.due_date = addDays(task.due_date, daysDiff);
                if (task.start_date) updates.start_date = addDays(task.start_date, daysDiff);
                break;
              }
              nextDate.setDate(nextDate.getDate() + 1);
              attempts++;
            }
          }
        } else {
          // Fallback to weekly
          if (task.due_date) updates.due_date = addDays(task.due_date, 7);
          if (task.start_date) updates.start_date = addDays(task.start_date, 7);
        }
        break;

      case 'monthly':
        if (task.due_date) updates.due_date = addMonths(task.due_date, 1);
        if (task.start_date) updates.start_date = addMonths(task.start_date, 1);
        break;

      case 'monthly_n':
        if (task.recurrence_rule && task.due_date) {
          // 解析RRULE获取精确的月循环规则
          // 格式: RRULE:FREQ=MONTHLY;BYDAY=1TU (第一个周二) 或 RRULE:FREQ=MONTHLY;BYMONTHDAY=15 (每月15号)
          const bydayMatch = task.recurrence_rule.match(/BYDAY=([^;]+)/);
          const bysetposMatch = task.recurrence_rule.match(/BYSETPOS=([^;]+)/);
          const bymonthdayMatch = task.recurrence_rule.match(/BYMONTHDAY=([^;]+)/);

          if (bydayMatch && bysetposMatch) {
            // 格式: BYDAY=1TU 表示每月第一个周二
            const dayOrder = parseInt(bydayMatch[1].charAt(0)); // 1, 2, 3, 4 或 -1
            const dayName = bydayMatch[1].substring(1); // TU, WE, etc.
            const dayMap: Record<string, number> = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
            const targetDay = dayMap[dayName];
            const currentDate = new Date(task.due_date);
            let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            let found = false;
            for (let pos = 1; pos <= 4 || !found; pos++) {
              const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
              let targetDate: number;
              if (dayOrder === -1) {
                // 最后一个
                targetDate = lastDayOfMonth;
              } else {
                targetDate = Math.min(pos, lastDayOfMonth);
              }
              const checkDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), targetDate);
              if (checkDate.getDay() === targetDay) {
                if (dayOrder === -1 || pos === dayOrder) {
                  updates.due_date = checkDate.toISOString().split('T')[0];
                  found = true;
                }
              }
              if (pos >= 4 && !found) found = true;
            }
          } else if (bymonthdayMatch) {
            // 格式: BYMONTHDAY=15 表示每月15号
            const targetDayOfMonth = parseInt(bymonthdayMatch[1]);
            const currentDate = new Date(task.due_date);
            let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            const targetDate = Math.min(targetDayOfMonth, lastDayOfMonth);
            updates.due_date = new Date(nextDate.getFullYear(), nextDate.getMonth(), targetDate).toISOString().split('T')[0];
          } else {
            // 没有精确规则，默认每月同一天
            if (task.due_date) updates.due_date = addMonths(task.due_date, 1);
            if (task.start_date) updates.start_date = addMonths(task.start_date, 1);
          }
        } else {
          // 默认每月同一天
          if (task.due_date) updates.due_date = addMonths(task.due_date, 1);
          if (task.start_date) updates.start_date = addMonths(task.start_date, 1);
        }
        break;

      case 'yearly':
        if (task.due_date) updates.due_date = addYears(task.due_date, 1);
        if (task.start_date) updates.start_date = addYears(task.start_date, 1);
        break;

      case 'yearly_n':
        if (task.recurrence_rule && task.due_date) {
          // 解析RRULE获取精确的年循环规则
          // 格式: RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15 (每年3月15日)
          const bymonthMatch = task.recurrence_rule.match(/BYMONTH=([^;]+)/);
          const bymonthdayMatch = task.recurrence_rule.match(/BYMONTHDAY=([^;]+)/);

          if (bymonthMatch && bymonthdayMatch) {
            const targetMonth = parseInt(bymonthMatch[1]);
            const targetDay = parseInt(bymonthdayMatch[1]);
            const currentDate = new Date(task.due_date);
            let nextDate = new Date(currentDate.getFullYear() + 1, targetMonth - 1, 1);
            const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            updates.due_date = new Date(nextDate.getFullYear(), nextDate.getMonth(), Math.min(targetDay, lastDayOfMonth)).toISOString().split('T')[0];
          } else {
            // 没有精确规则，默认每年同日期
            if (task.due_date) updates.due_date = addYears(task.due_date, 1);
            if (task.start_date) updates.start_date = addYears(task.start_date, 1);
          }
        } else {
          // 默认每年同日期
          if (task.due_date) updates.due_date = addYears(task.due_date, 1);
          if (task.start_date) updates.start_date = addYears(task.start_date, 1);
        }
        break;

      case 'none':
      default:
        // No recurrence, do nothing
        break;
    }

    return updates;
  }

  /**
   * 完成任务（如果是循环任务，创建下一个循环实例）
   */
  async complete(id: string): Promise<ApiResponse<Task> | ApiError> {
    try {
      const task = await feishuConnector.get(id);
      if (!task) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      // 更新当前任务为已完成
      const updated = await feishuConnector.update(id, {
        status: 'completed',
        updated_at: new Date().toISOString(),
      });

      logger.info(`[TaskService] Task ${id} completed`);

      // 如果是循环任务，创建下一个循环实例
      if (task.is_recurring && task.recurrence_type !== 'none') {
        const nextOccurrence = this.calculateNextOccurrence(task);
        // 即使没有due_date和start_date，也应该创建下一个循环实例（如果没有日期信息，则只继承原任务属性）
        const now = new Date().toISOString();
        const newTask: Task = {
          id: uuidv4(),
          title: task.title,
          description: task.description,
          status: 'pending',
          priority: task.priority,
          category: task.category,
          due_date: nextOccurrence.due_date || task.due_date,
          start_date: nextOccurrence.start_date || task.start_date,
          start_time: task.start_time,
          end_time: task.end_time,
          is_recurring: task.is_recurring,
          recurrence_type: task.recurrence_type,
          recurrence_rule: task.recurrence_rule,
          // 不复制icloud_event_id，让新任务创建新的iCloud事件
          parent_id: task.parent_id || task.id, // 指向原始父任务
          source: task.source,
          created_at: now,
          updated_at: now,
        };

        const created = await feishuConnector.create(newTask);
        logger.info(`[TaskService] Created next recurring task: ${created.id} for parent: ${task.id}`);

        // 如果新任务有 start_date，同步到 iCloud
        if (created.start_date) {
          const syncResult = await scheduleService.syncToICalendar(created);
          if (syncResult.success && syncResult.icloud_event_id) {
            await feishuConnector.update(created.id, {
              icloud_event_id: syncResult.icloud_event_id,
            });
            logger.info(`[TaskService] Synced recurring task ${created.id} to iCloud: ${syncResult.icloud_event_id}`);
          } else if (!syncResult.success) {
            logger.warn(`[TaskService] Failed to sync recurring task ${created.id} to iCloud: ${syncResult.error}`);
          }
        }
      }

      return { success: true, data: updated };
    } catch (e) {
      logger.error(`[TaskService] Failed to complete task ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_UPDATE_FAILED,
          message: '任务完成失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  /**
   * 状态变更（除完成外的状态变更）
   */
  async transition(id: string, toStatus: TaskStatus): Promise<ApiResponse<TransitionTaskResponse> | ApiError> {
    try {
      const task = await feishuConnector.get(id);
      if (!task) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_NOT_FOUND,
            message: '任务不存在',
            details: `Task with id ${id} not found`,
          },
        };
      }

      const fromStatus = task.status;

      // 检查是否是已完成状态
      if (fromStatus === 'completed') {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_COMPLETED_NOT_TRANSITIONABLE,
            message: '已完成任务不能通过此接口变更状态',
            details: 'Use the complete endpoint to update completed tasks',
          },
        };
      }

      // 检查是否允许此转换
      const allowedTargets = ALLOWED_TRANSITIONS[fromStatus];
      if (!allowedTargets || !allowedTargets.includes(toStatus)) {
        return {
          success: false,
          error: {
            code: ErrorCodes.TASK_INVALID_TRANSITION,
            message: `非法的状态转换：从 ${fromStatus} 到 ${toStatus} 不被允许`,
            details: `Allowed transitions from ${fromStatus}: ${allowedTargets?.join(', ') || 'none'}`,
          },
        };
      }

      // 执行转换
      const updated = await feishuConnector.update(id, {
        status: toStatus,
        updated_at: new Date().toISOString(),
      });

      logger.info(`[TaskService] Task ${id} transitioned: ${fromStatus} -> ${toStatus}`);

      return {
        success: true,
        data: {
          task: updated,
          from_status: fromStatus,
          to_status: toStatus,
          transitioned_at: updated.updated_at,
        },
      };
    } catch (e) {
      logger.error(`[TaskService] Failed to transition task ${id}:`, e);
      return {
        success: false,
        error: {
          code: ErrorCodes.TASK_UPDATE_FAILED,
          message: '状态变更失败',
          details: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }
}

export const taskService = new TaskService();
