import intentClassification from './templates/intent-classification.json';
import entityExtraction from './templates/entity-extraction.json';
import parameterParsing from './templates/parameter-parsing.json';
import confirmationRequest from './templates/confirmation-request.json';
import taskExpansion from './templates/task-expansion.json';
import memoryLearning from './templates/memory-learning.json';
import promptsIndex from './prompts-index.json';
export { intentClassification, entityExtraction, parameterParsing, confirmationRequest, taskExpansion, memoryLearning, promptsIndex, };
export type PromptType = 'intent_classification' | 'entity_extraction' | 'parameter_parsing' | 'confirmation_request' | 'task_expansion' | 'memory_learning';
export interface PromptTemplate {
    id: string;
    type: PromptType;
    version: string;
    description: string;
    variables: string[];
    content: string;
    examples?: Array<{
        input: string;
        output: string;
    }>;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=index.d.ts.map