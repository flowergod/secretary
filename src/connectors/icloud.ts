// iCloud CalDAV Connector
import { ICloudConfig } from '../shared/types';
import { configManager, logger } from '../shared';

export interface ICloudEvent {
  uid?: string;
  title: string;
  description?: string;
  startDate: string;        // YYYY-MM-DD
  startTime?: string;       // HH:MM
  endDate?: string;         // YYYY-MM-DD (跨日时需要)
  endTime?: string;         // HH:MM
  calendarId: string;
  recurrenceRule?: string;  // RRULE 格式
  location?: string;
}

export interface Calendar {
  id: string;
  name: string;
  color?: string;
}

// iCloud CalDAV API 错误
export class ICloudError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ICloudError';
  }
}

export class ICloudConnector {
  private appleId: string;
  private appPassword: string;
  public calendarMapping: Record<string, string>;
  private baseUrl = 'https://caldav.icloud.com';
  private principalPath?: string;  // 例如 /8183897202/calendars/

  constructor() {
    const config = configManager.get();
    if (!config.icloud) {
      throw new Error('iCloud configuration is missing');
    }
    this.appleId = config.icloud.appleId;
    this.appPassword = config.icloud.appPassword;
    this.calendarMapping = config.icloud.calendarMapping || {};
  }

  /**
   * 获取用户日历根路径
   * iCloud CalDAV 路径格式: /<user-id>/calendars/
   */
  private async getPrincipalPath(): Promise<string> {
    if (this.principalPath) {
      return this.principalPath;
    }

    // 发现日历根路径
    const response = await this.executeRequest('PROPFIND', '/calendars/');
    if (response.status === 207) {
      // 从响应中解析日历根路径
      // 响应格式: <href>/8183897202/calendars/</href>
      // 尝试多种匹配方式
      let path: string | undefined;

      // 方式1: 匹配 /数字/calendars/ 格式
      const pathMatch = response.body.match(/\/(\d{8,})\/calendars\//);
      if (pathMatch) {
        path = `/${pathMatch[0].replace(/^\//, '')}`;
        logger.debug(`[ICloudConnector] Discovered path via number match: ${path}`);
      }

      // 方式2: 标准正则匹配
      if (!path) {
        const match = response.body.match(/<href>([^<]+)<\/href>/);
        if (match && match[1]) {
          path = match[1].trim();
          if (!path.startsWith('/')) path = '/' + path;
          if (!path.endsWith('/')) path = path + '/';
        }
      }

      if (path) {
        this.principalPath = path;
        logger.debug(`[ICloudConnector] Discovered principal path: ${this.principalPath}`);
        return this.principalPath;
      }
    }

    // 如果解析失败，使用默认值（基于已知用户ID）
    logger.warn('[ICloudConnector] Failed to discover principal path, using fallback');
    this.principalPath = '/8183897202/calendars/';
    return this.principalPath;
  }

  /**
   * 构建日历事件路径
   */
  private async getEventPath(calendarId: string, uid: string): Promise<string> {
    const principalPath = await this.getPrincipalPath();
    return `${principalPath}${calendarId}/${uid}.ics`;
  }

  /**
   * 构建日历查询路径
   */
  private async getCalendarPath(calendarId: string): Promise<string> {
    const principalPath = await this.getPrincipalPath();
    return `${principalPath}${calendarId}/`;
  }

  /**
   * 获取认证头
   */
  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.appleId}:${this.appPassword}`).toString('base64');
  }

  /**
   * 执行 CalDAV 请求
   */
  private async executeRequest(
    method: string,
    path: string,
    body?: string,
    contentType?: string,
    extraHeaders?: Record<string, string>
  ): Promise<{ status: number; headers: Headers; body: string }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      ...extraHeaders,
    };

    if (body) {
      headers['Content-Type'] = contentType || 'text/plain; charset=utf-8';
    }

    logger.debug(`[ICloudConnector] ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    const responseBody = await response.text();
    logger.debug(`[ICloudConnector] Response status: ${response.status}`);

