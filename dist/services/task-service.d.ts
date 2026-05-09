import { Task, TaskStatus, CreateTaskRequest, UpdateTaskRequest, ListTasksQuery, ListTasksResponse, TransitionTaskResponse, BatchDeleteTasksResponse, ApiResponse, ApiError } from '../shared/types';
export declare const ErrorCodes: {
    TASK_NOT_FOUND: number;
    TASK_CREATE_FAILED: number;
    TASK_UPDATE_FAILED: number;
    TASK_DELETE_FAILED: number;
    TASK_INVALID_TRANSITION: number;
    TASK_COMPLETED_NOT_TRANSITIONABLE: number;
    FEISHU_API_ERROR: number;
    RECURRING_TASK_CREATE_FAILED: number;
    RECURRING_SERIES_DELETE_FAILED: number;
};
export declare class TaskService {
    /**
     * 创建任务
     */
    create(req: CreateTaskRequest): Promise<ApiResponse<Task> | ApiError>;
    /**
     * 获取单个任务
     */
    get(id: string): Promise<ApiResponse<Task> | ApiError>;
    /**
     * 查询任务列表
     */
    list(query: ListTasksQuery): Promise<ApiResponse<ListTasksResponse> | ApiError>;
    /**
     * 更新任务
     */
    update(id: string, req: UpdateTaskRequest): Promise<ApiResponse<Task> | ApiError>;
    /**
     * 删除任务
     */
    delete(id: string): Promise<ApiResponse<{
        deleted: number;
    }> | ApiError>;
    /**
     * 删除循环任务全系列
     * 根据给定任务的 parent_id 找到所有关联的父子任务并删除
     * @param id 任意一个任务的ID（会自动查找全系列）
     */
    deleteRecurringSeries(id: string): Promise<ApiResponse<{
        deleted: number;
        seriesDeleted: number;
    }> | ApiError>;
    /**
     * 批量删除任务
     */
    batchDelete(ids: string[]): Promise<ApiResponse<BatchDeleteTasksResponse> | ApiError>;
    /**
     * 计算下一次循环任务的日期
     */
    private calculateNextOccurrence;
    /**
     * 完成任务（如果是循环任务，创建下一个循环实例）
     */
    complete(id: string): Promise<ApiResponse<Task> | ApiError>;
    /**
     * 状态变更（除完成外的状态变更）
     */
    transition(id: string, toStatus: TaskStatus): Promise<ApiResponse<TransitionTaskResponse> | ApiError>;
}
export declare const taskService: TaskService;
//# sourceMappingURL=task-service.d.ts.map