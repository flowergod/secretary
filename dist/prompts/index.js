"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptsIndex = exports.memoryLearning = exports.taskExpansion = exports.confirmationRequest = exports.parameterParsing = exports.entityExtraction = exports.intentClassification = void 0;
const intent_classification_json_1 = __importDefault(require("./templates/intent-classification.json"));
exports.intentClassification = intent_classification_json_1.default;
const entity_extraction_json_1 = __importDefault(require("./templates/entity-extraction.json"));
exports.entityExtraction = entity_extraction_json_1.default;
const parameter_parsing_json_1 = __importDefault(require("./templates/parameter-parsing.json"));
exports.parameterParsing = parameter_parsing_json_1.default;
const confirmation_request_json_1 = __importDefault(require("./templates/confirmation-request.json"));
exports.confirmationRequest = confirmation_request_json_1.default;
const task_expansion_json_1 = __importDefault(require("./templates/task-expansion.json"));
exports.taskExpansion = task_expansion_json_1.default;
const memory_learning_json_1 = __importDefault(require("./templates/memory-learning.json"));
exports.memoryLearning = memory_learning_json_1.default;
const prompts_index_json_1 = __importDefault(require("./prompts-index.json"));
exports.promptsIndex = prompts_index_json_1.default;
//# sourceMappingURL=index.js.map