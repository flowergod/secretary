import { TaskEntity, ParsedIntent } from '../shared/types';
export interface CreateTaskResult {
    task: TaskEntity;
    expansionSuggestion?: string;
}
export declare class TaskService {
    /**
     * 创建任务
     */
    createTask(intent: ParsedIntent): Promise<CreateTaskResult>;
    /**
     * 计算循环任务的下次发生日期
     */
    private calculateNextOccurrence;
    /**
     * 创建循环任务的下次发生
     */
    private createNextOccurrence;
    /**
     * 完成任务
     */
    completeTask(taskId: string): Promise<TaskEntity>;
    /**
     * 更新任务
     */
    updateTask(taskId: string, updates: Partial<TaskEntity>): Promise<TaskEntity>;
    /**
     * 删除任务
     */
    deleteTask(taskId: string): Promise<void>;
    /**
     * 查询任务列表
     */
    queryTasks(filter: {
        status?: string;
        priority?: string;
        start_date?: string;
        due_date?: string;
    }): Promise<TaskEntity[]>;
    /**
     * 根据标题查找任务
     */
    findTaskByTitle(title: string): Promise<TaskEntity | null>;
}
export declare const taskService: TaskService;
//# sourceMappingURL=task-service.d.ts.map