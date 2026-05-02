import { TaskEntity } from '../shared/types';
interface CalendarEvent {
    uid: string;
    summary: string;
    description?: string;
    dtstart: string;
    dtend: string;
    created?: string;
    lastModified?: string;
}
export declare class ICloudConnector {
    private appleId;
    private appPassword;
    private baseUrl;
    private calendarMapping;
    private userId?;
    constructor();
    /**
     * 获取 iCloud 用户 ID (数字)
     */
    private getUserId;
    /**
     * 根据日历分类获取 iCloud 日历 ID
     */
    private getCalendarIdByCategory;
    /**
     * 获取日历列表
     */
    getCalendars(): Promise<{
        id: string;
        name: string;
    }[]>;
    /**
     * 创建日历事件（从飞书 event 同步）
     */
    createEvent(entity: TaskEntity): Promise<string>;
    /**
     * 更新日历事件
     */
    updateEvent(uid: string, entity: Partial<TaskEntity>): Promise<void>;
    /**
     * 删除日历事件
     */
    deleteEvent(uid: string, calendarCategory?: string): Promise<void>;
    /**
     * 查询指定日期的事件
     */
    getEventsByDate(date: string): Promise<CalendarEvent[]>;
    private executeCalDAV;
    private formatICalDate;
    private formatICalDateTime;
}
export declare const icloudConnector: ICloudConnector;
export {};
//# sourceMappingURL=icloud.d.ts.map