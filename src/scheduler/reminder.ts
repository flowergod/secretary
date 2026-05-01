// 主动提醒调度器 (OpenClaw 专用)
import { configManager } from '../shared/config';
import { feishuConnector } from '../connectors/feishu';
import { nlParser } from '../parser/nl-parser';

export interface ReminderSchedule {
  name: string;
  schedule: string;   // cron expression
  handler: string;    // handler function name
}

const DEFAULT_SCHEDULES: ReminderSchedule[] = [
  { name: 'morning-reminder', schedule: '30 8 * * *', handler: 'handleMorningReminder' },
  { name: 'evening-reminder', schedule: '0 21 * * *', handler: 'handleEveningReminder' },
  { name: 'weekend-summary', schedule: '0 18 * * 5', handler: 'handleWeekendSummary' },
  { name: 'pre-event-reminder', schedule: '*/15 * * * *', handler: 'handlePreEventReminder' },
];

export class ReminderScheduler {
  private schedules: ReminderSchedule[] = DEFAULT_SCHEDULES;
  private isRunning = false;

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('[ReminderScheduler] Started');

    // Start all scheduled jobs
    for (const schedule of this.schedules) {
      this.scheduleJob(schedule);
    }
  }

  /**
   * 停止调度器
   */
  stop(): void {
    this.isRunning = false;
    console.log('[ReminderScheduler] Stopped');
  }

  /**
   * 执行指定任务
   */
  async execute(handler: string): Promise<void> {
    switch (handler) {
      case 'handleMorningReminder':
        await this.handleMorningReminder();
        break;
      case 'handleEveningReminder':
        await this.handleEveningReminder();
        break;
      case 'handleWeekendSummary':
        await this.handleWeekendSummary();
        break;
      case 'check-upcoming-events':
        await this.handlePreEventReminder();
        break;
      default:
        console.warn(`[ReminderScheduler] Unknown handler: ${handler}`);
    }
  }

  /**
   * 早安提醒
   */
  private async handleMorningReminder(): Promise<void> {
    const config = configManager.get();
    if (!config.reminders.morning.enabled) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const events = await feishuConnector.query({ type: 'event' });

    // Filter events for today
    const todayEvents = events.filter(e => e.due_date && e.due_date.startsWith(today));

    if (todayEvents.length === 0) {
      await feishuConnector.sendMessage('早安！今天没有安排的事项。');
      return;
    }

    const eventList = todayEvents
      .map(e => {
        const time = e.start_time ? new Date(e.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '全天';
        return `- ${time} ${e.title}`;
      })
      .join('\n');

    const message = `早安！今天你有${todayEvents.length}件事：\n${eventList}`;
    await feishuConnector.sendMessage(message);
  }

  /**
   * 晚安提醒
   */
  private async handleEveningReminder(): Promise<void> {
    const config = configManager.get();
    if (!config.reminders.evening.enabled) {
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const events = await feishuConnector.query({ type: 'event' });

    // Filter events for tomorrow
    const tomorrowEvents = events.filter(e => e.due_date && e.due_date.startsWith(tomorrowStr));

    if (events.length === 0) {
      await feishuConnector.sendMessage('晚安！明天没有安排的事项，好好休息~');
      return;
    }

    const eventList = events
      .map(e => {
        const time = e.start_time || '全天';
        return `- ${time} ${e.title}`;
      })
      .join('\n');

    const message = `晚安！明天日程：\n${eventList}\n记得准备材料！`;
    await feishuConnector.sendMessage(message);
  }

  /**
   * 周末总结
   */
  private async handleWeekendSummary(): Promise<void> {
    const config = configManager.get();
    if (!config.reminders.weekendSummary.enabled) {
      return;
    }

    // Get this week's completed tasks
    const completedTasks = await feishuConnector.query({
      type: 'task',
      status: 'completed',
    });

    // Get next week's events
    const nextWeekStart = new Date();
    nextWeekStart.setDate(nextWeekStart.getDate() + (7 - nextWeekStart.getDay()) + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    const allEvents = await feishuConnector.query({ type: 'event' });
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0];
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0];
    const nextWeekEvents = allEvents.filter(e => e.due_date && e.due_date >= nextWeekStartStr && e.due_date <= nextWeekEndStr);

    const summary = [
      `本周完成${completedTasks.length}项任务`,
      nextWeekEvents.length > 0
        ? `下周有${nextWeekEvents.length}个截止日`
        : '下周暂无明确截止日',
    ].join('，');

    await feishuConnector.sendMessage(`周末愉快！${summary}。`);
  }

  /**
   * 事前提醒
   */
  private async handlePreEventReminder(): Promise<void> {
    const config = configManager.get();
    if (!config.reminders.preEvent.enabled) {
      return;
    }

    const now = new Date();
    const minutesBefore = config.reminders.preEvent.minutesBefore;
    const targetTime = new Date(now.getTime() + minutesBefore * 60 * 1000);
    const targetTimeStr = targetTime.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

    const events = await feishuConnector.query({ type: 'event' });

    for (const event of events) {
      if (!event.start_date || !event.start_time) {
        continue;
      }

      const eventDateTime = `${event.start_date}T${event.start_time}`;
      if (eventDateTime === targetTimeStr) {
        const message = `${minutesBefore}分钟后：${event.title}，记得准备！`;
        await feishuConnector.sendMessage(message);
      }
    }
  }

  private scheduleJob(schedule: ReminderSchedule): void {
    // Simple cron-based scheduling
    // In production, use a proper cron library like node-cron
    const checkInterval = 60000; // Check every minute

    setInterval(() => {
      if (!this.isRunning) {
        return;
      }

      const now = new Date();
      const [minute, hour, , , dayOfWeek] = this.parseCron(schedule.schedule);

      if (this.matchesCron(now, minute, hour, dayOfWeek)) {
        this.execute(schedule.handler);
      }
    }, checkInterval);
  }

  private parseCron(cron: string): number[] {
    const parts = cron.split(' ');
    return [
      parseInt(parts[0]) || 0,  // minute
      parseInt(parts[1]) || 0,  // hour
      parseInt(parts[2]) || 0,  // day of month
      parseInt(parts[3]) || 0,  // month
      parseInt(parts[4]) || 0,  // day of week
    ];
  }

  private matchesCron(now: Date, minute: number, hour: number, dayOfWeek: number): boolean {
    const nowMinute = now.getMinutes();
    const nowHour = now.getHours();
    const nowDayOfWeek = now.getDay();

    // Handle wildcard
    if (minute !== 0 && minute !== nowMinute) {
      return false;
    }
    if (hour !== 0 && hour !== nowHour) {
      return false;
    }
    if (dayOfWeek !== 0 && dayOfWeek !== nowDayOfWeek) {
      return false;
    }

    return true;
  }
}

export const reminderScheduler = new ReminderScheduler();