    return {
      status: response.status,
      headers: response.headers,
      body: responseBody,
    };
  }

  /**
   * 将日期时间转换为 iCalendar 格式
   */
  private formatDateTime(date: string, time?: string): string {
    // 格式: 20260505T084500
    const datePart = date.replace(/-/g, '');
    if (time) {
      // 移除所有冒号，并确保是6位数字格式 (HHMMSS)
      // "09:00" -> "0900" -> "090000"
      // "09:00:00" -> "090000" -> "090000"
      const timePart = time.replace(/:/g, '').padEnd(6, '0');
      return `${datePart}T${timePart}`;
    }
    return `${datePart}T000000`;
  }

  /**
   * 生成 vCalendar 格式的事件
   */
  private generateVEvent(event: ICloudEvent, isUpdate = false): string {
    const uid = event.uid || this.generateUID();
    const dtstart = this.formatDateTime(event.startDate, event.startTime);
    const dtend = event.endDate
      ? this.formatDateTime(event.endDate, event.endTime)
      : this.formatDateTime(event.startDate, event.endTime || this.addHours(event.startTime || '09:00', 1));

    let vevent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Project Secretary//iCloud CalDAV//CN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${this.escapeICalendar(event.title)}`,
    ];

    if (event.description) {
      vevent.push(`DESCRIPTION:${this.escapeICalendar(event.description)}`);
    }

    if (event.location) {
      vevent.push(`LOCATION:${this.escapeICalendar(event.location)}`);
    }

    if (event.recurrenceRule) {
      vevent.push(event.recurrenceRule);
    }

    if (isUpdate) {
      vevent.push('SEQUENCE:1');
    }

    vevent.push('END:VEVENT');
    vevent.push('END:VCALENDAR');

    return vevent.join('\r\n');
  }

  /**
   * 生成唯一 UID
   */
  private generateUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@caldav.icloud.com`;
  }

  /**
   * 添加小时
   */
  private addHours(time: string, hours: number): string {
    const [h, m] = time.split(':').map(Number);
    const newH = (h + hours) % 24;
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * 转义 iCalendar 特殊字符
   */
  private escapeICalendar(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * 解析 vEvent 从响应中
   */
  private parseVEventFromResponse(body: string): ICloudEvent[] {
    const events: ICloudEvent[] = [];
    const veventMatches = body.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);

    if (!veventMatches) return events;

    for (const vevent of veventMatches) {
      const event: Partial<ICloudEvent> = {};

      const uidMatch = vevent.match(/UID:([^\r\n]+)/);
      if (uidMatch) event.uid = uidMatch[1];

      const summaryMatch = vevent.match(/SUMMARY:([^\r\n]+)/);
      if (summaryMatch) {
        event.title = this.unescapeICalendar(summaryMatch[1]);
      }

      const descMatch = vevent.match(/DESCRIPTION:([^\r\n]+)/);
      if (descMatch) {
        event.description = this.unescapeICalendar(descMatch[1]);
      }

      const locMatch = vevent.match(/LOCATION:([^\r\n]+)/);
      if (locMatch) {
        event.location = this.unescapeICalendar(locMatch[1]);
      }

      // 解析 DTSTART
      const dtstartMatch = vevent.match(/DTSTART(?::([^;\r\n]+))?(?:;[^:\r\n]+)?:([^\r\n]+)/);
      if (dtstartMatch) {
        const dtstart = dtstartMatch[2] || dtstartMatch[1];
        event.startDate = this.parseIDateTime(dtstart).date;
        event.startTime = this.parseIDateTime(dtstart).time;
      }

      // 解析 DTEND
      const dtendMatch = vevent.match(/DTEND(?::([^;\r\n]+))?(?:;[^:\r\n]+)?:([^\r\n]+)/);
      if (dtendMatch) {
        const dtend = dtendMatch[2] || dtendMatch[1];
        event.endDate = this.parseIDateTime(dtend).date;
        event.endTime = this.parseIDateTime(dtend).time;
      }

      // 解析 RRULE
      const rruleMatch = vevent.match(/RRULE:([^\r\n]+)/);
      if (rruleMatch) {
        event.recurrenceRule = `RRULE:${rruleMatch[1]}`;
      }

      events.push(event as ICloudEvent);
    }

    return events;
  }

  /**
   * 解析 iCalendar 日期时间格式
   */
  private parseIDateTime(dt: string): { date: string; time: string | undefined } {
    if (dt.includes('T')) {
      // 格式: 20260505T084500
      const date = dt.substring(0, 8);
      const time = dt.substring(9, 14);
      return {
        date: `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`,
        time: `${time.substring(0, 2)}:${time.substring(2, 4)}`,
      };
    }
    // 只有日期
    return {
      date: `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`,
      time: undefined,
    };
  }

  /**
   * 反转义 iCalendar 特殊字符
   */
  private unescapeICalendar(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * 创建日历事件
   */
  async createEvent(event: ICloudEvent): Promise<string> {
    const calendarId = event.calendarId;
    const uid = event.uid || this.generateUID();
    const vevent = this.generateVEvent({ ...event, uid });

    const path = await this.getEventPath(calendarId, uid);

    try {
      const response = await this.executeRequest('PUT', path, vevent, 'text/calendar; charset=utf-8');

      if (response.status === 201 || response.status === 204) {
        logger.info(`[ICloudConnector] Created event: ${uid}`);
        return uid;
      }

      // 处理已存在的情况
      if (response.status === 409) {
        throw new ICloudError('Event already exists', 'ICLOUD_EVENT_EXISTS', 409);
      }

      throw new ICloudError(`Failed to create event: ${response.body}`, 'ICLOUD_CREATE_FAILED', response.status);
    } catch (error) {
      if (error instanceof ICloudError) throw error;
      throw new ICloudError(
        error instanceof Error ? error.message : 'Unknown error',
        'ICLOUD_NETWORK_ERROR'
      );
    }
  }

  /**
   * 更新日历事件
   */
  async updateEvent(uid: string, event: Partial<ICloudEvent>): Promise<void> {
    const calendarId = event.calendarId;
    if (!calendarId) {
      throw new ICloudError('Calendar ID is required for update', 'VALIDATION_ERROR');
    }

    // CalDAV PUT 是幂等的，可以直接更新
    // 确保必填字段存在
    if (!event.title || !event.startDate) {
      throw new ICloudError('Title and startDate are required for update', 'VALIDATION_ERROR');
    }

    const fullEvent: ICloudEvent = {
      uid,
      title: event.title,
      startDate: event.startDate,
      calendarId,
      description: event.description,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime,
      location: event.location,
      recurrenceRule: event.recurrenceRule,
    };

    const vevent = this.generateVEvent(fullEvent, true);
    const path = await this.getEventPath(calendarId, uid);

    try {
      const response = await this.executeRequest('PUT', path, vevent, 'text/calendar; charset=utf-8');

      if (response.status !== 201 && response.status !== 204 && response.status !== 200) {
        throw new ICloudError(`Failed to update event: ${response.body}`, 'ICLOUD_UPDATE_FAILED', response.status);
      }

      logger.info(`[ICloudConnector] Updated event: ${uid}`);
    } catch (error) {
      if (error instanceof ICloudError) throw error;
      throw new ICloudError(
        error instanceof Error ? error.message : 'Unknown error',
        'ICLOUD_NETWORK_ERROR'
      );
    }
  }

  /**
   * 删除日历事件
   */
  async deleteEvent(uid: string, calendarId: string): Promise<void> {
    const path = await this.getEventPath(calendarId, uid);

    try {
      const response = await this.executeRequest('DELETE', path);

      if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
        throw new ICloudError(`Failed to delete event: ${response.body}`, 'ICLOUD_DELETE_FAILED', response.status);
      }

      logger.info(`[ICloudConnector] Deleted event: ${uid}`);
    } catch (error) {
      if (error instanceof ICloudError) throw error;
      throw new ICloudError(
        error instanceof Error ? error.message : 'Unknown error',
        'ICLOUD_NETWORK_ERROR'
      );
    }
  }

  /**
   * 查询指定日历的事件
   */
  async queryEvents(
    calendarId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ICloudEvent[]> {
    // 构建 XML 查询请求
    const start = startDate ? `${startDate.replace(/-/g, '')}T000000Z` : '20200101T000000Z';
    const end = endDate ? `${endDate.replace(/-/g, '')}T235959Z` : '20300101T235959Z';

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${start}" end="${end}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const path = await this.getCalendarPath(calendarId);

    try {
      const response = await this.executeRequest('REPORT', path, xmlBody, 'application/xml; charset=utf-8', { 'Depth': '1' });

      if (response.status !== 207 && response.status !== 200) {
        throw new ICloudError(`Failed to query events: ${response.body}`, 'ICLOUD_QUERY_FAILED', response.status);
      }

      return this.parseVEventFromResponse(response.body);
    } catch (error) {
      if (error instanceof ICloudError) throw error;
      throw new ICloudError(
        error instanceof Error ? error.message : 'Unknown error',
        'ICLOUD_NETWORK_ERROR'
      );
    }
  }

  /**
   * 获取日历列表
   */
  async listCalendars(): Promise<Calendar[]> {
    const principalPath = await this.getPrincipalPath();
    const path = principalPath;  // e.g., /8183897202/calendars/

    try {
      const response = await this.executeRequest('PROPFIND', path);

      if (response.status !== 207 && response.status !== 200) {
        throw new ICloudError(`Failed to list calendars: ${response.body}`, 'ICLOUD_LIST_FAILED', response.status);
      }

      return this.parseCalendarList(response.body);
    } catch (error) {
      if (error instanceof ICloudError) throw error;
      throw new ICloudError(
        error instanceof Error ? error.message : 'Unknown error',
        'ICLOUD_NETWORK_ERROR'
      );
    }
  }

  /**
   * 解析日历列表响应
   */
  private parseCalendarList(body: string): Calendar[] {
    const calendars: Calendar[] = [];

    // 使用正则匹配 calendar-home-set 内的 href
    const hrefMatches = body.match(/<D:href>([^<]+)<\/D:href>/g) || [];

    for (const href of hrefMatches) {
      const path = href.replace(/<D:href>/, '').replace('</D:href>', '');
      // 只匹配 calendars 子路径
      if (path.includes('/calendars/') && !path.endsWith('/')) {
        const parts = path.split('/');
        const calendarId = parts[parts.length - 1].replace('.ics', '');
        calendars.push({
          id: calendarId,
          name: calendarId,
        });
      }
    }

    return calendars;
  }

  /**
   * 获取日历 ID（通过分类名称）
   */
  getCalendarIdByCategory(category?: string): string | undefined {
    if (!category) {
      return this.calendarMapping['个人'] || this.calendarMapping['personal'];
    }
    // 优先精确匹配
    if (this.calendarMapping[category]) {
      return this.calendarMapping[category];
    }
    // 然后不区分大小写匹配
    const lowerCategory = category.toLowerCase();
    for (const [key, value] of Object.entries(this.calendarMapping)) {
      if (key.toLowerCase() === lowerCategory) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * 验证认证信息
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.executeRequest('PROPFIND', '/principals/');
      return response.status === 207;
    } catch {
      return false;
    }
  }
}

export const icloudConnector = new ICloudConnector();