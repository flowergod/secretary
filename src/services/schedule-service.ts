// 日程服务
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';
import { icloudConnector } from '../connectors/icloud';

export class ScheduleService {
  /**
   * 创建日程/事件
   */
  async createEvent(intent: ParsedIntent): Promise<TaskEntity> {
    const now = new Date().toISOString();
    const event: TaskEntity = {
      id: uuidv4(),
      type: 'event',
      title: intent.entity.title || '未命名日程',
      description: intent.entity.description,
      status: 'pending',
      priority: intent.entity.priority || 'medium',
      due_date: intent.entity.due_date,
      start_date: intent.entity.start_date,
      start_time: intent.entity.start_time,
      is_recurring: false,
      created_at: now,
      updated_at: now,
    };

    const created = await feishuConnector.create(event);

    // 同步到 iCloud 日历
    try {
      await icloudConnector.createEvent(created);
    } catch (error) {
      console.error('[ScheduleService] Failed to sync to iCloud:', error);
    }

    return created;
  }

  /**
   * 获取今天的日程
   */
  async getTodayEvents(): Promise<TaskEntity[]> {
    const today = new Date().toISOString().split('T')[0];
    const allEvents = await feishuConnector.query({ type: 'event' });
    return allEvents.filter(e => e.due_date && e.due_date.startsWith(today));
  }

  /**
   * 获取即将到来的日程（未来 N 分钟）
   */
  async getUpcomingEvents(minutes: number = 15): Promise<TaskEntity[]> {
    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60 * 1000);
    const allEvents = await feishuConnector.query({ type: 'event' });

    return allEvents.filter(event => {
      if (!event.start_date) return false;
      const eventDateStr = event.start_date;
      const eventTimeStr = event.start_time || '00:00';

      // 简单比较：只比较日期部分
      const today = now.toISOString().split('T')[0];
      if (eventDateStr !== today) return false;

      // 比较时间
      const eventHour = parseInt(eventTimeStr.split(':')[0], 10);
      const eventMinute = parseInt(eventTimeStr.split(':')[1], 10);
      const nowHour = now.getHours();
      const nowMinute = now.getMinutes();

      const eventMinutes = eventHour * 60 + eventMinute;
      const nowMinutes = nowHour * 60 + nowMinute;
      const futureMinutes = (nowMinutes + minutes) % (24 * 60);

      if (futureMinutes >= nowMinutes) {
        return eventMinutes >= nowMinutes && eventMinutes <= futureMinutes;
      } else {
        // 跨午夜
        return eventMinutes >= nowMinutes || eventMinutes <= futureMinutes;
      }
    });
  }

  /**
   * 更新日程
   */
  async updateEvent(eventId: string, updates: Partial<TaskEntity>): Promise<TaskEntity> {
    const updated = await feishuConnector.update(eventId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    // 同步到 iCloud
    try {
      await icloudConnector.updateEvent(eventId, updated);
    } catch (error) {
      console.error('[ScheduleService] Failed to sync update to iCloud:', error);
    }

    return updated;
  }

  /**
   * 删除日程
   */
  async deleteEvent(eventId: string): Promise<void> {
    await feishuConnector.delete(eventId);

    // 从 iCloud 删除
    try {
      await icloudConnector.deleteEvent(eventId);
    } catch (error) {
      console.error('[ScheduleService] Failed to delete from iCloud:', error);
    }
  }

  /**
   * 查询指定日期范围的日程
   */
  async queryEventsByDateRange(startDate: string, endDate: string): Promise<TaskEntity[]> {
    const allEvents = await feishuConnector.query({ type: 'event' });
    return allEvents.filter(event => {
      if (!event.start_date) return false;
      return event.start_date >= startDate && event.start_date <= endDate;
    });
  }
}

export const scheduleService = new ScheduleService();