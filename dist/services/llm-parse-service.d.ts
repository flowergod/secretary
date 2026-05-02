import { ParsedIntent, ActionType, EntityType, Priority, RecurrenceType } from '../shared/types';
interface LearnedRule {
    pattern: string;
    action: ActionType;
    entityType: EntityType;
    priority: Priority;
    keywords: string[];
    calendarCategory?: string;
    recurrenceType?: RecurrenceType;
    confidence: number;
    useCount: number;
    lastUsed: string;
}
interface LLMParseResult {
    success: boolean;
    intent?: ParsedIntent;
    confidence: number;
    reasoning?: string;
    learnedRule?: Partial<LearnedRule>;
}
export declare class LLMParseService {
    private config;
    private learnedRulesPath;
    private learnedRules;
    constructor();
    /**
     * 解析用户输入
     * @param input 用户输入
     * @param context 上下文信息（可选）
     */
    parse(input: string, context?: {
        recentTasks?: string[];
    }): Promise<LLMParseResult>;
    /**
     * 构建用户提示词
     */
    private buildUserPrompt;
    /**
     * 解析 LLM 返回的 JSON
     */
    private parseLLMResponse;
    /**
     * 规范化动作类型
     */
    private normalizeAction;
    /**
     * 规范化实体类型
     */
    private normalizeEntityType;
    /**
     * 规范化优先级
     */
    private normalizePriority;
    /**
     * 规范化循环类型
     */
    private normalizeRecurrenceType;
    /**
     * 规范化分组
     */
    private normalizeGroup;
    /**
     * 从成功的解析中学习规则
     */
    private learnFromSuccess;
    /**
     * 提取模式（简化实现）
     */
    private extractPattern;
    /**
     * 提取关键词
     */
    private extractKeywords;
    /**
     * 生成规则唯一标识
     */
    private generateRuleKey;
    /**
     * 检查是否有已学习的规则匹配
     */
    checkLearnedRules(input: string): LearnedRule | undefined;
    /**
     * 获取学习到的规则数量
     */
    getLearnedRulesCount(): number;
    /**
     * 加载已学习的规则
     */
    private loadLearnedRules;
    /**
     * 保存已学习的规则
     */
    private saveLearnedRules;
}
export declare const llmParseService: LLMParseService;
export {};
//# sourceMappingURL=llm-parse-service.d.ts.map