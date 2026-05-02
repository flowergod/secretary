"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleService = exports.ScheduleService = void 0;
// 日程服务
const uuid_1 = require("uuid");
const feishu_1 = require("../connectors/feishu");
const icloud_1 = require("../connectors/icloud");
class ScheduleService {
    /**
     * 创建日程/事件
     */
    async createEvent(intent) {
        const now = new Date().toISOString();
        const event = {
            id: (0, uuid_1.v4)(),
            type: 'event',
            title: intent.entity.title || '未命名日程',
            description: intent.entity.description,
            status: 'pending',
            priority: intent.entity.priority || '中',
            due_date: intent.entity.due_date,
            start_date: intent.entity.start_date,
            start_time: intent.entity.start_time,
            end_time: intent.entity.end_time,
            is_recurring: false,
            calendar_category: intent.entity.calendar_category,
            created_at: now,
            updated_at: now,
        };
        const created = await feishu_1.feishuConnector.create(event);
        // 同步到 iCloud 日历
        let iCloudUid;
        try {
            iCloudUid = await icloud_1.icloudConnector.createEvent(created);
            console.log('[ScheduleService] iCloud sync success, UID:', iCloudUid);
            // 将 iCloud 事件 ID 回写到飞书记录
            if (iCloudUid) {
                await feishu_1.feishuConnector.update(created.id, {
                    icloud_event_id: iCloudUid,
                });
                console.log('[ScheduleService] iCloud UID written to Feishu record');
            }
        }
        catch (error) {
            console.error('[ScheduleService] Failed to sync to iCloud:', error);
        }
        return { ...created, icloud_event_id: iCloudUid };
    }
    /**
     * 获取今天的日程
     */
    async getTodayEvents() {
        const today = new Date().toISOString().split('T')[0];
        const allEvents = await feishu_1.feishuConnector.query({ type: 'event' });
        return allEvents.filter(e => e.due_date && e.due_date.startsWith(today));
    }
    /**
     * 获取即将到来的日程（未来 N 分钟）
     */
    async getUpcomingEvents(minutes = 15) {
        const now = new Date();
        const future = new Date(now.getTime() + minutes * 60 * 1000);
        const allEvents = await feishu_1.feishuConnector.query({ type: 'event' });
        return allEvents.filter(event => {
            if (!event.start_date)
                return false;
            const eventDateStr = event.start_date;
            const eventTimeStr = event.start_time || '00:00';
            // 简单比较：只比较日期部分
            const today = now.toISOString().split('T')[0];
            if (eventDateStr !== today)
                return false;
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
            }
            else {
                // 跨午夜
                return eventMinutes >= nowMinutes || eventMinutes <= futureMinutes;
            }
        });
    }
    /**
     * 更新日程
     */
    async updateEvent(eventId, updates) {
        const updated = await feishu_1.feishuConnector.update(eventId, {
            ...updates,
            updated_at: new Date().toISOString(),
        });
        // 同步到 iCloud
        try {
            await icloud_1.icloudConnector.updateEvent(eventId, updated);
        }
        catch (error) {
            console.error('[ScheduleService] Failed to sync update to iCloud:', error);
        }
        return updated;
    }
    /**
     * 删除日程
     */
    async deleteEvent(eventId) {
        const event = await feishu_1.feishuConnector.get(eventId);
        await feishu_1.feishuConnector.delete(eventId);
        // 从 iCloud 删除
        try {
            await icloud_1.icloudConnector.deleteEvent(eventId, event?.calendar_category);
        }
        catch (error) {
            console.error('[ScheduleService] Failed to delete from iCloud:', error);
        }
    }
    /**
     * 查询指定日期范围的日程
     */
    async queryEventsByDateRange(startDate, endDate) {
        const allEvents = await feishu_1.feishuConnector.query({ type: 'event' });
        return allEvents.filter(event => {
            if (!event.start_date)
                return false;
            return event.start_date >= startDate && event.start_date <= endDate;
        });
    }
}
exports.ScheduleService = ScheduleService;
exports.scheduleService = new ScheduleService();
//# sourceMappingURL=schedule-service.js.map