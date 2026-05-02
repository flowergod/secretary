"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationEngine = exports.ConversationEngine = void 0;
// 对话处理核心
const nl_parser_1 = require("../parser/nl-parser");
const task_service_1 = require("../services/task-service");
const schedule_service_1 = require("../services/schedule-service");
const project_service_1 = require("../services/project-service");
const calendar_suggestion_service_1 = require("../services/calendar-suggestion-service");
const validation_service_1 = require("../services/validation-service");
const feishu_1 = require("../connectors/feishu");
const response_formatter_1 = require("./response-formatter");
class ConversationEngine {
    /**
     * 处理用户对话
     */
    async process(request) {
        try {
            const { message } = request;
            // 解析用户意图
            const intents = nl_parser_1.nlParser.parse(message);
            if (intents.length === 0) {
                return {
                    content: '抱歉，我没有理解您的意思。请尝试更详细的描述。',
                    success: false,
                };
            }
            // 处理第一个意图
            const intent = intents[0];
            switch (intent.action) {
                case 'create':
                    return this.handleCreate(intent);
                case 'update':
                    return this.handleUpdate(intent);
                case 'complete':
                    return this.handleComplete(intent);
                case 'delete':
                    return this.handleDelete(intent);
                case 'query':
                    return this.handleQuery(intent);
                case 'search':
                    return this.handleSearch(intent);
                default:
                    return {
                        content: '抱歉，该操作暂不支持。',
                        success: false,
                    };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            console.error('[ConversationEngine] Error:', errorMessage);
            return {
                content: response_formatter_1.responseFormatter.formatError(`处理失败：${errorMessage}`),
                success: false,
            };
        }
    }
    /**
     * 处理创建操作
     */
    async handleCreate(intent) {
        const { entityType, needsExpansion, expansionType } = intent;
        // 填充默认值并验证必填字段
        intent = validation_service_1.validationService.fillDefaults(intent);
        const validation = validation_service_1.validationService.validate(intent);
        if (entityType === 'event') {
            const event = await schedule_service_1.scheduleService.createEvent(intent);
            let message = response_formatter_1.responseFormatter.formatTaskCreated(event);
            // 如果分组未确定，询问用户
            if (!intent.entity.group) {
                message += `\n\n❓ 请确认：这个日程属于哪个分组（工作/日程表/其他）？`;
            }
            return {
                content: message,
                success: true,
            };
        }
        else if (entityType === 'project') {
            const project = await project_service_1.projectService.createProject(intent);
            let message = response_formatter_1.responseFormatter.formatTaskCreated(project);
            // 如果分组未确定，询问用户
            if (!intent.entity.group) {
                message += `\n\n❓ 请确认：这个项目属于哪个分组（工作/其他）？`;
            }
            return {
                content: message,
                success: true,
            };
        }
        else {
            // 检查任务是否有明确时间，考虑是否应该加入日历
            const calendarSuggestion = calendar_suggestion_service_1.calendarSuggestionService.suggestCalendar(intent);
            if (calendarSuggestion.category && calendarSuggestion.needsConfirmation) {
                // 需要用户确认日历分类
                const confirmMessage = `「${intent.entity.title}」计划在${intent.entity.start_date} ${intent.entity.start_time}，我建议加入「${calendarSuggestion.category}」日历。是否正确？`;
                // 暂时创建为普通任务，并提示用户
                const { task, expansionSuggestion } = await task_service_1.taskService.createTask(intent);
                const taskContent = response_formatter_1.responseFormatter.formatTaskCreated(task, expansionSuggestion);
                return {
                    content: `${taskContent}\n\n⏰ 日历提醒：${calendarSuggestion.reason}\n\n${confirmMessage}`,
                    success: true,
                };
            }
            else if (calendarSuggestion.category && !calendarSuggestion.needsConfirmation) {
                // 高置信度，自动加入日历
                const eventIntent = {
                    ...intent,
                    entity: {
                        ...intent.entity,
                        calendar_category: calendarSuggestion.category,
                    },
                };
                const event = await schedule_service_1.scheduleService.createEvent(eventIntent);
                return {
                    content: response_formatter_1.responseFormatter.formatTaskCreated(event) + `\n\n📅 已根据「${calendarSuggestion.reason}」自动加入${calendarSuggestion.category}日历。`,
                    success: true,
                };
            }
            // 无日历建议，创建普通任务
            const { task, expansionSuggestion } = await task_service_1.taskService.createTask(intent);
            let message = response_formatter_1.responseFormatter.formatTaskCreated(task, expansionSuggestion);
            // 如果分组未确定，询问用户
            if (!intent.entity.group) {
                message += `\n\n❓ 请确认：任务「${intent.entity.title}」属于哪个分组（工作/日程表/其他）？`;
            }
            return {
                content: message,
                success: true,
            };
        }
    }
    /**
     * 处理更新操作
     */
    async handleUpdate(intent) {
        const { targetId, entity } = intent;
        if (!targetId) {
            return {
                content: '请指定要更新的任务ID。',
                success: false,
            };
        }
        if (entity.type === 'event' || entity.start_date) {
            const updated = await schedule_service_1.scheduleService.updateEvent(targetId, entity);
            return {
                content: response_formatter_1.responseFormatter.formatTaskCreated(updated, '已更新日程'),
                success: true,
            };
        }
        else if (entity.project_id) {
            const updated = await project_service_1.projectService.updateProject(targetId, entity);
            return {
                content: response_formatter_1.responseFormatter.formatTaskCreated(updated, '已更新项目'),
                success: true,
            };
        }
        else {
            const updated = await task_service_1.taskService.updateTask(targetId, entity);
            return {
                content: response_formatter_1.responseFormatter.formatTaskCreated(updated, '已更新任务'),
                success: true,
            };
        }
    }
    /**
     * 处理完成任务
     */
    async handleComplete(intent) {
        const { entity, targetId } = intent;
        let taskId = targetId;
        // 如果没有指定 ID，尝试通过标题查找
        if (!taskId && entity.title) {
            const found = await task_service_1.taskService.findTaskByTitle(entity.title);
            if (found) {
                taskId = found.id;
            }
        }
        if (!taskId) {
            return {
                content: '找不到指定的任务。',
                success: false,
            };
        }
        const completed = await task_service_1.taskService.completeTask(taskId);
        return {
            content: response_formatter_1.responseFormatter.formatTaskCompleted(completed),
            success: true,
        };
    }
    /**
     * 处理删除操作
     */
    async handleDelete(intent) {
        const { targetId, entityType } = intent;
        if (!targetId) {
            return {
                content: '请指定要删除的项目ID。',
                success: false,
            };
        }
        if (entityType === 'project') {
            await project_service_1.projectService.deleteProject(targetId);
        }
        else {
            await task_service_1.taskService.deleteTask(targetId);
        }
        return {
            content: '✓ 已删除',
            success: true,
        };
    }
    /**
     * 处理查询操作
     */
    async handleQuery(intent) {
        const { queryType } = intent;
        switch (queryType) {
            case 'today_schedule':
                const todayEvents = await schedule_service_1.scheduleService.getTodayEvents();
                return {
                    content: response_formatter_1.responseFormatter.formatScheduleList(todayEvents),
                    success: true,
                };
            case 'tomorrow_schedule':
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const tomorrowEvents = await schedule_service_1.scheduleService.queryEventsByDateRange(tomorrowStr, tomorrowStr);
                return {
                    content: response_formatter_1.responseFormatter.formatScheduleList(tomorrowEvents, tomorrowStr),
                    success: true,
                };
            case 'week_schedule': {
                const now = new Date();
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekEvents = await schedule_service_1.scheduleService.queryEventsByDateRange(weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]);
                return {
                    content: response_formatter_1.responseFormatter.formatScheduleList(weekEvents, '本周'),
                    success: true,
                };
            }
            default:
                // 默认查询所有待处理任务
                const pendingTasks = await task_service_1.taskService.queryTasks({ status: 'pending' });
                return {
                    content: response_formatter_1.responseFormatter.formatSearchResults(pendingTasks, '待处理任务'),
                    success: true,
                };
        }
    }
    /**
     * 处理搜索操作
     */
    async handleSearch(intent) {
        const { searchQuery } = intent;
        if (!searchQuery) {
            return {
                content: '请指定搜索关键词。',
                success: false,
            };
        }
        const results = await feishu_1.feishuConnector.search(searchQuery);
        return {
            content: response_formatter_1.responseFormatter.formatSearchResults(results, searchQuery),
            success: true,
        };
    }
}
exports.ConversationEngine = ConversationEngine;
exports.conversationEngine = new ConversationEngine();
//# sourceMappingURL=conversation.js.map