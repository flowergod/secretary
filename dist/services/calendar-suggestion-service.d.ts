import { ParsedIntent } from '../shared/types';
interface CalendarSuggestion {
    category: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    needsConfirmation: boolean;
}
export declare class CalendarSuggestionService {
    /**
     * 分析任务内容，建议日历分类
     */
    suggestCalendar(intent: ParsedIntent): CalendarSuggestion;
    /**
     * 生成确认问题
     */
    askForConfirmation(suggestion: CalendarSuggestion): string;
}
export declare const calendarSuggestionService: CalendarSuggestionService;
export {};
//# sourceMappingURL=calendar-suggestion-service.d.ts.map