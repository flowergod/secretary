export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'weekly_n' | 'monthly' | 'monthly_n' | 'yearly' | 'yearly_n';
export interface Task {
    id: string;
    record_id?: string;
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
export interface TransitionTaskRequest {
    to_status: TaskStatus;
    reason?: string;
}
export interface BatchDeleteTasksRequest {
    ids: string[];
}
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
export interface ListTasksResponse {
    items: Task[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}
export interface TransitionTaskResponse {
    task: Task;
    from_status: TaskStatus;
    to_status: TaskStatus;
    transitioned_at: string;
}
export interface BatchDeleteTasksResponse {
    deleted: number;
    failed: number;
    errors?: string[];
}
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
export interface FeishuConfig {
    appId: string;
    appSecret: string;
    tableToken: string;
    tableId: string;
}
export interface ICloudConfig {
    appleId: string;
    appPassword: string;
    calendarMapping?: Record<string, string>;
}
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
export interface AppConfig {
    feishu: FeishuConfig;
    icloud: ICloudConfig;
    ai?: AIConfig;
    server?: {
        port?: number;
        host?: string;
    };
}
//# sourceMappingURL=types.d.ts.map