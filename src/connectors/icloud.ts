// iCloud 日历 Connector (CalDAV)
import { TaskEntity } from '../shared/types';
import { withRetry } from '../shared/retry';
import { configManager } from '../shared/config';

interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend: string;
  created?: string;
  lastModified?: string;
}

export class ICloudConnector {
  private appleId: string;
  private appPassword: string;
  private baseUrl = 'https://caldav.icloud.com';

  constructor() {
    const config = configManager.get();
    this.appleId = config.icloud.appleId;
    this.appPassword = config.icloud.appPassword;
  }

  /**
   * 获取日历列表
   */
  async getCalendars(): Promise<{ id: string; name: string }[]> {
    const response = await this.executeCalDAV('GET', '/principals/users/');

    const calendars: { id: string; name: string }[] = [];
    const match = response.match(/<d:href>([^<]+)<\/d:href>/g);

    if (match) {
      for (const href of match) {
        const path = href.replace(/<d:href>/, '').replace(/<\/d:href>/, '');
        if (path.includes('/calendars/') && !path.endsWith('/')) {
          calendars.push({
            id: path.split('/').pop() || '',
            name: decodeURIComponent(path.split('/').pop() || ''),
          });
        }
      }
    }

    return calendars;
  }

  /**
   * 创建日历事件（从飞书 event 同步）
   */
  async createEvent(entity: TaskEntity): Promise<string> {
    if (entity.type !== 'event' || !entity.start_date) {
      throw new Error('Invalid event entity');
    }

    const uid = `${entity.id}@ICloudCalendar`;
    const dtstart = this.formatICalDate(entity.start_date, entity.start_time);
    const dtend = this.formatICalDate(entity.due_date || entity.start_date, entity.start_time);

    const iCalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Project Secretary//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${this.formatICalDateTime(new Date())}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${entity.title}`,
      entity.description ? `DESCRIPTION:${entity.description}` : '',
      `CREATED:${this.formatICalDateTime(new Date())}`,
      `LAST-MODIFIED:${this.formatICalDateTime(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(line => line).join('\r\n');

    return withRetry(async () => {
      const calendarId = await this.getDefaultCalendarId();
      await this.executeCalDAV('PUT', `/calendars/__uids__/${this.appleId}/calendars/${calendarId}/${uid}.ics`, iCalContent);
      return uid;
    });
  }

  /**
   * 更新日历事件
   */
  async updateEvent(uid: string, entity: Partial<TaskEntity>): Promise<void> {
    const dtstart = entity.start_date ? this.formatICalDate(entity.start_date, entity.start_time) : undefined;
    const dtend = entity.due_date ? this.formatICalDate(entity.due_date, entity.start_time) : dtstart;

    const updates = [
      entity.title ? `SUMMARY:${entity.title}` : null,
      entity.description ? `DESCRIPTION:${entity.description}` : null,
      dtstart ? `DTSTART:${dtstart}` : null,
      dtend ? `DTEND:${dtend}` : null,
      `LAST-MODIFIED:${this.formatICalDateTime(new Date())}`,
    ].filter(Boolean).join('\r\n');

    return withRetry(async () => {
      const calendarId = await this.getDefaultCalendarId();
      await this.executeCalDAV('PUT', `/calendars/__uids__/${this.appleId}/calendars/${calendarId}/${uid}.ics`, updates);
    });
  }

  /**
   * 删除日历事件
   */
  async deleteEvent(uid: string): Promise<void> {
    return withRetry(async () => {
      const calendarId = await this.getDefaultCalendarId();
      await this.executeCalDAV('DELETE', `/calendars/__uids__/${this.appleId}/calendars/${calendarId}/${uid}.ics`);
    });
  }

  /**
   * 查询指定日期的事件
   */
  async getEventsByDate(date: string): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    return events;
  }

  private async executeCalDAV(method: string, path: string, body?: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Depth': '1',
    };

    const auth = Buffer.from(`${this.appleId}:${this.appPassword}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`iCloud CalDAV error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private async getDefaultCalendarId(): Promise<string> {
    return 'home';
  }

  private formatICalDate(date: string, time?: string): string {
    const d = date.replace(/-/g, '');
    const t = time ? time.replace(':', '') + '00' : '000000';
    return `${d}T${t}`;
  }

  private formatICalDateTime(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}

export const icloudConnector = new ICloudConnector();
