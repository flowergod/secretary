// Schedule Service - 任务与 iCloud 日历同步服务
import { Task } from '../shared/types';
import { icloudConnector, ICloudEvent } from '../connectors/icloud';
import { feishuConnector } from '../connectors/feishu';
import { logger } from '../shared';

// 默认分类
const DEFAULT_CATEGORY = '工作';

export interface SyncResult {
  success: boolean;
  icloud_event_id?: string;
  error?: string;
}

export interface CalendarQuery {
  date?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface CalendarEvent {
  id: string;
  icloud_event_id: string;
  title: string;
  description?: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  category?: string;
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_rule?: string;
  icloud_sync_status: 'synced' | 'pending' | 'error';
}

export class ScheduleService {
  /**
   * 同步任务到 iCloud（日程创建/更新）
   * 当任务包含 start_date 时，视为日程，需同步至 iCloud
   */
  async syncToICalendar(task: Task): Promise<SyncResult> {
    // 无 start_date 不需要同步
    if (!task.start_date) {
      logger.debug(`[ScheduleService] Task ${task.id} has no start_date, skipping iCloud sync`);
      return { success: true };
    }

    // 循环任务的子任务（parent_id 存在）不创建 iCloud 事件
    // 父任务的 RRULE 会自动生成后续实例
    if (task.is_recurring && task.parent_id) {
      logger.debug(`[ScheduleService] Task ${task.id} is a recurring child task (parent_id=${task.parent_id}), skipping iCloud sync`);
      return { success: true };
    }

    try {
      // 获取日历 ID
      const calendarId = this.getCalendarId(task.category);
      if (!calendarId) {
        return { success: false, error: `Unknown category: ${task.category}` };
      }

      // 构建 iCloud 事件
      // 如果有 recurring 但没有 recurrence_rule，根据 recurrence_type 生成默认 RRULE
      let recurrenceRule = task.recurrence_rule;
      let finalStartDate = task.start_date;

      if (task.is_recurring && !recurrenceRule && task.recurrence_type && task.recurrence_type !== 'none') {
        // 根据 start_date 生成默认 RRULE
        recurrenceRule = this.generateDefaultRrule(task.recurrence_type, task.start_date, task.start_time);
        logger.debug(`[ScheduleService] Auto-generated RRULE: ${recurrenceRule} for recurrence_type: ${task.recurrence_type}`);
      }

      // 如果用户提供了 recurrence_rule，检查 start_date 与 BYDAY 是否一致
      if (recurrenceRule && task.start_date) {
        const bydayMatch = recurrenceRule.match(/BYDAY=([^;]+)/);
        if (bydayMatch) {
          const dayMap: Record<string, number> = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
          const targetDays = bydayMatch[1].split(',').map(d => dayMap[d]).filter(d => d !== undefined);
          if (targetDays.length > 0) {
            const currentDay = new Date(task.start_date).getDay();
            if (!targetDays.includes(currentDay)) {
              // start_date 与 BYDAY 不一致，找到下一个匹配的日期
              let nextDate = new Date(task.start_date);
              for (let i = 0; i < 14; i++) {
                nextDate.setDate(nextDate.getDate() + 1);
                if (targetDays.includes(nextDate.getDay())) {
                  finalStartDate = nextDate.toISOString().split('T')[0];
                  logger.info(`[ScheduleService] Corrected start_date from ${task.start_date} to ${finalStartDate} to match RRULE BYDAY`);
                  break;
                }
              }
            }
          }
        }
      }

      const event: ICloudEvent = {
        uid: task.icloud_event_id,
        title: task.title,
        description: task.description,
        startDate: finalStartDate,
        startTime: task.start_time,
        endDate: task.end_time ? finalStartDate : undefined, // 跨日处理
        endTime: task.end_time,
        calendarId,
        recurrenceRule,
      };

      let icloudEventId: string;

      if (task.icloud_event_id) {
        // 已有 icloud_event_id，执行更新
        logger.info(`[ScheduleService] Updating iCloud event: ${task.icloud_event_id}`);
        await icloudConnector.updateEvent(task.icloud_event_id, event);
        icloudEventId = task.icloud_event_id;
      } else {
        // 无 icloud_event_id，执行创建
        logger.info(`[ScheduleService] Creating iCloud event for task: ${task.id}`);
        icloudEventId = await icloudConnector.createEvent(event);
      }

      return { success: true, icloud_event_id: icloudEventId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ScheduleService] Sync to iCloud failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 从 iCloud 同步到飞书
   */
  async syncFromICalendar(
    calendarId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ synced: number; created: number; updated: number; errors: string[] }> {
    const result = { synced: 0, created: 0, updated: 0, errors: [] as string[] };

    // 确定要同步的日历
    const targetCalendarIds = calendarId
      ? [calendarId]
      : Object.values(icloudConnector.calendarMapping || {}).filter(Boolean);

    for (const calId of targetCalendarIds) {
      try {
        const events = await icloudConnector.queryEvents(calId, startDate, endDate);
        logger.info(`[ScheduleService] Found ${events.length} events in calendar ${calId}`);

        for (const event of events) {
          if (!event.uid) continue;

          // 检查飞书是否已有此事件
          const existingTask = await this.findTaskByICloudEventId(event.uid);

          if (existingTask) {
            // 更新
            const needsUpdate = this.needsUpdate(existingTask, event);
            if (needsUpdate) {
              await feishuConnector.update(existingTask.id, {
                title: event.title,
                description: event.description,
                start_date: event.startDate,
                start_time: event.startTime,
                end_time: event.endTime,
                recurrence_rule: event.recurrenceRule,
              });
              result.updated++;
              logger.info(`[ScheduleService] Updated task ${existingTask.id} from iCloud event ${event.uid}`);
            }
          } else {
            // 创建
            const newTask: Partial<Task> = {
              id: event.uid,
              title: event.title,
              description: event.description,
              start_date: event.startDate,
              start_time: event.startTime,
              end_time: event.endTime,
              status: 'pending',
              priority: 'medium',
              is_recurring: !!event.recurrenceRule,
              recurrence_type: this.parseRecurrenceType(event.recurrenceRule),
              recurrence_rule: event.recurrenceRule,
              icloud_event_id: event.uid,
              source: 'icloud',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            await feishuConnector.create(newTask as Task);
            result.created++;
            logger.info(`[ScheduleService] Created task from iCloud event ${event.uid}`);
          }

          result.synced++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Calendar ${calId}: ${errorMessage}`);
        logger.error(`[ScheduleService] Sync from calendar ${calId} failed: ${errorMessage}`);
      }
    }

    return result;
  }

  /**
   * 删除 iCloud 日历事件
   */
  async deleteFromICalendar(task: Task): Promise<{ success: boolean; error?: string }> {
    if (!task.icloud_event_id) {
      // 无 icloud_event_id 不需要删除 iCloud 事件
      return { success: true };
    }

    try {
      // 获取日历 ID
      const calendarId = this.getCalendarId(task.category);
      if (!calendarId) {
        return { success: false, error: `Unknown category: ${task.category}` };
      }

      await icloudConnector.deleteEvent(task.icloud_event_id, calendarId);
      logger.info(`[ScheduleService] Deleted iCloud event: ${task.icloud_event_id}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[ScheduleService] Delete iCloud event failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 查询日程列表
   */
  async querySchedules(query: CalendarQuery): Promise<{ items: Task[]; total: number }> {
    const filter: {
      start_date_from?: string;
      start_date_to?: string;
      category?: string;
      page?: number;
      page_size?: number;
    } = {};

    // 转换特殊日期值
    let dateValue = query.date;
    if (dateValue === 'today') {
      dateValue = new Date().toISOString().split('T')[0];
    } else if (dateValue === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateValue = tomorrow.toISOString().split('T')[0];
    } else if (dateValue === 'this_week') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      filter.start_date_from = startOfWeek.toISOString().split('T')[0];
      filter.start_date_to = endOfWeek.toISOString().split('T')[0];
    } else if (dateValue === 'next_week') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfNextWeek = new Date(now);
      startOfNextWeek.setDate(now.getDate() + (7 - dayOfWeek));
      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
      filter.start_date_from = startOfNextWeek.toISOString().split('T')[0];
      filter.start_date_to = endOfNextWeek.toISOString().split('T')[0];
    }

    if (dateValue) {
      filter.start_date_from = dateValue;
      filter.start_date_to = dateValue;
    } else {
      if (query.startDate) filter.start_date_from = query.startDate;
      if (query.endDate) filter.start_date_to = query.endDate;
    }

    if (query.category) {
      filter.category = query.category;
    }

    filter.page = query.page || 1;
    filter.page_size = query.pageSize || 20;

    // 查询飞书中所有含 start_date 的任务
    const result = await feishuConnector.list(filter);

    return {
      items: result.items.filter(t => t.start_date), // 确保只返回有 start_date 的
      total: result.total,
    };
  }

  /**
   * 获取单个日程
   */
  async getSchedule(id: string): Promise<Task | null> {
    const task = await feishuConnector.get(id);
    if (!task || !task.start_date) {
      return null;
    }
    return task;
  }

  /**
   * 获取日历 ID（通过分类名称）
   */
  private getCalendarId(category?: string): string | undefined {
    // 规范化 category
    let normalized = category || DEFAULT_CATEGORY;
    const mapping: Record<string, string> = {
      '工作': '工作', 'work': '工作',
      '个人': '个人', 'personal': '个人',
      '家庭共享': '家庭共享', '家庭': '家庭共享', 'family': '家庭共享',
    };
    const mapped = mapping[category || ''];
    if (mapped) normalized = mapped;
    else if (category) {
      // 尝试部分匹配
      if (category.includes('家庭')) normalized = '家庭共享';
      else if (category.includes('个人')) normalized = '个人';
      else if (category.includes('工作')) normalized = '工作';
    }
    return icloudConnector.getCalendarIdByCategory(normalized);
  }

  /**
   * 根据 iCloud 事件 ID 查找任务
   */
  private async findTaskByICloudEventId(icloudEventId: string): Promise<Task | null> {
    const result = await feishuConnector.list({ page_size: 100 });
    return result.items.find(t => t.icloud_event_id === icloudEventId) || null;
  }

  /**
   * 根据 recurrence_type 生成默认的 RRULE
   */
  private generateDefaultRrule(recurrenceType: string, startDate: string, startTime?: string): string | undefined {
    if (!startDate) return undefined;

    const dayMap: Record<number, string> = {
      0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA'
    };
    const dayName = dayMap[new Date(startDate).getDay()];

    switch (recurrenceType) {
      case 'daily':
        return 'RRULE:FREQ=DAILY';
      case 'weekly':
        return `RRULE:FREQ=WEEKLY;BYDAY=${dayName}`;
      case 'weekly_n':
        // weekly_n requires explicit BYDAY in recurrence_rule, leave as-is
        return undefined;
      case 'monthly':
        return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${new Date(startDate).getDate()}`;
      case 'yearly':
        return `RRULE:FREQ=YEARLY;BYMONTH=${new Date(startDate).getMonth() + 1};BYMONTHDAY=${new Date(startDate).getDate()}`;
      default:
        return undefined;
    }
  }

  /**
   * 检查是否需要更新
   */
  private needsUpdate(task: Task, event: ICloudEvent): boolean {
    if (task.title !== event.title) return true;
    if (task.description !== event.description) return true;
    if (task.start_date !== event.startDate) return true;
    if (task.start_time !== event.startTime) return true;
    if (task.end_time !== event.endTime) return true;
    if (task.recurrence_rule !== event.recurrenceRule) return true;
    return false;
  }

  /**
   * 解析循环类型
   */
  private parseRecurrenceType(rrule?: string): 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' {
    if (!rrule) return 'none';

    const upperRrule = rrule.toUpperCase();
    if (upperRrule.includes('FREQ=DAILY')) return 'daily';
    if (upperRrule.includes('FREQ=WEEKLY')) return 'weekly';
    if (upperRrule.includes('FREQ=MONTHLY')) return 'monthly';
    if (upperRrule.includes('FREQ=YEARLY')) return 'yearly';

    return 'none';
  }
}

export const scheduleService = new ScheduleService();