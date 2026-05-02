import { TaskEntity } from '../shared/types';
export interface ExpansionResult {
    shouldExpand: boolean;
    tasks: Partial<TaskEntity>[];
    reasoning?: string;
}
export declare class ExpansionEngine {
    private templates;
    /**
     * 判断是否需要智能拓展
     */
    shouldExpand(task: TaskEntity): Promise<ExpansionResult>;
    /**
     * 医疗复查拓展 - 3个月后提醒
     */
    private generateMedicalFollowup;
    /**
     * 开发进度规划拓展
     */
    private generateDevelopmentPlanning;
    /**
     * 默认拓展逻辑
     */
    private generateDefaultExpansion;
    /**
     * 解析 AI 返回的任务列表
     */
    private parseTasksFromResponse;
}
export declare const expansionEngine: ExpansionEngine;
//# sourceMappingURL=expansion.d.ts.map