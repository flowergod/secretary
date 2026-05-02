// 共用类型定义

export type EntityType = 'task' | 'event' | 'project';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | '待规划' | '待执行' | '进行中' | '已完成' | '暂停';

export type Priority = '高' | '中' | '低';

export type RecurrenceType = 'none' | 'weekly_monday' | 'weekly_tuesday' | 'weekly_wednesday' | 'weekly_thursday' | 'weekly_friday' | 'weekly_saturday' | 'weekly_sunday' | 'monthly' | 'after_complete' | 'custom' | 'weekly' | 'irregular' | '不循环' | '每周一' | '每周二' | '每周三' | '每周四' | '每周五' | '每周六' | '每周日' | '每月' | '完成后N天' | '自定义' | '每周' | '不定期';

export type GroupType = '日程表' | '其他' | '工作' | '生活' | '个人';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval?: string;        // e.g., "2 weeks", "1 month"
  start_from?: string;     // ISO date
  end_date?: string | null;
  days_after?: number;     // for after_complete type
  reminder?: boolean;
}

export interface TaskEntity {
  id: string;
  type: EntityType;
  title: string;
  description?: string;       // 备注
  status: TaskStatus;
  priority: Priority;
  due_date?: string;         // 计划日期 (timestamp ms)
  start_date?: string;       // 计划日期
  start_time?: string;        // 开始时间 (timestamp ms)
  end_time?: string;         // 结束时间 (timestamp ms)
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: RecurrenceRule;
  parent_id?: string;
  project_id?: string;
  project_name?: string;      // 项目
  subproject?: string;        // 子项目
  completion_date?: string;    // 完成时间
  completion_count?: number;   // 完成次数
  needs_expansion?: boolean;
  expansion_type?: string;
  group?: GroupType;          // 分组
  calendar_category?: string; // 日历分类
  tags?: string[];            // 标签
  url?: string;               // 链接
  source_text?: string;       // 来源文本
  feishu_event_id?: string;   // 飞书日历事件ID
  icloud_event_id?: string;   // iCloud事件ID
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
  morning: { enabled: boolean; time: string };
  evening: { enabled: boolean; time: string };
  weekendSummary: { enabled: boolean; time: string; dayOfWeek: number };
  preEvent: { enabled: boolean; minutesBefore: number };
  idleTime: { enabled: boolean; minFreeMinutes: number };
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
  calendarMapping?: Record<string, string>;  // 日历分类 -> iCloud 日历 ID 映射
}

export interface AppConfig {
  feishu: FeishuConfig;
  icloud: ICloudConfig;
  ai: AiConfig;
  reminders: ReminderConfig;
}
