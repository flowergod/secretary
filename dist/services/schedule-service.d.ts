import { Task } from '../shared/types';
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
export declare class ScheduleService {
    /**
     * 同步任务到 iCloud（日程创建/更新）
     * 当任务包含 start_date 时，视为日程，需同步至 iCloud
     */
    syncToICalendar(task: Task): Promise<SyncResult>;
    /**
     * 从 iCloud 同步到飞书
     */
    syncFromICalendar(calendarId?: string, startDate?: string, endDate?: string): Promise<{
        synced: number;
        created: number;
        updated: number;
        errors: string[];
    }>;
    /**
     * 删除 iCloud 日历事件
     */
    deleteFromICalendar(task: Task): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 查询日程列表
     */
    querySchedules(query: CalendarQuery): Promise<{
        items: Task[];
        total: number;
    }>;
    /**
     * 获取单个日程
     */
    getSchedule(id: string): Promise<Task | null>;
    /**
     * 获取日历 ID（通过分类名称）
     */
    private getCalendarId;
    /**
     * 根据 iCloud 事件 ID 查找任务
     */
    private findTaskByICloudEventId;
    /**
     * 根据 recurrence_type 生成默认的 RRULE
     */
    private generateDefaultRrule;
    /**
     * 检查是否需要更新
     */
    private needsUpdate;
    /**
     * 解析循环类型
     */
    private parseRecurrenceType;
}
export declare const scheduleService: ScheduleService;
//# sourceMappingURL=schedule-service.d.ts.map