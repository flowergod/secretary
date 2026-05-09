"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapabilityDispatcher = void 0;
// 能力分发器 - 根据意图分发到对应的执行器
const types_1 = require("./types");
const services_1 = require("../services");
const logger_1 = require("../shared/logger");
// 有效的 category 值（与 config.yaml 的 calendarMapping 对应）
const VALID_CATEGORIES = ['工作', '个人', '家庭共享'];
const DEFAULT_CATEGORY = '工作';
// 校验并规范化 category
function normalizeCategory(category) {
    if (typeof category !== 'string') {
        return DEFAULT_CATEGORY;
    }
    // 检查是否匹配有效值（支持中英文）
    const mapping = {
        '工作': '工作', 'work': '工作',
        '个人': '个人', 'personal': '个人',
        '家庭共享': '家庭共享', '家庭': '家庭共享', 'family': '家庭共享',
    };
    const normalized = mapping[category];
    if (normalized) {
        return normalized;
    }
    // 不匹配任何已知值时，尝试从字符串中提取有效的分类
    const trimmed = category.trim();
    for (const key of Object.keys(mapping)) {
        if (trimmed === key || trimmed.startsWith(key) || trimmed.includes(key)) {
            logger_1.logger.info(`[CapabilityDispatcher] Category "${category}" matched via "${key}" -> "${mapping[key]}"`);
            return mapping[key];
        }
    }
    // 如果包含"家庭"相关词，默认为家庭共享
    if (trimmed.includes('家庭') || trimmed.includes('family')) {
        logger_1.logger.info(`[CapabilityDispatcher] Category "${category}" contains 家庭, using 家庭共享`);
        return '家庭共享';
    }
    // 如果包含"个人"相关词，默认为个人
    if (trimmed.includes('个人') || trimmed.includes('personal')) {
        logger_1.logger.info(`[CapabilityDispatcher] Category "${category}" contains 个人, using 个人`);
        return '个人';
    }
    // 如果包含"工作"相关词，默认为工作
    if (trimmed.includes('工作') || trimmed.includes('work')) {
        logger_1.logger.info(`[CapabilityDispatcher] Category "${category}" contains 工作, using 工作`);
        return '工作';
    }
    logger_1.logger.warn(`[CapabilityDispatcher] Invalid category "${category}", using default "${DEFAULT_CATEGORY}"`);
    return DEFAULT_CATEGORY;
}
// 能力定义
const CAPABILITIES = [
    {
        id: 'task.create',
        name: '创建任务',
        intent: types_1.IntentType.CREATE_TASK,
        requiredParams: ['title'],
        optionalParams: ['description', 'priority', 'category', 'due_date', 'due_time', 'start_date', 'start_time'],
        description: '创建新的待办任务（包含具体时间时自动同步到日历）',
        examples: ['创建任务', '添加待办', '新建任务', '安排明天开会'],
    },
    {
        id: 'task.query',
        name: '查询任务',
        intent: types_1.IntentType.QUERY_TASKS,
        requiredParams: [],
        optionalParams: ['status', 'priority', 'category', 'date', 'due_date_from', 'due_date_to'],
        description: '查询任务列表',
        examples: ['查看任务', '我的任务', '有什么任务'],
    },
    {
        id: 'event.query',
        name: '查询日程',
        intent: types_1.IntentType.QUERY_EVENTS,
        requiredParams: [],
        optionalParams: ['date', 'start_date', 'end_date', 'category'],
        description: '查询日历日程',
        examples: ['今日日程', '明天安排', '日程查询'],
    },
    {
        id: 'task.update',
        name: '修改任务',
        intent: types_1.IntentType.UPDATE_TASK,
        requiredParams: ['title'],
        optionalParams: ['description', 'priority', 'category', 'due_date', 'due_time'],
        description: '修改现有任务',
        examples: ['修改任务', '更新任务', '调整任务'],
    },
    {
        id: 'task.complete',
        name: '完成任务',
        intent: types_1.IntentType.COMPLETE_TASK,
        requiredParams: [],
        optionalParams: ['title'],
        description: '将任务标记为完成',
        examples: ['完成任务', '标记完成', '搞定了'],
    },
    {
        id: 'task.delete',
        name: '删除任务',
        intent: types_1.IntentType.DELETE_TASK,
        requiredParams: [],
        optionalParams: ['title'],
        description: '删除任务',
        examples: ['删除任务', '删掉任务'],
    },
];
class CapabilityDispatcher {
    constructor() {
        this.capabilities = CAPABILITIES;
    }
    // 获取所有能力
    getAllCapabilities() {
        return this.capabilities;
    }
    // 根据意图分发执行
    async dispatch(parsedIntent) {
        logger_1.logger.info(`[CapabilityDispatcher] Dispatching intent: ${parsedIntent.intent}`);
        try {
            switch (parsedIntent.intent) {
                case types_1.IntentType.CREATE_TASK:
                    return await this.createTask(parsedIntent.parameters);
                case types_1.IntentType.CREATE_EVENT:
                    return await this.createEvent(parsedIntent.parameters);
                case types_1.IntentType.QUERY_TASKS:
                    return await this.queryTasks(parsedIntent.parameters);
                case types_1.IntentType.QUERY_EVENTS:
                    return await this.queryEvents(parsedIntent.parameters);
                case types_1.IntentType.COMPLETE_TASK:
                    return await this.completeTask(parsedIntent.parameters);
                case types_1.IntentType.DELETE_TASK:
                    return await this.deleteTask(parsedIntent.parameters);
                case types_1.IntentType.UPDATE_TASK:
                    return await this.updateTask(parsedIntent);
                case types_1.IntentType.UPDATE_EVENT:
                    return await this.updateEvent(parsedIntent);
                case types_1.IntentType.EXPAND_TASK:
                    // 智能规划意图 - 转换为创建任务
                    return await this.createTask(parsedIntent.parameters);
                case types_1.IntentType.OTHER:
                    // 其他意图 - 尝试创建为任务
                    return await this.createTask(parsedIntent.parameters);
                default:
                    return {
                        success: false,
                        error: `不支持的意图类型: ${parsedIntent.intent}`,
                    };
            }
        }
        catch (error) {
            logger_1.logger.error(`[CapabilityDispatcher] Dispatch error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '执行失败',
            };
        }
    }
    // 创建任务
    async createTask(params) {
        // 如果包含具体时间，自动同步到日历
        const hasSpecificTime = params.start_date || params.start_time;
        // 处理循环参数 - 支持多种格式:
        // 1. recurring: "weekly" (字符串)
        // 2. recurring: {pattern: "weekly", count: 5} (对象)
        // 3. recurrence_rule: "weekly" 或 "FREQ=WEEKLY;COUNT=5"
        // 4. is_recurring: true + recurrence_type: "weekly"
        let isRecurring = params.is_recurring === true || params.is_recurring === 'true';
        let pattern;
        let count;
        let until;
        let recurrenceRule;
        let recurrenceType = 'none';
        // 检查 recurring 参数
        const recurringParam = params.recurring;
        if (recurringParam) {
            if (typeof recurringParam === 'string') {
                pattern = recurringParam.toLowerCase();
            }
            else if (typeof recurringParam === 'object') {
                const recurringObj = recurringParam;
                pattern = recurringObj.pattern?.toLowerCase();
                count = recurringObj.count;
                until = recurringObj.until;
            }
        }
        // 检查 frequency 参数 (如 "weekly", "daily")
        const frequencyParam = params.frequency;
        if (frequencyParam && !pattern) {
            pattern = frequencyParam.toLowerCase();
            isRecurring = true;
        }
        // 检查 monthly_day / day_of_month 参数 (如 "每个月24号")
        const monthlyDayParam = (params.monthly_day || params.day_of_month);
        // 检查 recurrence_rule 参数 (如 "weekly", "FREQ=WEEKLY;COUNT=5")
        const recurrenceRuleParam = params.recurrence_rule;
        if (recurrenceRuleParam && !pattern) {
            const upperRule = recurrenceRuleParam.toUpperCase();
            if (upperRule.includes('FREQ=WEEKLY')) {
                pattern = 'weekly';
            }
            else if (upperRule.includes('FREQ=DAILY')) {
                pattern = 'daily';
            }
            else if (upperRule.includes('FREQ=MONTHLY')) {
                pattern = 'monthly';
            }
            else if (upperRule.includes('FREQ=YEARLY')) {
                pattern = 'yearly';
            }
            else {
                pattern = recurrenceRuleParam.toLowerCase();
            }
            isRecurring = true;
        }
        // 检查单独的 recurrence_type 参数
        const recurrenceTypeParam = params.recurrence_type;
        if (recurrenceTypeParam && !pattern) {
            pattern = recurrenceTypeParam.toLowerCase();
            isRecurring = true;
        }
        // 如果有 pattern，设置 recurrenceType
        if (pattern) {
            switch (pattern) {
                case 'daily':
                    recurrenceType = 'daily';
                    break;
                case 'weekly':
                    recurrenceType = 'weekly';
                    break;
                case 'monthly':
                    recurrenceType = 'monthly';
                    break;
                case 'yearly':
                    recurrenceType = 'yearly';
                    break;
                default:
                    recurrenceType = 'weekly';
            }
            // 生成 RRULE
            let rruleParts = [`FREQ=${pattern.toUpperCase()}`];
            // 对于月历，如果指定了 monthly_day，添加 BYMONTHDAY
            if (pattern === 'monthly' && monthlyDayParam) {
                rruleParts.push(`BYMONTHDAY=${monthlyDayParam}`);
            }
            if (recurrenceRuleParam && recurrenceRuleParam.toUpperCase().includes('COUNT=')) {
                const countMatch = recurrenceRuleParam.match(/COUNT=(\d+)/);
                if (countMatch) {
                    count = parseInt(countMatch[1], 10);
                }
            }
            if (count) {
                rruleParts.push(`COUNT=${count}`);
            }
            else if (until) {
                rruleParts.push(`UNTIL=${until}`);
            }
            else {
                rruleParts.push('COUNT=10'); // 默认10次
            }
            recurrenceRule = `RRULE:${rruleParts.join(';')}`;
            isRecurring = true;
        }
        // 转换特殊日期值 (today, tomorrow) 为实际日期
        const normalizeDate = (dateStr) => {
            if (!dateStr)
                return undefined;
            const lower = dateStr.toLowerCase();
            // 直接处理特殊关键词
            if (lower === 'today' || lower === 'todya' || lower === 'todya') {
                const today = new Date();
                return today.toISOString().split('T')[0];
            }
            if (lower === 'tomorrow' || lower === 'tmr' || lower === 'tmrw') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0); // 中午避免时区问题
                return tomorrow.toISOString().split('T')[0];
            }
            // 检查是否是有效日期格式 (YYYY-MM-DD)
            const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
                // 使用本地日期部分构建日期，避免时区问题
                const [year, month, day] = dateMatch.slice(1).map(Number);
                const inputDate = new Date(year, month - 1, day); // 本地时区的日期
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // 比较日期部分（忽略时间）
                const inputDay = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
                const todayTime = today.setHours(0, 0, 0, 0);
                // 如果日期在过去，将其视为今天
                if (inputDay < todayTime) {
                    logger_1.logger.info(`[CapabilityDispatcher] Date ${dateStr} is in the past, treating as today`);
                    return new Date().toISOString().split('T')[0];
                }
                return dateStr;
            }
            // 检查 "next Monday" 等相对日期
            if (lower.includes('next ')) {
                const dayMap = {
                    'sunday': 0, 'sun': 0,
                    'monday': 1, 'mon': 1,
                    'tuesday': 2, 'tue': 2,
                    'wednesday': 3, 'wed': 3,
                    'thursday': 4, 'thu': 4,
                    'friday': 5, 'fri': 5,
                    'saturday': 6, 'sat': 6
                };
                for (const [day, dayNum] of Object.entries(dayMap)) {
                    if (lower.includes(day)) {
                        const nextDay = new Date();
                        const daysUntil = (dayNum - nextDay.getDay() + 7) % 7 || 7;
                        nextDay.setDate(nextDay.getDate() + daysUntil);
                        return nextDay.toISOString().split('T')[0];
                    }
                }
            }
            return dateStr;
        };
        // 如果有 start_time 但没有 start_date，默认设置为今天
        let startDate = normalizeDate(params.start_date);
        if (params.start_time && !startDate) {
            const today = new Date();
            startDate = today.toISOString().split('T')[0];
        }
        // 校验 category
        const category = normalizeCategory(params.category);
        // 处理 monthly_day 参数 (如 "每个月24号")
        if (monthlyDayParam && !startDate) {
            // 计算下一个月的该日期
            const now = new Date();
            const currentDay = now.getDate();
            let targetMonth = now.getMonth();
            let targetYear = now.getFullYear();
            if (currentDay >= monthlyDayParam) {
                // 下个月
                targetMonth++;
                if (targetMonth > 11) {
                    targetMonth = 0;
                    targetYear++;
                }
            }
            // 检查该月是否有这一天
            const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const actualDay = Math.min(monthlyDayParam, daysInMonth);
            // 使用本地日期格式，避免 UTC 时区问题
            const targetDate = new Date(targetYear, targetMonth, actualDay);
            const yyyy = targetDate.getFullYear();
            const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDate.getDate()).padStart(2, '0');
            startDate = `${yyyy}-${mm}-${dd}`;
            logger_1.logger.info(`[CapabilityDispatcher] monthly_day ${monthlyDayParam} -> start_date ${startDate}`);
        }
        const result = await services_1.taskService.create({
            title: params.title,
            description: params.description,
            priority: params.priority,
            category: category,
            due_date: params.due_date,
            start_date: startDate,
            start_time: params.start_time,
            end_time: params.end_time,
            is_recurring: isRecurring || undefined,
            recurrence_type: recurrenceType,
            recurrence_rule: recurrenceRule,
            source: hasSpecificTime ? 'semantic' : undefined,
        });
        if (result.success) {
            return {
                success: true,
                data: result.data,
                capabilityId: 'task.create',
            };
        }
        return {
            success: false,
            error: result.error?.message || '创建任务失败',
        };
    }
    // 查询任务
    async queryTasks(params) {
        const result = await services_1.taskService.list({
            status: params.status,
            priority: params.priority,
            category: params.category,
            due_date_from: params.due_date_from,
            due_date_to: params.due_date_to,
            page_size: 50,
        });
        if (result.success) {
            return {
                success: true,
                data: result.data,
                capabilityId: 'task.query',
            };
        }
        return {
            success: false,
            error: result.error?.message || '查询任务失败',
        };
    }
    // 查询日程
    async queryEvents(params) {
        // 使用scheduleService查询
        const result = await services_1.scheduleService.querySchedules({
            date: params.date,
            startDate: params.start_date,
            endDate: params.end_date,
            category: params.category,
            pageSize: 50,
        });
        return {
            success: true,
            data: result,
            capabilityId: 'event.query',
        };
    }
    // 完成任务
    async completeTask(params) {
        // 如果有标题，先查找任务
        if (params.title) {
            const listResult = await services_1.taskService.list({
                status: 'pending',
                page_size: 50,
            });
            if (listResult.success) {
                const matched = listResult.data.items.find(t => t.title.includes(params.title));
                if (matched) {
                    const result = await services_1.taskService.complete(matched.id);
                    if (result.success) {
                        return { success: true, data: result.data, capabilityId: 'task.complete' };
                    }
                }
            }
        }
        return {
            success: false,
            error: '未找到要完成的任务',
        };
    }
    // 删除任务
    async deleteTask(params) {
        const taskId = params.taskId;
        const title = params.title;
        const keyword = params.keyword;
        const scope = params.scope;
        const searchText = title || keyword;
        // 处理批量删除
        if (scope === 'all') {
            // 删除所有任务
            const listResult = await services_1.taskService.list({ page_size: 100 });
            if (listResult.success && listResult.data.items.length > 0) {
                const ids = listResult.data.items
                    .map(t => t.record_id)
                    .filter((id) => !!id);
                if (ids.length > 0) {
                    const result = await services_1.taskService.batchDelete(ids);
                    if (result.success) {
                        return {
                            success: true,
                            data: { deleted: ids.length },
                            capabilityId: 'task.delete',
                        };
                    }
                }
            }
            return {
                success: false,
                error: '删除所有任务失败',
            };
        }
        let targetId = taskId;
        // 如果没有 taskId，通过标题或关键词模糊查找
        if (!targetId && searchText) {
            const listResult = await services_1.taskService.list({
                page_size: 50,
            });
            if (listResult.success) {
                const searchLower = searchText.toLowerCase();
                const matched = listResult.data.items.find(t => {
                    const titleMatch = t.title.toLowerCase().includes(searchLower);
                    const descMatch = (t.description || '').toLowerCase().includes(searchLower);
                    return titleMatch || descMatch;
                });
                if (matched && matched.record_id) {
                    targetId = matched.record_id;
                }
            }
        }
        if (!targetId) {
            return {
                success: false,
                error: '未找到要删除的任务',
            };
        }
        const result = await services_1.taskService.delete(targetId);
        if (result.success) {
            return { success: true, data: result.data, capabilityId: 'task.delete' };
        }
        return {
            success: false,
            error: result.error?.message || '删除任务失败',
        };
    }
    // 更新任务
    async updateTask(parsedIntent) {
        const { parameters, rawInput } = parsedIntent;
        // 从参数中提取任务ID、标题或关键词
        const taskId = parameters.taskId;
        const title = parameters.title;
        const keyword = parameters.keyword;
        let searchText = title || keyword || '';
        // 提取时间变更参数
        const newDate = parameters.new_date || parameters.new_start_date;
        const newTime = parameters.new_time || parameters.new_start_time;
        // 如果既没有 taskId 也没有搜索词，尝试从 rawInput 中提取
        if (!taskId && !searchText && rawInput) {
            // 尝试从 rawInput 中提取关键信息作为搜索词
            const words = rawInput.toLowerCase().split(/\s+/);
            const significantWords = words.filter(w => !['the', 'a', 'an', 'change', 'to', 'at', 'on'].includes(w));
            if (significantWords.length > 0) {
                searchText = significantWords.slice(0, 3).join(' ');
            }
        }
        if (!taskId && !searchText) {
            return {
                success: false,
                error: '需要提供任务ID或标题',
            };
        }
        let targetId = taskId;
        // 如果没有 taskId，通过标题或关键词查找
        if (!targetId && searchText) {
            const listResult = await services_1.taskService.list({ page_size: 50 });
            if (listResult.success) {
                // 使用模糊匹配：检查标题或描述是否包含关键词
                const searchLower = searchText.toLowerCase();
                const matched = listResult.data.items.find(t => {
                    const titleMatch = t.title.toLowerCase().includes(searchLower);
                    const descMatch = (t.description || '').toLowerCase().includes(searchLower);
                    return titleMatch || descMatch;
                });
                if (matched && matched.record_id) {
                    targetId = matched.record_id;
                }
            }
        }
        if (!targetId) {
            return {
                success: false,
                error: '未找到指定的任务',
            };
        }
        // 获取当前任务信息（用于检测 category 变化）
        const currentTaskResult = await services_1.taskService.get(targetId);
        const currentTask = currentTaskResult.success ? currentTaskResult.data : null;
        const oldCategory = currentTask?.category || DEFAULT_CATEGORY;
        // 支持 parameters.category 和 parameters.new_category 两种参数名
        const categoryParam = parameters.category || parameters.new_category;
        logger_1.logger.info(`[CapabilityDispatcher] updateTask: categoryParam=${categoryParam}, oldCategory=${oldCategory}`);
        const newCategory = categoryParam ? normalizeCategory(categoryParam) : oldCategory;
        logger_1.logger.info(`[CapabilityDispatcher] updateTask: newCategory=${newCategory}`);
        const categoryChanged = newCategory !== oldCategory;
        logger_1.logger.info(`[CapabilityDispatcher] updateTask: categoryChanged=${categoryChanged}`);
        // 构建更新参数
        const updates = {};
        const titleParam = parameters.title;
        if (titleParam && searchText && !titleParam.toLowerCase().includes(searchText.toLowerCase())) {
            updates.title = titleParam;
        }
        if (parameters.description)
            updates.description = parameters.description;
        if (parameters.priority)
            updates.priority = parameters.priority;
        if (categoryParam)
            updates.category = newCategory;
        // 处理日期变更（支持 today/tomorrow 等）
        const normalizeDate = (dateStr) => {
            if (!dateStr)
                return undefined;
            const lower = dateStr.toLowerCase();
            const today = new Date();
            if (lower === 'today')
                return today.toISOString().split('T')[0];
            if (lower === 'tomorrow') {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().split('T')[0];
            }
            return dateStr;
        };
        if (newDate)
            updates.start_date = normalizeDate(newDate);
        if (parameters.new_date)
            updates.start_date = normalizeDate(parameters.new_date);
        if (newTime)
            updates.start_time = newTime;
        if (parameters.new_time) {
            updates.start_time = this.normalizeTimeString(String(parameters.new_time));
        }
        if (parameters.end_time)
            updates.end_time = parameters.end_time;
        const result = await services_1.taskService.update(targetId, updates);
        // 如果 category 变化了，需要移动 iCloud 事件
        // 注意：由于 scheduleService.syncToICalendar 无法处理 category 变化（需要旧日历 ID），
        // 我们完全由 moveICloudEvent 来处理：先从旧日历删除，再在新日历创建
        if (result.success && categoryChanged && currentTask?.icloud_event_id) {
            logger_1.logger.info(`[CapabilityDispatcher] Category changed from "${oldCategory}" to "${newCategory}", moving iCloud event`);
            await this.moveICloudEvent(currentTask, newCategory);
        }
        else if (result.success && !categoryChanged && currentTask?.icloud_event_id && newCategory === oldCategory) {
            // category 没变但需要同步到 iCloud（其他字段变化）
            logger_1.logger.info(`[CapabilityDispatcher] Syncing task update to iCloud (category unchanged)`);
        }
        if (result.success) {
            return {
                success: true,
                data: result.data,
                capabilityId: 'task.update',
            };
        }
        return {
            success: false,
            error: result.error?.message || '更新任务失败',
        };
    }
    // 创建日程事件
    async createEvent(params) {
        const title = params.title;
        const description = params.description;
        const startDate = params.start_date || params.date;
        const startTime = params.start_time || params.time;
        const endTime = params.end_time;
        const category = normalizeCategory(params.category);
        const location = params.location;
        const attendees = params.attendees;
        if (!title) {
            return {
                success: false,
                error: '需要提供日程标题',
            };
        }
        if (!startDate) {
            return {
                success: false,
                error: '需要提供日程日期',
            };
        }
        const result = await services_1.taskService.create({
            title,
            description,
            start_date: startDate,
            start_time: startTime || '09:00',
            end_time: endTime,
            category: category,
        });
        if (result.success) {
            return {
                success: true,
                data: result.data,
                capabilityId: 'event.create',
            };
        }
        return {
            success: false,
            error: result.error?.message || '创建日程失败',
        };
    }
    // 更新日程事件
    async updateEvent(parsedIntent) {
        const { parameters } = parsedIntent;
        const title = parameters.title || parameters.task_title;
        const newDate = parameters.new_date || parameters.start_date;
        const newTime = parameters.new_time || parameters.start_time;
        const newEndTime = parameters.end_time;
        const newLocation = parameters.location;
        if (!title) {
            return {
                success: false,
                error: '需要提供日程标题',
            };
        }
        // 查找匹配的日程
        const listResult = await services_1.taskService.list({ page_size: 100 });
        if (!listResult.success) {
            return {
                success: false,
                error: '查询日程失败',
            };
        }
        const searchLower = title.toLowerCase();
        const matched = listResult.data.items.find(t => t.title.toLowerCase().includes(searchLower));
        if (!matched || !matched.record_id) {
            return {
                success: false,
                error: '未找到指定的日程',
            };
        }
        const updates = {};
        if (newDate)
            updates.start_date = newDate;
        if (newTime)
            updates.start_time = newTime;
        if (newEndTime)
            updates.end_time = newEndTime;
        if (newLocation)
            updates.location = newLocation;
        const result = await services_1.taskService.update(matched.record_id, updates);
        if (result.success) {
            return {
                success: true,
                data: result.data,
                capabilityId: 'event.update',
            };
        }
        return {
            success: false,
            error: result.error?.message || '更新日程失败',
        };
    }
    // 标准化时间字符串 (如 "下午2点" -> "14:00")
    normalizeTimeString(timeStr) {
        // 如果已经是 HH:MM 格式，直接返回
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
            return timeStr.padStart(5, '0');
        }
        // 匹配 "上午9点", "下午2点", "晚上8点" 等格式
        const match = timeStr.match(/^(上午|下午|晚上)?(\d+)点$/);
        if (match) {
            let hour = parseInt(match[2], 10);
            const period = match[1];
            if (period === '下午' && hour < 12) {
                hour += 12;
            }
            else if (period === '晚上' && hour < 12) {
                hour += 12;
            }
            return `${hour.toString().padStart(2, '0')}:00`;
        }
        return timeStr;
    }
    // 移动 iCloud 事件到不同的日历
    async moveICloudEvent(task, newCategory) {
        if (!task.icloud_event_id) {
            return;
        }
        try {
            // 获取新旧日历的 calendarId
            const { configManager } = await Promise.resolve().then(() => __importStar(require('../shared/config')));
            const config = configManager.get();
            const mapping = config.icloud?.calendarMapping;
            if (!mapping) {
                logger_1.logger.warn(`[CapabilityDispatcher] No calendarMapping in config`);
                return;
            }
            // 先规范化旧分类，再查找 calendarId
            const oldCategoryNormalized = normalizeCategory(task.category);
            const oldCalendarId = mapping[oldCategoryNormalized];
            const newCalendarId = mapping[newCategory];
            if (!oldCalendarId || !newCalendarId) {
                logger_1.logger.warn(`[CapabilityDispatcher] Cannot get calendarId: old=${oldCalendarId}, new=${newCalendarId}`);
                return;
            }
            if (oldCalendarId === newCalendarId) {
                return;
            }
            logger_1.logger.info(`[CapabilityDispatcher] Moving iCloud event from ${oldCalendarId} to ${newCalendarId}`);
            // 1. 临时保存旧 category，用于删除
            const oldCategory = task.category;
            // 2. 从旧日历删除事件（需要用旧 category）
            await services_1.scheduleService.deleteFromICalendar({ ...task, category: oldCategory });
            // 3. 准备在新日历创建
            const taskForSync = {
                ...task,
                category: newCategory,
                icloud_event_id: undefined,
            };
            // 3. 在新日历创建事件
            const syncResult = await services_1.scheduleService.syncToICalendar(taskForSync);
            if (syncResult.success && syncResult.icloud_event_id) {
                // 更新飞书表格中的 category 和 icloud_event_id
                await services_1.taskService.update(task.record_id || task.id, {
                    category: newCategory,
                });
                // 直接更新 icloud_event_id 字段
                const { feishuConnector } = await Promise.resolve().then(() => __importStar(require('../connectors')));
                await feishuConnector.update(task.record_id || task.id, {
                    icloud_event_id: syncResult.icloud_event_id,
                });
                logger_1.logger.info(`[CapabilityDispatcher] iCloud event moved successfully: ${syncResult.icloud_event_id}`);
            }
            else {
                logger_1.logger.error(`[CapabilityDispatcher] Failed to sync to new calendar: ${syncResult.error}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`[CapabilityDispatcher] Error moving iCloud event:`, error);
        }
    }
}
exports.CapabilityDispatcher = CapabilityDispatcher;
//# sourceMappingURL=capability-dispatcher.js.map