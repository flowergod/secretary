import { Task, TaskStatus, TaskPriority } from '../shared/types';
export declare class FeishuConnector {
    private tableToken;
    private tableId;
    private appId;
    private appSecret;
    private accessToken?;
    private tokenExpiry;
    constructor();
    /**
     * 获取访问令牌
     */
    private getAccessToken;
    /**
     * 执行飞书 API
     */
    private executeAPI;
    /**
     * 创建任务记录
     */
    create(task: Task): Promise<Task>;
    /**
     * 更新任务记录
     * @param id 任务ID（用户设置的ID或record_id）
     * @param updates 要更新的字段
     * @param recordId record_id（用于API调用，可选）
     */
    update(id: string, updates: Partial<Task>, recordId?: string): Promise<Task>;
    /**
     * 删除任务记录
     */
    delete(id: string): Promise<void>;
    /**
     * 获取单个任务
     * 支持通过record_id或任务ID字段查询
     */
    get(id: string): Promise<Task | null>;
    /**
     * 查询任务列表
     */
    list(filter?: {
        status?: TaskStatus;
        priority?: TaskPriority;
        category?: string;
        due_date_from?: string;
        due_date_to?: string;
        start_date_from?: string;
        start_date_to?: string;
        is_recurring?: boolean;
        parent_id?: string;
        page?: number;
        page_size?: number;
    }): Promise<{
        items: Task[];
        total: number;
    }>;
    /**
     * 批量删除任务
     */
    batchDelete(ids: string[]): Promise<{
        deleted: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * 将 Task 转换为飞书字段格式
     */
    private taskToFields;
    /**
     * 将飞书字段转换为 Task
     */
    private fieldsToTask;
    /**
     * 提取飞书文本类型的值
     */
    private extractTextValue;
}
export declare const feishuConnector: FeishuConnector;
//# sourceMappingURL=feishu.d.ts.map