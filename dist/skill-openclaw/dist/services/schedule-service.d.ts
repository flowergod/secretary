import { TaskEntity, ParsedIntent } from '../shared/types';
export declare class ScheduleService {
    /**
     * 创建日程/事件
     */
    createEvent(intent: ParsedIntent): Promise<TaskEntity>;
    /**
     * 获取今天的日程
     */
    getTodayEvents(): Promise<TaskEntity[]>;
    /**
     * 获取即将到来的日程（未来 N 分钟）
     */
    getUpcomingEvents(minutes?: number): Promise<TaskEntity[]>;
    /**
     * 更新日程
     */
    updateEvent(eventId: string, updates: Partial<TaskEntity>): Promise<TaskEntity>;
    /**
     * 删除日程
     */
    deleteEvent(eventId: string): Promise<void>;
    /**
     * 查询指定日期范围的日程
     */
    queryEventsByDateRange(startDate: string, endDate: string): Promise<TaskEntity[]>;
}
export declare const scheduleService: ScheduleService;
//# sourceMappingURL=schedule-service.d.ts.map