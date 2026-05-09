import { IntentType, ParsedIntent } from './types';
import { Capability } from './types';
export declare class IntentParser {
    private static INTENT_MAP;
    private static ENTITY_TYPE_MAP;
    private capabilities;
    constructor(capabilities: Capability[]);
    parseIntentClassification(llmOutput: unknown, rawInput: string): {
        intent: ParsedIntent;
        missingParams: string[];
    };
    private isValidIntentOutput;
    private createDefaultResult;
    private normalizeParameters;
    private normalizeStatus;
    private normalizePriority;
    private normalizeCategory;
    private normalizeDate;
    private normalizeTime;
    getCapabilityForIntent(intent: IntentType): Capability | undefined;
    validateParameters(intent: IntentType, params: Record<string, unknown>): string[];
}
//# sourceMappingURL=intent-parser.d.ts.map