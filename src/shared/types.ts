// 共享类型定义

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// 任务优先级
export type TaskPriority = 'high' | 'medium' | 'low';

// 循环类型
export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'weekly_n'
  | 'monthly'
  | 'monthly_n'
  | 'yearly'
  | 'yearly_n';

// 任务实体
export interface Task {
  id: string;
  record_id?: string; // 飞书系统生成的record_id，用于API操作
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category?: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_recurring: boolean;
  recurrence_type: RecurrenceType;
  recurrence_rule?: string;
  icloud_event_id?: string;
  parent_id?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

// 创建任务请求
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  category?: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: string;
  icloud_event_id?: string;
  parent_id?: string;
  source?: string;
}

// 更新任务请求
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  due_date?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_rule?: string;
  parent_id?: string;
  source?: string;
}

// 状态变更请求
export interface TransitionTaskRequest {
  to_status: TaskStatus;
  reason?: string;
}

// 批量删除请求
export interface BatchDeleteTasksRequest {
  ids: string[];
}

// 任务列表查询参数
export interface ListTasksQuery {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  due_date?: string;
  due_date_from?: string;
  due_date_to?: string;
  start_date?: string;
  start_date_from?: string;
  start_date_to?: string;
  is_recurring?: boolean;
  parent_id?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// 任务列表响应
export interface ListTasksResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 状态变更响应
export interface TransitionTaskResponse {
  task: Task;
  from_status: TaskStatus;
  to_status: TaskStatus;
  transitioned_at: string;
}

// 批量删除响应
export interface BatchDeleteTasksResponse {
  deleted: number;
  failed: number;
  errors?: string[];
}

// API 响应格式
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: number;
    message: string;
    details?: string;
  };
}

// 飞书配置
export interface FeishuConfig {
  appId: string;
  appSecret: string;
  tableToken: string;
  tableId: string;
}

// iCloud 配置
export interface ICloudConfig {
  appleId: string;
  appPassword: string;
  calendarMapping?: Record<string, string>;
}

// AI/LLM 配置
export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIConfig {
  primary?: AIProviderConfig;
  fallback?: AIProviderConfig;
}

// 应用配置
export interface AppConfig {
  feishu: FeishuConfig;
  icloud: ICloudConfig;
  ai?: AIConfig;
  server?: {
    port?: number;
    host?: string;
  };
}
