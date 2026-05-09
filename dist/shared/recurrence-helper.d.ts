export interface RecurrenceConfig {
    recurrence_type: 'none' | 'daily' | 'weekly' | 'weekly_n' | 'monthly' | 'monthly_n' | 'yearly' | 'yearly_n';
    recurrence_rule?: string;
    is_recurring: boolean;
}
/**
 * 从自然语言生成循环规则
 * @param description 中文描述，例如："每周二四"、"每月15号"、"每月第一个周一"
 * @returns RecurrenceConfig 对象
 */
export declare function parseRecurrence(description: string): RecurrenceConfig;
/**
 * 生成循环规则的中文描述
 */
export declare function describeRecurrence(config: RecurrenceConfig): string;
export declare const recurrenceHelper: {
    parse: typeof parseRecurrence;
    describe: typeof describeRecurrence;
};
//# sourceMappingURL=recurrence-helper.d.ts.map