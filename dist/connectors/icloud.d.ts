export interface ICloudEvent {
    uid?: string;
    title: string;
    description?: string;
    startDate: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    calendarId: string;
    recurrenceRule?: string;
    location?: string;
}
export interface Calendar {
    id: string;
    name: string;
    color?: string;
}
export declare class ICloudError extends Error {
    code: string;
    statusCode?: number | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined);
}
export declare class ICloudConnector {
    private appleId;
    private appPassword;
    calendarMapping: Record<string, string>;
    private baseUrl;
    private principalPath?;
    constructor();
    /**
     * 获取用户日历根路径
     * iCloud CalDAV 路径格式: /<user-id>/calendars/
     */
    private getPrincipalPath;
    /**
     * 构建日历事件路径
     */
    private getEventPath;
    /**
     * 构建日历查询路径
     */
    private getCalendarPath;
    /**
     * 获取认证头
     */
    private getAuthHeader;
    /**
     * 执行 CalDAV 请求
     */
    private executeRequest;
    /**
     * 将日期时间转换为 iCalendar 格式
     */
    private formatDateTime;
    /**
     * 生成 vCalendar 格式的事件
     */
    private generateVEvent;
    /**
     * 生成唯一 UID
     */
    private generateUID;
    /**
     * 添加小时
     */
    private addHours;
    /**
     * 转义 iCalendar 特殊字符
     */
    private escapeICalendar;
    /**
     * 解析 vEvent 从响应中
     */
    private parseVEventFromResponse;
    /**
     * 解析 iCalendar 日期时间格式
     */
    private parseIDateTime;
    /**
     * 反转义 iCalendar 特殊字符
     */
    private unescapeICalendar;
    /**
     * 创建日历事件
     */
    createEvent(event: ICloudEvent): Promise<string>;
    /**
     * 更新日历事件
     */
    updateEvent(uid: string, event: Partial<ICloudEvent>): Promise<void>;
    /**
     * 删除日历事件
     */
    deleteEvent(uid: string, calendarId: string): Promise<void>;
    /**
     * 查询指定日历的事件
     */
    queryEvents(calendarId: string, startDate?: string, endDate?: string): Promise<ICloudEvent[]>;
    /**
     * 获取日历列表
     */
    listCalendars(): Promise<Calendar[]>;
    /**
     * 解析日历列表响应
     */
    private parseCalendarList;
    /**
     * 获取日历 ID（通过分类名称）
     */
    getCalendarIdByCategory(category?: string): string | undefined;
    /**
     * 验证认证信息
     */
    validateCredentials(): Promise<boolean>;
}
export declare const icloudConnector: ICloudConnector;
//# sourceMappingURL=icloud.d.ts.map