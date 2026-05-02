import { ParsedIntent } from '../shared/types';
export declare class NLParser {
    /**
     * 解析用户输入，提取意图和实体
     * 支持多事件拆分：输入包含多个事件时，返回多个 ParsedIntent
     */
    parse(input: string): ParsedIntent[];
    /**
     * 拆分多事件输入
     * 分隔符：逗号（,，）、句号（.。）、分号（;；）
     * 但要避免拆分时间范围中的 ~ 符号
     */
    private splitMultipleEvents;
    private createContext;
    private detectAction;
    private detectEntityType;
    private detectPriority;
    private extractTitle;
    private extractDate;
    private getNextWeekday;
    private extractTime;
    /**
     * 从时间范围字符串中提取结束时间
     * 支持格式: "9:30~11:30", "9：30~11：30", "9点~10点"
     */
    private extractEndTime;
    private extractRecurrence;
    private detectNeedsExpansion;
    private buildCreateIntent;
    private buildUpdateIntent;
    private buildDeleteIntent;
    private buildCompleteIntent;
    private buildQueryIntent;
    private buildSearchIntent;
}
export declare const nlParser: NLParser;
//# sourceMappingURL=nl-parser.d.ts.map