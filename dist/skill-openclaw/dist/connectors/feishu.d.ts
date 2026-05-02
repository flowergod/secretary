import { TaskEntity } from '../shared/types';
export declare class FeishuConnector {
    private tableToken;
    private tableId;
    private appId;
    private appSecret;
    private webhookUrl?;
    private accessToken?;
    private tokenExpiry;
    constructor();
    /**
     * 获取访问令牌
     */
    private getAccessToken;
    /**
     * 创建任务/日程/项目记录
     */
    create(entity: TaskEntity): Promise<TaskEntity>;
    /**
     * 更新任务/日程/项目记录
     */
    update(id: string, entity: Partial<TaskEntity>): Promise<TaskEntity>;
    /**
     * 删除记录
     */
    delete(id: string): Promise<void>;
    /**
     * 获取单个记录
     */
    get(id: string): Promise<TaskEntity | null>;
    /**
     * 查询记录列表
     */
    query(filter?: {
        type?: string;
        status?: string;
        priority?: string;
        due_date?: string;
        start_date?: string;
        project_name?: string;
    }): Promise<TaskEntity[]>;
    /**
     * 搜索记录（支持模糊匹配）
     */
    search(keyword: string): Promise<TaskEntity[]>;
    /**
     * 发送飞书消息
     */
    sendMessage(content: string): Promise<void>;
    private executeFeishuAPI;
    /**
     * 将 TaskEntity 转换为飞书字段格式
     */
    private entityToFields;
    /**
     * 将飞书字段转换为 TaskEntity
     */
    private fieldsToEntity;
    /**
     * 提取飞书文本类型的值
     */
    private extractTextValue;
    /**
     * 解析日期字符串为时间戳
     */
    private parseDateToTimestamp;
    /**
     * 解析时间字符串 (HH:mm) 结合日期为时间戳
     */
    private parseTimeToTimestamp;
    /**
     * 将时间戳转换为 ISO 字符串
     */
    private timestampToISOString;
}
export declare const feishuConnector: FeishuConnector;
//# sourceMappingURL=feishu.d.ts.map