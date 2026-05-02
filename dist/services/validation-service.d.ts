import { ParsedIntent } from '../shared/types';
export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];
    confirmationMessage?: string;
}
export declare class ValidationService {
    /**
     * 验证必填字段，如果无法判断，返回需要确认的信息
     */
    validate(intent: ParsedIntent): ValidationResult;
    /**
     * AI 判断分组
     */
    private suggestGroup;
    /**
     * AI 判断优先级
     */
    suggestPriority(text: string): string;
    /**
     * 填充缺失的必填字段默认值
     */
    fillDefaults(intent: ParsedIntent): ParsedIntent;
}
export declare const validationService: ValidationService;
//# sourceMappingURL=validation-service.d.ts.map