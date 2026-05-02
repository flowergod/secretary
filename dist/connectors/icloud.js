"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.icloudConnector = exports.ICloudConnector = void 0;
const retry_1 = require("../shared/retry");
const config_1 = require("../shared/config");
class ICloudConnector {
    constructor() {
        this.baseUrl = 'https://caldav.icloud.com';
        this.calendarMapping = {};
        const config = config_1.configManager.get();
        this.appleId = config.icloud.appleId;
        this.appPassword = config.icloud.appPassword;
        this.calendarMapping = config.icloud.calendarMapping || {};
    }
    /**
     * 获取 iCloud 用户 ID (数字)
     */
    async getUserId() {
        if (this.userId)
            return this.userId;
        const response = await this.executeCalDAV('PROPFIND', '/principals/', `<?xml version="1.0"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal />
  </D:prop>
</D:propfind>`);
        // Match the href inside current-user-principal
        const match = response.match(/<D:current-user-principal[^>]*>[\s\S]*?<D:href[^>]*>([^<]+)<\/D:href>/);
        if (match && match[1]) {
            // Extract user ID from path like /8183897202/principal/
            const parts = match[1].split('/');
            this.userId = parts[1] || this.appleId;
        }
        else {
            // Fallback: try to find any /number/ pattern
            const numMatch = response.match(/\/(\d{10,})\//);
            this.userId = numMatch ? numMatch[1] : this.appleId;
        }
        return this.userId;
    }
    /**
     * 根据日历分类获取 iCloud 日历 ID
     */
    getCalendarIdByCategory(category) {
        if (category && this.calendarMapping[category]) {
            console.log('[ICloudConnector] Using calendar mapping:', category, '->', this.calendarMapping[category]);
            return this.calendarMapping[category];
        }
        // 默认返回 personal 日历
        console.log('[ICloudConnector] No mapping found for category:', category, 'Available:', this.calendarMapping);
        return this.calendarMapping['个人'] || 'F7D25790-4368-447C-96FF-4F7FE022AE1C';
    }
    /**
     * 获取日历列表
     */
    async getCalendars() {
        const response = await this.executeCalDAV('GET', '/principals/users/');
        const calendars = [];
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
    async createEvent(entity) {
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
        return (0, retry_1.withRetry)(async () => {
            const userId = await this.getUserId();
            const calendarId = this.getCalendarIdByCategory(entity.calendar_category);
            const path = `/${userId}/calendars/${calendarId}/${uid}.ics`;
            await this.executeCalDAV('PUT', path, iCalContent);
            return uid;
        });
    }
    /**
     * 更新日历事件
     */
    async updateEvent(uid, entity) {
        const dtstart = entity.start_date ? this.formatICalDate(entity.start_date, entity.start_time) : undefined;
        const dtend = entity.due_date ? this.formatICalDate(entity.due_date, entity.start_time) : dtstart;
        const updates = [
            entity.title ? `SUMMARY:${entity.title}` : null,
            entity.description ? `DESCRIPTION:${entity.description}` : null,
            dtstart ? `DTSTART:${dtstart}` : null,
            dtend ? `DTEND:${dtend}` : null,
            `LAST-MODIFIED:${this.formatICalDateTime(new Date())}`,
        ].filter(Boolean).join('\r\n');
        return (0, retry_1.withRetry)(async () => {
            const userId = await this.getUserId();
            const calendarId = this.getCalendarIdByCategory(entity.calendar_category);
            const path = `/${userId}/calendars/${calendarId}/${uid}.ics`;
            await this.executeCalDAV('PUT', path, updates);
        });
    }
    /**
     * 删除日历事件
     */
    async deleteEvent(uid, calendarCategory) {
        return (0, retry_1.withRetry)(async () => {
            const userId = await this.getUserId();
            const calendarId = calendarCategory ? this.getCalendarIdByCategory(calendarCategory) : (this.calendarMapping['个人'] || 'personal');
            const path = `/${userId}/calendars/${calendarId}/${uid}.ics`;
            await this.executeCalDAV('DELETE', path);
        });
    }
    /**
     * 查询指定日期的事件
     */
    async getEventsByDate(date) {
        const events = [];
        return events;
    }
    async executeCalDAV(method, path, body, contentType) {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from(`${this.appleId}:${this.appPassword}`).toString('base64'),
        };
        if (body) {
            headers['Content-Type'] = contentType || 'text/calendar; charset=utf-8';
            headers['Content-Length'] = Buffer.byteLength(body).toString();
        }
        const response = await fetch(`https://caldav.icloud.com${path}`, {
            method,
            headers,
            body,
        });
        if (!response.ok && response.status !== 201 && response.status !== 204) {
            throw new Error(`iCloud CalDAV error: ${response.status} ${response.statusText}`);
        }
        return response.text();
    }
    formatICalDate(date, time) {
        const d = date.replace(/-/g, '');
        const t = time ? time.replace(':', '') + '00' : '000000';
        return `${d}T${t}`;
    }
    formatICalDateTime(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
}
exports.ICloudConnector = ICloudConnector;
exports.icloudConnector = new ICloudConnector();
//# sourceMappingURL=icloud.js.map