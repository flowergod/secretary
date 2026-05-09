import { PromptTemplate, Capability } from './types';
import { MentionRecord } from './context-manager';
export type PromptType = 'intent_classification' | 'parameter_extraction' | 'confirmation' | 'contextual_understanding' | 'reference_resolution';
export declare class PromptManager {
    private templates;
    constructor();
    private loadTemplates;
    getTemplate(type: PromptType): PromptTemplate | undefined;
    renderIntentClassification(userInput: string, capabilities: Capability[], resolvedContext?: {
        resolvedTaskId?: string;
        resolvedRecordId?: string;
        resolvedTaskTitle?: string;
    }): {
        system: string;
        user: string;
    };
    renderParameterExtraction(intent: string, userInput: string, timeEntities?: Record<string, string>): {
        system: string;
        user: string;
    };
    renderConfirmation(userInput: string, intent: string, parameters: Record<string, unknown>, missingInfo: string[]): {
        system: string;
        user: string;
    };
    renderContextualUnderstanding(confirmationQuestion: string, options: Array<{
        id: string;
        label: string;
    }>, userInput: string): {
        system: string;
        user: string;
    };
    renderReferenceResolution(userInput: string, recentMentions: MentionRecord[]): {
        system: string;
        user: string;
    };
    listPromptTypes(): PromptType[];
}
//# sourceMappingURL=prompt-manager.d.ts.map