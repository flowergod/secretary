import { ParsedIntent } from '../shared/types';
export declare class NLParser {
    /**
     * 解析用户输入，提取意图和实体
     */
    parse(input: string): ParsedIntent[];
    private createContext;
    private detectAction;
    private detectEntityType;
    private detectPriority;
    private extractTitle;
    private extractDate;
    private getNextWeekday;
    private extractTime;
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