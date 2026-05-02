import { TaskEntity } from '../shared/types';
export declare class ResponseFormatter {
    /**
     * 格式化任务创建确认
     */
    formatTaskCreated(task: TaskEntity, suggestion?: string): string;
    /**
     * 格式化任务完成确认
     */
    formatTaskCompleted(task: TaskEntity): string;
    /**
     * 格式化日程列表
     */
    formatScheduleList(events: TaskEntity[], date?: string): string;
    /**
     * 格式化搜索结果
     */
    formatSearchResults(results: TaskEntity[], query?: string): string;
    /**
     * 格式化项目进度
     */
    formatProjectProgress(project: TaskEntity, progress: {
        total: number;
        completed: number;
        percentage: number;
    }): string;
    /**
     * 格式化错误消息
     */
    formatError(message: string): string;
    /**
     * 格式化帮助信息
     */
    formatHelp(): string;
    private formatEntityType;
    private formatPriority;
    private formatStatus;
    private formatDateTime;
    private getEntityTypeIcon;
}
export declare const responseFormatter: ResponseFormatter;
//# sourceMappingURL=response-formatter.d.ts.map