export type EntityType = 'task' | 'event' | 'project';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | '待规划' | '待执行' | '进行中' | '已完成' | '暂停';
export type Priority = '高' | '中' | '低';
export type RecurrenceType = 'none' | 'weekly_monday' | 'weekly_tuesday' | 'weekly_wednesday' | 'weekly_thursday' | 'weekly_friday' | 'weekly_saturday' | 'weekly_sunday' | 'monthly' | 'after_complete' | 'custom' | 'weekly' | 'irregular' | '不循环' | '每周一' | '每周二' | '每周三' | '每周四' | '每周五' | '每周六' | '每周日' | '每月' | '完成后N天' | '自定义' | '每周' | '不定期';
export type GroupType = '日程表' | '其他' | '工作' | '生活' | '个人';
export interface RecurrenceRule {
    type: RecurrenceType;
    interval?: string;
    start_from?: string;
    end_date?: string | null;
    days_after?: number;
    reminder?: boolean;
}
export interface TaskEntity {
    id: string;
    type: EntityType;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    due_date?: string;
    start_date?: string;
    start_time?: string;
    end_time?: string;
    is_recurring: boolean;
    recurrence_type?: RecurrenceType;
    recurrence_rule?: RecurrenceRule;
    parent_id?: string;
    project_id?: string;
    project_name?: string;
    subproject?: string;
    completion_date?: string;
    completion_count?: number;
    needs_expansion?: boolean;
    expansion_type?: string;
    group?: GroupType;
    calendar_category?: string;
    tags?: string[];
    url?: string;
    source_text?: string;
    feishu_event_id?: string;
    icloud_event_id?: string;
    created_at: string;
    updated_at: string;
}
export type ActionType = 'create' | 'update' | 'delete' | 'complete' | 'query' | 'search';
export interface ParsedIntent {
    action: ActionType;
    entityType: EntityType;
    entity: Partial<TaskEntity>;
    targetId?: string;
    needsExpansion?: boolean;
    expansionType?: string;
    queryType?: string;
    searchQuery?: string;
}
export interface ReminderConfig {
    morning: {
        enabled: boolean;
        time: string;
    };
    evening: {
        enabled: boolean;
        time: string;
    };
    weekendSummary: {
        enabled: boolean;
        time: string;
        dayOfWeek: number;
    };
    preEvent: {
        enabled: boolean;
        minutesBefore: number;
    };
    idleTime: {
        enabled: boolean;
        minFreeMinutes: number;
    };
}
export interface AiConfig {
    primary: {
        provider: 'volcano' | 'minimax';
        apiKey: string;
        baseUrl?: string;
        model?: string;
    };
    fallback: {
        provider: 'volcano' | 'minimax';
        apiKey: string;
        baseUrl?: string;
        model?: string;
    };
}
export interface NLParseConfig {
    enabled: boolean;
    fallbackThreshold: number;
    learnFromSuccess: boolean;
    maxRetries: number;
}
export interface FeishuConfig {
    appId: string;
    appSecret: string;
    webhookUrl?: string;
    tableToken: string;
    tableId: string;
}
export interface ICloudConfig {
    appleId: string;
    appPassword: string;
    calendarMapping?: Record<string, string>;
}
export interface AppConfig {
    feishu: FeishuConfig;
    icloud: ICloudConfig;
    ai: AiConfig;
    reminders: ReminderConfig;
    nlParse?: NLParseConfig;
}
//# sourceMappingURL=types.d.ts.map