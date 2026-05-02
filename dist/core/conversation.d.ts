export interface ConversationRequest {
    userId?: string;
    message: string;
}
export interface ConversationResponse {
    content: string;
    success: boolean;
}
export declare class ConversationEngine {
    /**
     * 处理用户对话
     */
    process(request: ConversationRequest): Promise<ConversationResponse>;
    /**
     * 处理创建操作
     */
    private handleCreate;
    /**
     * 处理更新操作
     */
    private handleUpdate;
    /**
     * 处理完成任务
     */
    private handleComplete;
    /**
     * 处理删除操作
     */
    private handleDelete;
    /**
     * 处理查询操作
     */
    private handleQuery;
    /**
     * 处理搜索操作
     */
    private handleSearch;
}
export declare const conversationEngine: ConversationEngine;
//# sourceMappingURL=conversation.d.ts.map