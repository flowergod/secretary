"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentParser = void 0;
// 意图解析器 - 解析LLM输出，验证格式，提取意图和参数
const types_1 = require("./types");
const logger_1 = require("../shared/logger");
class IntentParser {
    constructor(capabilities) {
        this.capabilities = capabilities;
    }
    // 解析LLM返回的意图分类结果
    parseIntentClassification(llmOutput, rawInput) {
        // 验证LLM输出格式
        if (!this.isValidIntentOutput(llmOutput)) {
            logger_1.logger.warn('[IntentParser] Invalid LLM output format:', llmOutput);
            return this.createDefaultResult(rawInput);
        }
        const output = llmOutput;
        // 转换意图
        const intent = IntentParser.INTENT_MAP[output.intent] || types_1.IntentType.OTHER;
        const entityType = IntentParser.ENTITY_TYPE_MAP[output.entity_type] || 'task';
        // 获取对应的能力
        const capability = this.capabilities.find(c => c.intent === intent);
        // 检查缺失的必填参数
        const missingParams = capability
            ? capability.requiredParams.filter(p => !(output.parameters && output.parameters[p]))
            : [];
        // 置信度太低，需要用户交互确认
        const lowConfidence = output.confidence < 0.7;
        // 如果能力需要确认、置信度低、或参数缺失，标记需要确认
        const needsConfirmation = output.needsConfirmation ||
            lowConfidence ||
            missingParams.length > 0;
        const parsedIntent = {
            intent,
            entityType,
            parameters: this.normalizeParameters(output.parameters || {}, intent),
            confidence: output.confidence,
            needsConfirmation,
            lowConfidence,
            reasoning: output.reasoning,
            rawInput,
        };
        logger_1.logger.debug('[IntentParser] Parsed intent:', parsedIntent);
        return { intent: parsedIntent, missingParams };
    }
    // 验证LLM输出是否有效
    isValidIntentOutput(output) {
        if (!output || typeof output !== 'object')
            return false;
        const obj = output;
        return (typeof obj.intent === 'string' &&
            typeof obj.entity_type === 'string' &&
            (typeof obj.parameters === 'object' || obj.parameters === undefined) &&
            typeof obj.confidence === 'number');
    }
    // 创建默认结果（当解析失败时）
    createDefaultResult(rawInput) {
        return {
            intent: {
                intent: types_1.IntentType.OTHER,
                entityType: 'task',
                parameters: {},
                confidence: 0,
                needsConfirmation: true,
                lowConfidence: true,
                reasoning: '无法解析意图',
                rawInput,
            },
            missingParams: ['title'],
        };
    }
    // 标准化参数格式
    normalizeParameters(params, intent) {
        const normalized = {};
        for (const [key, value] of Object.entries(params)) {
            if (value === null || value === undefined)
                continue;
            switch (key) {
                case 'title':
                case 'description':
                    normalized[key] = String(value);
                    break;
                case 'status':
                    normalized[key] = this.normalizeStatus(String(value));
                    break;
                case 'priority':
                    normalized[key] = this.normalizePriority(String(value));
                    break;
                case 'category':
                    normalized[key] = this.normalizeCategory(String(value));
                    break;
                case 'start_date':
                case 'due_date':
                    normalized[key] = this.normalizeDate(String(value));
                    break;
                case 'start_time':
                case 'end_time':
                    normalized[key] = this.normalizeTime(String(value));
                    break;
                case 'is_recurring':
                    normalized[key] = value === true || value === 'true';
                    break;
                default:
                    normalized[key] = value;
            }
        }
        return normalized;
    }
    // 标准化状态值
    normalizeStatus(status) {
        const map = {
            '待办': 'pending',
            '进行中': 'in_progress',
            '已完成': 'completed',
            '已取消': 'cancelled',
            'pending': 'pending',
            'in_progress': 'in_progress',
            'completed': 'completed',
            'cancelled': 'cancelled',
        };
        return map[status] || 'pending';
    }
    // 标准化优先级
    normalizePriority(priority) {
        const map = {
            '高': 'high',
            '中': 'medium',
            '低': 'low',
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
        };
        return map[priority] || 'medium';
    }
    // 标准化分类
    normalizeCategory(category) {
        const map = {
            '工作': '工作',
            '个人': '个人',
            '家庭': '家庭',
            'work': '工作',
            'personal': '个人',
        };
        return map[category] || category;
    }
    // 标准化日期格式
    normalizeDate(dateStr) {
        const lower = dateStr.toLowerCase();
        // 处理相对日期关键词
        if (lower === 'today' || lower === 'todya' || lower === "今天" || lower === '今日') {
            return new Date().toISOString().split('T')[0];
        }
        if (lower === 'tomorrow' || lower === 'tmr' || lower === 'tmrw' || lower === "明天" || lower === '明日') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(12, 0, 0, 0); // 中午避免时区问题
            return tomorrow.toISOString().split('T')[0];
        }
        // 移除可能的时间部分
        const date = dateStr.split('T')[0];
        // 验证格式
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            // 解析日期字符串，提取年月日
            const [year, month, day] = date.split('-').map(Number);
            // 构建今天的日期部分（只用年月日）
            const today = new Date();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth() + 1;
            const todayDay = today.getDate();
            // 如果日期在过去，将其视为今天
            if (year < todayYear ||
                (year === todayYear && month < todayMonth) ||
                (year === todayYear && month === todayMonth && day < todayDay)) {
                logger_1.logger.info(`[IntentParser] Date ${date} is in the past, treating as today`);
                return `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
            }
            return date;
        }
        return dateStr;
    }
    // 标准化时间格式
    normalizeTime(timeStr) {
        // HH:MM 格式
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
            return timeStr.padStart(5, '0');
        }
        return timeStr;
    }
    // 获取意图对应的能力
    getCapabilityForIntent(intent) {
        return this.capabilities.find(c => c.intent === intent);
    }
    // 验证参数是否完整
    validateParameters(intent, params) {
        const capability = this.getCapabilityForIntent(intent);
        if (!capability) {
            return ['未知意图类型'];
        }
        const missing = [];
        for (const required of capability.requiredParams) {
            if (!params[required]) {
                missing.push(required);
            }
        }
        return missing;
    }
}
exports.IntentParser = IntentParser;
// 意图字符串到枚举的映射
IntentParser.INTENT_MAP = {
    'create_task': types_1.IntentType.CREATE_TASK,
    'query_tasks': types_1.IntentType.QUERY_TASKS,
    'query_events': types_1.IntentType.QUERY_EVENTS,
    'update_task': types_1.IntentType.UPDATE_TASK,
    'complete_task': types_1.IntentType.COMPLETE_TASK,
    'delete_task': types_1.IntentType.DELETE_TASK,
    'expand_task': types_1.IntentType.EXPAND_TASK,
    'other': types_1.IntentType.OTHER,
};
// 实体类型字符串到枚举的映射
IntentParser.ENTITY_TYPE_MAP = {
    'task': 'task',
    'event': 'event',
    'calendar': 'calendar',
};
//# sourceMappingURL=intent-parser.js.map