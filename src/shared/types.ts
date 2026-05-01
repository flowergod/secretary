// 共用类型定义

export type EntityType = 'task' | 'event' | 'project';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type Priority = 'high' | 'medium' | 'low';

export type RecurrenceType = 'fixed_interval' | 'after_complete';

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
  description?: string;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;       // ISO date
  start_date?: string;      // ISO date
  start_time?: string;      // HH:mm
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: RecurrenceRule;
  parent_id?: string;
  project_id?: string;
  completion_date?: string;  // ISO datetime
  needs_expansion?: boolean;
  expansion_type?: string;
  created_at: string;        // ISO datetime
  updated_at: string;        // ISO datetime
}

export type ActionType = 'create' | 'update' | 'delete' | 'complete' | 'query' | 'search';

export interface ParsedIntent {
  action: ActionType;
  entityType: EntityType;
  entity: Partial<TaskEntity>;
  targetId?: string;         // for update/delete/complete
  needsExpansion?: boolean;
  expansionType?: string;
  queryType?: string;        // for query action
  searchQuery?: string;      // for search action
}

export interface ReminderConfig {
  morning: { enabled: boolean; time: string };      // "8:30"
  evening: { enabled: boolean; time: string };      // "21:00"
  weekendSummary: { enabled: boolean; time: string; dayOfWeek: number }; // 5 = Friday
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
  webhookUrl: string;
  tableToken: string;
}

export interface ICloudConfig {
  appleId: string;
  appPassword: string;
}

export interface AppConfig {
  feishu: FeishuConfig;
  icloud: ICloudConfig;
  ai: AiConfig;
  reminders: ReminderConfig;
}
