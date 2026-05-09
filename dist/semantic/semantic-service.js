"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticService = void 0;
exports.getSemanticService = getSemanticService;
// 语义理解服务 - 主服务，编排整个理解流程
const llm_service_1 = require("./llm-service");
const prompt_manager_1 = require("./prompt-manager");
const intent_parser_1 = require("./intent-parser");
const capability_dispatcher_1 = require("./capability-dispatcher");
const context_manager_1 = require("./context-manager");
const semantic_logger_1 = require("./semantic-logger");
const trace_logger_1 = require("./trace-logger");
const logger_1 = require("../shared/logger");
const config_1 = require("../shared/config");
const services_1 = require("../services");
class SemanticService {
    constructor() {
        // 初始化LLM配置
        const llmConfigs = this.loadLLMConfigs();
        this.llmService = new llm_service_1.LLMService(llmConfigs);
        // 初始化其他组件
        this.promptManager = new prompt_manager_1.PromptManager();
        this.dispatcher = new capability_dispatcher_1.CapabilityDispatcher();
        this.intentParser = new intent_parser_1.IntentParser(this.dispatcher.getAllCapabilities());
        this.contextManager = (0, context_manager_1.getContextManager)();
        this.semanticLogger = (0, semantic_logger_1.getSemanticLogger)();
        this.traceLogger = (0, trace_logger_1.getTraceLogger)();
    }
    // 加载LLM配置
    loadLLMConfigs() {
        const configs = [];
        // 从config读取LLM配置
        const aiConfig = config_1.configManager.get().ai;
        if (aiConfig?.primary) {
            configs.push({
                provider: (aiConfig.primary.provider || 'minimax'),
                apiKey: aiConfig.primary.apiKey,
                model: aiConfig.primary.model || 'MiniMax-Text-01',
                baseUrl: aiConfig.primary.baseUrl,
                timeout: aiConfig.primary.timeout || 30000,
                maxRetries: aiConfig.primary.maxRetries || 2,
            });
        }
        if (aiConfig?.fallback) {
            configs.push({
                provider: (aiConfig.fallback.provider || 'minimax'),
                apiKey: aiConfig.fallback.apiKey,
                model: aiConfig.fallback.model || 'MiniMax-Text-01',
                baseUrl: aiConfig.fallback.baseUrl,
                timeout: aiConfig.fallback.timeout || 30000,
                maxRetries: aiConfig.fallback.maxRetries || 2,
            });
        }
        if (configs.length === 0) {
            throw new Error('No LLM configuration found');
        }
        logger_1.logger.info(`[SemanticService] Loaded ${configs.length} LLM config(s)`);
        return configs;
    }
    // 主接口：理解用户输入
    async understand(userInput, userId) {
        // 开始追踪
        const trace = this.traceLogger.startTrace('semantic.understand', { userInput, userId });
        const traceId = trace.traceId;
        let logEntry = null;
        try {
            logger_1.logger.info(`[SemanticService] Understanding: "${userInput}"`);
            // 检查是否存在 pending_confirmation 的上下文
            const pendingContexts = this.contextManager.getPendingContexts();
            logger_1.logger.info(`[SemanticService] Pending contexts count: ${pendingContexts.length}`);
            if (pendingContexts.length > 0) {
                const pendingContext = pendingContexts[0];
                logger_1.logger.info(`[SemanticService] Has pending context: ${pendingContext.id}, question: ${pendingContext.confirmationQuestion}`);
                // 使用 LLM 理解用户在上下文中的输入
                const contextualResult = await this.understandContextualInput(userInput, pendingContext);
                if (contextualResult.handled) {
                    // LLM 已经处理了请求
                    contextualResult.result.traceId = traceId;
                    return contextualResult.result;
                }
                // 如果 LLM 判断用户想开始新任务，取消当前上下文并继续
                if (contextualResult.wantsNewTask) {
                    logger_1.logger.info(`[SemanticService] User wants to start new task, cancelling pending context`);
                    this.contextManager.cancelContext(pendingContext.id);
                    // 继续执行下面的新任务识别逻辑
                }
            }
            else {
                logger_1.logger.info(`[SemanticService] No pending context found, proceeding with new intent classification`);
            }
            // ========== 指代词解析 ==========
            // 在意图分类之前，先解析用户输入中的上下文引用
            const referenceResult = await this.resolveReference(userInput);
            if (referenceResult.found && referenceResult.resolvedTask) {
                logger_1.logger.info(`[SemanticService] Resolved reference to: ${referenceResult.resolvedTask.title} (${referenceResult.resolvedTask.taskId})`);
            }
            // ========== 指代词解析结束 ==========
            // 第一步：意图分类（传入解析结果）
            const llmSpanStart = Date.now();
            const intentResult = await this.classifyIntent(userInput, referenceResult.found ? {
                resolvedTaskId: referenceResult.resolvedTask.taskId,
                resolvedRecordId: referenceResult.resolvedTask.recordId,
                resolvedTaskTitle: referenceResult.resolvedTask.title,
            } : undefined);
            const llmLatency = Date.now() - llmSpanStart;
            // 记录 LLM 调用
            this.traceLogger.endSpan(traceId, trace.rootSpanId, {
                intent: intentResult.intent.intent,
                confidence: intentResult.intent.confidence,
            }, {
                latencyMs: llmLatency,
            });
            // 记录语义日志（意图识别阶段）
            logEntry = this.semanticLogger.createLog({ text: userInput, userId }, {
                intentId: '', // 稍后更新
                intent: intentResult.intent.intent,
                entityType: intentResult.intent.entityType,
                confidence: intentResult.intent.confidence,
                lowConfidence: intentResult.intent.lowConfidence,
                reasoning: intentResult.intent.reasoning,
                parameters: intentResult.intent.parameters,
            }, {
                needsConfirmation: intentResult.intent.needsConfirmation,
            }, {
                provider: 'minimax',
                model: 'MiniMax-M2.7',
                latencyMs: llmLatency,
            });
            // 更新 trace 的 semanticLogId
            this.traceLogger.addSpanLink(traceId, trace.rootSpanId, 'semanticLogId', logEntry.id);
            // 如果置信度太低或需要确认，生成确认问题
            if (intentResult.intent.needsConfirmation) {
                const confirmationSpan = this.traceLogger.startSpan(traceId, 'llm.confirmation');
                // 对于 DELETE_TASK 意图，查询匹配的任务
                if (intentResult.intent.intent === 'delete_task') {
                    const params = intentResult.intent.parameters;
                    const title = params.title;
                    // 优先按标题搜索任务
                    let matchedTasks = [];
                    if (title) {
                        matchedTasks = await this.findMatchingTasks(params);
                    }
                    // 如果没有找到匹配的任务，再按日期搜索
                    let events = [];
                    let queryDesc = '';
                    if (matchedTasks.length > 0) {
                        // 按标题匹配成功，直接使用
                        events = matchedTasks;
                        queryDesc = `包含"${title}"的任务`;
                    }
                    else {
                        // 按标题没找到，尝试按日期搜索
                        let date = params.date || params.start_date;
                        if (date) {
                            events = await this.findEventsForDate(date);
                            queryDesc = date;
                        }
                        else {
                            // 查询最近7天的事件让用户选择
                            events = await this.findEventsForDateRange(7);
                            queryDesc = '最近7天';
                        }
                    }
                    if (events.length > 0) {
                        // 显示事件列表供选择
                        const options = events.slice(0, 5).map((evt, i) => {
                            const dateStr = evt.start_date ? ` (${evt.start_date} ${evt.start_time || ''})` : '';
                            return {
                                id: `opt_${i + 1}`,
                                label: `${evt.title}${dateStr}`,
                                type: 'event',
                                taskId: evt.record_id || evt.id,
                                icloudEventId: evt.icloud_event_id,
                            };
                        });
                        const context = this.contextManager.createContext(intentResult.intent, userInput, `请问您想删除哪个日程？以下是${queryDesc}的日程：`, options, { id: 'open', label: '都不是，我想补充说明' });
                        context.intent.id = context.id;
                        context.intent.parameters._matchedEvents = events;
                        this.traceLogger.endSpan(traceId, confirmationSpan);
                        return {
                            success: true,
                            intent: context.intent,
                            confirmationQuestion: context.confirmationQuestion,
                            confirmationOptions: context.confirmationOptions,
                            openOption: context.openOption,
                            lowConfidence: false,
                            logId: logEntry.id,
                            traceId,
                        };
                    }
                    else {
                        // 没有找到事件
                        const context = this.contextManager.createContext(intentResult.intent, userInput, `没有找到${queryDesc}的日程安排，无需删除。`, [], { id: 'ok', label: '好的' });
                        context.intent.id = context.id;
                        this.traceLogger.endSpan(traceId, confirmationSpan);
                        return {
                            success: true,
                            intent: context.intent,
                            confirmationQuestion: context.confirmationQuestion,
                            lowConfidence: false,
                            logId: logEntry.id,
                            traceId,
                        };
                    }
                }
                // 对于 UPDATE_TASK 意图，查询匹配的任务
                if (intentResult.intent.intent === 'update_task') {
                    const matchedTasks = await this.findMatchingTasks(intentResult.intent.parameters);
                    if (matchedTasks.length > 0) {
                        const options = matchedTasks.slice(0, 5).map((task, i) => ({
                            id: `opt_${i + 1}`,
                            label: `${task.title} (${task.start_date || task.due_date || '无日期'})`,
                            type: 'task',
                            taskId: task.record_id,
                        }));
                        const context = this.contextManager.createContext(intentResult.intent, userInput, `请问您是想调整哪个任务？`, options, { id: 'open', label: '都不是，我想补充说明' });
                        context.intent.id = context.id;
                        context.intent.parameters._matchedTasks = matchedTasks;
                        this.traceLogger.endSpan(traceId, confirmationSpan);
                        return {
                            success: true,
                            intent: context.intent,
                            confirmationQuestion: context.confirmationQuestion,
                            confirmationOptions: context.confirmationOptions,
                            openOption: context.openOption,
                            lowConfidence: false,
                            logId: logEntry.id,
                            traceId,
                        };
                    }
                }
                const confirmation = await this.generateConfirmation(userInput, intentResult.intent, intentResult.missingParams);
                this.traceLogger.endSpan(traceId, confirmationSpan);
                // 创建上下文
                const context = this.contextManager.createContext(intentResult.intent, userInput, confirmation.question, confirmation.options?.map((opt, i) => ({
                    id: `opt_${i + 1}`,
                    label: opt,
                    type: 'task',
                })), { id: 'open', label: '都不是，我想补充说明' });
                // 设置 intent.id 为 contextId
                context.intent.id = context.id;
                logger_1.logger.info(`[SemanticService] Created context: ${context.id}`);
                return {
                    success: true,
                    intent: context.intent,
                    confirmationQuestion: confirmation.question,
                    confirmationOptions: confirmation.options?.map((opt, i) => ({
                        id: `opt_${i + 1}`,
                        label: opt,
                        type: 'task',
                    })),
                    openOption: { id: 'open', label: '都不是，我想补充说明' },
                    lowConfidence: intentResult.intent.lowConfidence,
                    logId: logEntry.id,
                    traceId,
                };
            }
            // 第二步：执行能力
            const executionSpanId = this.traceLogger.startSpan(traceId, 'capability_dispatcher.dispatch');
            const executionStart = Date.now();
            const dispatchResult = await this.dispatcher.dispatch(intentResult.intent);
            const executionDuration = Date.now() - executionStart;
            if (executionSpanId) {
                this.traceLogger.endSpan(traceId, executionSpanId, {
                    success: dispatchResult.success,
                    capabilityId: dispatchResult.capabilityId,
                });
            }
            if (!dispatchResult.success) {
                // 更新日志执行结果
                this.semanticLogger.updateExecution(logEntry.id, {
                    executed: false,
                    capabilityId: dispatchResult.capabilityId,
                    error: dispatchResult.error,
                    durationMs: executionDuration,
                });
                this.traceLogger.endTrace(traceId, { success: false, error: dispatchResult.error });
                return {
                    success: false,
                    intent: intentResult.intent,
                    error: dispatchResult.error,
                    logId: logEntry.id,
                    traceId,
                };
            }
            // 更新日志执行结果
            this.semanticLogger.updateExecution(logEntry.id, {
                executed: true,
                capabilityId: dispatchResult.capabilityId,
                taskId: dispatchResult.data,
                action: 'completed',
                durationMs: executionDuration,
            });
            // 更新近期操作记录
            this.recordRecentMention(intentResult.intent, dispatchResult.data);
            this.traceLogger.endTrace(traceId, {
                success: true,
                taskId: dispatchResult.data,
            });
            return {
                success: true,
                intent: intentResult.intent,
                requiresExecution: true,
                result: {
                    taskId: dispatchResult.data,
                    action: 'completed',
                },
                logId: logEntry.id,
                traceId,
            };
        }
        catch (error) {
            logger_1.logger.error('[SemanticService] Understanding failed:', error);
            if (logEntry) {
                this.semanticLogger.updateExecution(logEntry.id, {
                    executed: false,
                    error: error instanceof Error ? error.message : '理解失败',
                });
            }
            this.traceLogger.endTrace(traceId, {
                success: false,
                error: error instanceof Error ? error.message : '理解失败',
            }, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '理解失败',
                traceId,
            };
        }
    }
    // 确认后的执行
    async confirm(contextId, selectedOption, openText, cancel) {
        const trace = this.traceLogger.startTrace('semantic.confirm', {
            contextId,
            selectedOption,
            openText,
            cancel,
        });
        const traceId = trace.traceId;
        try {
            // 取消操作
            if (cancel) {
                const success = this.contextManager.cancelContext(contextId);
                if (!success) {
                    return {
                        success: false,
                        error: '上下文不存在或已过期',
                        traceId,
                    };
                }
                this.traceLogger.endTrace(traceId, { cancelled: true });
                return {
                    success: true,
                    cancelled: true,
                    message: '已取消当前操作',
                    traceId,
                };
            }
            // 获取上下文
            const context = this.contextManager.getContext(contextId);
            if (!context) {
                this.traceLogger.endTrace(traceId, { error: 'CONTEXT_NOT_FOUND' });
                return {
                    success: false,
                    error: '上下文已过期或不存在，请重新输入',
                    traceId,
                };
            }
            // 开放式补充
            if (openText) {
                const refineSpanId = this.traceLogger.startSpan(traceId, 'llm.parameter_extraction');
                // 使用补充的文本重新解析，保留之前识别的参数
                const intentResult = await this.classifyIntent(openText, {
                    originalIntent: context.intent.intent,
                    // 保留之前识别的任务信息
                    ...context.intent.parameters,
                });
                if (refineSpanId) {
                    this.traceLogger.endSpan(traceId, refineSpanId, {
                        refinedIntent: intentResult.intent.intent,
                    });
                }
                // 更新上下文
                context.intent = intentResult.intent;
                this.contextManager.updateStatus(contextId, 'executing');
                // 执行
                const executionSpanId = this.traceLogger.startSpan(traceId, 'capability_dispatcher.dispatch');
                const dispatchResult = await this.dispatcher.dispatch(intentResult.intent);
                if (executionSpanId) {
                    this.traceLogger.endSpan(traceId, executionSpanId, {
                        success: dispatchResult.success,
                    });
                }
                if (!dispatchResult.success) {
                    this.traceLogger.endTrace(traceId, { success: false, error: dispatchResult.error });
                    return {
                        success: false,
                        intent: intentResult.intent,
                        error: dispatchResult.error,
                        traceId,
                    };
                }
                this.traceLogger.endTrace(traceId, {
                    success: true,
                    taskId: dispatchResult.data,
                });
                return {
                    success: true,
                    intent: intentResult.intent,
                    requiresExecution: true,
                    result: {
                        taskId: dispatchResult.data,
                        action: 'completed',
                    },
                    traceId,
                };
            }
            // 选择选项
            if (selectedOption) {
                // 如果没有确认选项（如没有匹配到任务时），直接执行
                if (!context.confirmationOptions || context.confirmationOptions.length === 0) {
                    // 没有预定义选项，用户可能是直接确认
                    // 检查是否是简单的确认（如 opt_1, yes, confirm 等）
                    const simpleConfirmPatterns = ['opt_1', 'yes', 'confirm', 'ok', 'sure', '是', '确认', '好的'];
                    if (selectedOption && simpleConfirmPatterns.includes(selectedOption.toLowerCase())) {
                        // 视为用户确认，执行意图
                        this.contextManager.updateStatus(contextId, 'executing');
                        const executionSpanId = this.traceLogger.startSpan(traceId, 'capability_dispatcher.dispatch');
                        const dispatchResult = await this.dispatcher.dispatch(context.intent);
                        if (executionSpanId) {
                            this.traceLogger.endSpan(traceId, executionSpanId, {
                                success: dispatchResult.success,
                            });
                        }
                        if (!dispatchResult.success) {
                            this.traceLogger.endTrace(traceId, { success: false, error: dispatchResult.error });
                            return {
                                success: false,
                                intent: context.intent,
                                error: dispatchResult.error,
                                traceId,
                            };
                        }
                        this.contextManager.updateStatus(contextId, 'completed');
                        // 更新近期操作记录
                        if (dispatchResult.data) {
                            this.recordRecentMention(context.intent, dispatchResult.data);
                        }
                        this.traceLogger.endTrace(traceId, { success: true, taskId: dispatchResult.data });
                        return {
                            success: true,
                            intent: context.intent,
                            requiresExecution: true,
                            result: {
                                taskId: dispatchResult.data,
                                action: 'completed',
                            },
                            traceId,
                        };
                    }
                    this.traceLogger.endTrace(traceId, { error: 'NO_CONFIRMATION_OPTIONS' });
                    return {
                        success: false,
                        error: '需要确认更多信息，请描述具体要执行的操作',
                        traceId,
                    };
                }
                // 找到对应的选项
                const option = context.confirmationOptions?.find(o => o.id === selectedOption);
                if (!option) {
                    this.traceLogger.endTrace(traceId, { error: 'INVALID_OPTION' });
                    return {
                        success: false,
                        error: '选择的选项无效',
                        traceId,
                    };
                }
                // 如果选项中有 taskId，设置到参数中
                if (option.taskId) {
                    context.intent.parameters.taskId = option.taskId;
                    context.intent.parameters.title = option.label;
                }
                else {
                    // 没有 taskId，说明是操作确认（如"确认删除"、"取消"）
                    // 检查是否是确认删除操作
                    const label = option.label.toLowerCase();
                    if (label.includes('确认删除') || label.includes('删除所有')) {
                        // 批量删除
                        context.intent.parameters.scope = 'all';
                        delete context.intent.parameters.title;
                    }
                    else if (label.includes('取消')) {
                        // 用户取消
                        const cancelResult = await this.confirm(contextId, undefined, undefined, true);
                        cancelResult.traceId = traceId;
                        return cancelResult;
                    }
                }
                this.contextManager.updateStatus(contextId, 'executing');
                // 执行
                const executionSpanId = this.traceLogger.startSpan(traceId, 'capability_dispatcher.dispatch');
                const dispatchResult = await this.dispatcher.dispatch(context.intent);
                if (executionSpanId) {
                    this.traceLogger.endSpan(traceId, executionSpanId, {
                        success: dispatchResult.success,
                    });
                }
                if (!dispatchResult.success) {
                    // 如果任务不存在，标记上下文为过期
                    if (dispatchResult.error?.includes('不存在') || dispatchResult.error?.includes('未找到')) {
                        this.contextManager.updateStatus(contextId, 'expired');
                    }
                    this.traceLogger.endTrace(traceId, { success: false, error: dispatchResult.error });
                    return {
                        success: false,
                        intent: context.intent,
                        error: dispatchResult.error,
                        traceId,
                    };
                }
                // 执行成功，标记上下文为已完成
                this.contextManager.updateStatus(contextId, 'completed');
                // 更新近期操作记录
                if (dispatchResult.data) {
                    this.recordRecentMention(context.intent, dispatchResult.data);
                }
                this.traceLogger.endTrace(traceId, {
                    success: true,
                    taskId: dispatchResult.data,
                });
                return {
                    success: true,
                    intent: context.intent,
                    requiresExecution: true,
                    result: {
                        taskId: dispatchResult.data,
                        action: 'completed',
                    },
                    traceId,
                };
            }
            this.traceLogger.endTrace(traceId, { error: 'NO_ACTION_PROVIDED' });
            return {
                success: false,
                error: '请提供 selectedOption 或 openText',
                traceId,
            };
        }
        catch (error) {
            logger_1.logger.error('[SemanticService] Confirmation execution failed:', error);
            this.traceLogger.endTrace(traceId, {
                error: error instanceof Error ? error.message : '执行失败',
            }, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '执行失败',
                traceId,
            };
        }
    }
    // 获取上下文状态
    getContext(contextId) {
        return this.contextManager.getContext(contextId);
    }
    // 根据关键词查询匹配的任务
    async findMatchingTasks(params) {
        // 尝试多种可能的关键词字段
        const keyword = params.keyword
            || params.title
            || params.task_name
            || params.task_title;
        if (!keyword) {
            logger_1.logger.info(`[SemanticService] findMatchingTasks: no keyword found`);
            return [];
        }
        logger_1.logger.info(`[SemanticService] findMatchingTasks: searching with keyword="${keyword}"`);
        // 查询所有任务
        const result = await services_1.taskService.list({ page_size: 100 });
        if (!result.success || !result.data) {
            logger_1.logger.info(`[SemanticService] findMatchingTasks: query failed`);
            return [];
        }
        logger_1.logger.info(`[SemanticService] findMatchingTasks: total tasks=${result.data.items.length}`);
        // 使用 LLM 做语义相似度匹配
        const similarTasks = await this.findSimilarTasksByLLM(keyword, result.data.items);
        logger_1.logger.info(`[SemanticService] findMatchingTasks: LLM matched ${similarTasks.length} tasks`);
        return similarTasks;
    }
    // 使用 LLM 评估语义相似度
    async findSimilarTasksByLLM(query, tasks) {
        if (tasks.length === 0) {
            return [];
        }
        // 构建任务列表（最多20个，避免 token 过多）
        const taskList = tasks.slice(0, 20).map((t, i) => `${i + 1}. ${t.title}${t.description ? ` - ${t.description}` : ''}`).join('\n');
        const prompt = `用户想查找的任务：${query}

任务列表：
${taskList}

请判断哪些任务与用户想查找的任务相关。返回与用户意图相关的任务序号（1-based），用逗号分隔。

判断标准：
- 标题包含关键词的肯定相关
- 语义相似（如"围棋课"和"下围棋"相关）
- 模糊匹配但可能是同一任务的也相关
- 宁可多返回也不要漏掉可能的候选

请以JSON格式返回：
{
  "related_indices": [1, 3, 5],
  "reasoning": "判断理由"
}`;
        try {
            const llmResponse = await this.llmService.completeJson(prompt, '', { temperature: 0.3 });
            logger_1.logger.info(`[SemanticService] findSimilarTasksByLLM: reasoning=${llmResponse.reasoning}`);
            // 根据索引获取任务
            const relatedTasks = llmResponse.related_indices
                .filter(i => i >= 1 && i <= tasks.length)
                .map(i => tasks[i - 1]);
            logger_1.logger.info(`[SemanticService] findSimilarTasksByLLM: found ${relatedTasks.length} related tasks: ${relatedTasks.map(t => t.title).join(', ')}`);
            return relatedTasks;
        }
        catch (error) {
            logger_1.logger.error(`[SemanticService] findSimilarTasksByLLM failed:`, error);
            // LLM 失败时回退到简单的关键词匹配
            const keywords = query.toLowerCase().split(/[\s,.，、]+/).filter(Boolean);
            return tasks.filter(task => {
                const title = task.title.toLowerCase();
                const description = (task.description || '').toLowerCase();
                return keywords.some(kw => title.includes(kw) || description.includes(kw));
            });
        }
    }
    // 根据日期查询事件（用于删除确认）
    async findEventsForDate(dateStr) {
        if (!dateStr) {
            return [];
        }
        // 使用 scheduleService 查询事件
        const result = await services_1.scheduleService.querySchedules({
            date: dateStr,
        });
        return result.items || [];
    }
    // 根据日期范围查询事件（用于没有指定日期时的删除确认）
    async findEventsForDateRange(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await services_1.scheduleService.querySchedules({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        });
        return result.items || [];
    }
    // 查询符合条件的任务（用于删除/更新确认）
    async findTasksForConfirmation(params) {
        const title = params.title;
        // 查询所有任务
        const result = await services_1.taskService.list({ page_size: 100 });
        if (!result.success || !result.data) {
            return { tasks: [], message: '查询任务失败' };
        }
        let tasks = result.data.items;
        // 如果有标题关键词，过滤任务
        if (title) {
            const keywords = title.toLowerCase().split(/[\s,.，、]+/).filter(Boolean);
            tasks = tasks.filter(task => {
                const taskTitle = task.title.toLowerCase();
                const taskDesc = (task.description || '').toLowerCase();
                return keywords.some(kw => taskTitle.includes(kw) || taskDesc.includes(kw));
            });
        }
        return { tasks, message: '' };
    }
    // 解析用户输入中的指代词
    async resolveReference(userInput) {
        // 获取近期操作记录
        const recentMentions = this.contextManager.getRecentMentions({ withinHours: 24 });
        if (recentMentions.length === 0) {
            return { found: false, resolvedTask: null, resolvedUserInput: userInput };
        }
        // 使用 LLM 解析指代词
        const { system, user } = this.promptManager.renderReferenceResolution(userInput, recentMentions);
        try {
            const llmResponse = await this.llmService.completeJson(system, user, { temperature: 0.3 });
            logger_1.logger.info(`[SemanticService] Reference resolution: type=${llmResponse.type}, reasoning=${llmResponse.reasoning}`);
            if (llmResponse.type === 'none') {
                return { found: false, resolvedTask: null, resolvedUserInput: userInput };
            }
            // 根据过滤器获取候选任务
            let candidates = [...recentMentions];
            if (llmResponse.filter?.operation) {
                candidates = candidates.filter(m => m.operation === llmResponse.filter.operation);
            }
            if (llmResponse.filter?.timeRange === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                candidates = candidates.filter(m => m.time >= today);
            }
            if (candidates.length === 0) {
                return { found: false, resolvedTask: null, resolvedUserInput: userInput };
            }
            // 取最新的一条
            const resolved = candidates[0];
            return {
                found: true,
                resolvedTask: {
                    taskId: resolved.taskId,
                    recordId: resolved.recordId,
                    title: resolved.title,
                },
                resolvedUserInput: userInput, // 后续由 LLM 处理具体任务ID
            };
        }
        catch (error) {
            logger_1.logger.error('[SemanticService] Reference resolution failed:', error);
            return { found: false, resolvedTask: null, resolvedUserInput: userInput };
        }
    }
    // 使用 LLM 理解上下文中的用户输入
    async understandContextualInput(userInput, context) {
        const options = context.confirmationOptions || [];
        // 使用 LLM 理解
        const { system, user } = this.promptManager.renderContextualUnderstanding(context.confirmationQuestion || '请确认', options.map(o => ({ id: o.id, label: o.label })), userInput);
        try {
            const llmResponse = await this.llmService.completeJson(system, user, { temperature: 0.3 });
            logger_1.logger.info(`[SemanticService] Contextual understanding: type=${llmResponse.type}, reasoning=${llmResponse.reasoning}`);
            switch (llmResponse.type) {
                case 'select_option':
                    if (llmResponse.selectedOptionId) {
                        const result = await this.confirm(context.id, llmResponse.selectedOptionId, undefined, false);
                        return { handled: true, wantsNewTask: false, result };
                    }
                    break;
                case 'cancel':
                    const cancelResult = await this.confirm(context.id, undefined, undefined, true);
                    return { handled: true, wantsNewTask: false, result: cancelResult };
                case 'supplement':
                    const supplementResult = await this.confirm(context.id, undefined, llmResponse.supplementText || userInput, false);
                    return { handled: true, wantsNewTask: false, result: supplementResult };
                case 'new_task':
                    return { handled: false, wantsNewTask: true, result: {} };
            }
        }
        catch (error) {
            logger_1.logger.error('[SemanticService] Contextual understanding failed:', error);
        }
        // LLM 失败时降级：把用户输入当作补充信息
        const fallbackResult = await this.confirm(context.id, undefined, userInput, false);
        return { handled: true, wantsNewTask: false, result: fallbackResult };
    }
    // 意图分类
    async classifyIntent(userInput, context) {
        // 渲染提示词（传入解析上下文以帮助 LLM 理解）
        const { system, user } = this.promptManager.renderIntentClassification(userInput, this.dispatcher.getAllCapabilities(), context ? {
            resolvedTaskId: context.resolvedTaskId,
            resolvedRecordId: context.resolvedRecordId,
            resolvedTaskTitle: context.resolvedTaskTitle,
        } : undefined);
        // 调用LLM
        const llmResponse = await this.llmService.completeJson(system, user);
        // 解析意图
        const result = this.intentParser.parseIntentClassification(llmResponse, userInput);
        // 如果有上下文参数，合并到参数中
        if (context) {
            result.intent.parameters = { ...context, ...result.intent.parameters };
        }
        return result;
    }
    // 生成确认问题
    async generateConfirmation(userInput, intent, missingParams) {
        // 格式化参数中的日期，添加正确的星期
        const formattedParams = this.formatParametersWithDate(intent.parameters);
        const { system, user } = this.promptManager.renderConfirmation(userInput, intent.intent, formattedParams, missingParams);
        try {
            const llmResponse = await this.llmService.completeJson(system, user, { temperature: 0.5 });
            return {
                question: llmResponse.question,
                options: llmResponse.options,
            };
        }
        catch (error) {
            logger_1.logger.warn('[SemanticService] Failed to generate confirmation, using fallback');
            // Fallback：基于缺失参数生成简单问题
            const missing = missingParams.join('和');
            return {
                question: `请提供${missing}信息`,
            };
        }
    }
    // 获取当前支持的能力列表
    getCapabilities() {
        return this.dispatcher.getAllCapabilities();
    }
    // 格式化参数中的日期，添加正确的星期
    formatParametersWithDate(params) {
        const formatted = { ...params };
        // 日期字段列表
        const dateFields = ['date', 'start_date', 'end_date', 'due_date', 'new_date', 'new_start_date'];
        for (const field of dateFields) {
            const value = formatted[field];
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                // 计算星期几
                const [year, month, day] = value.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                const weekday = weekdays[date.getDay()];
                // 添加 _formatted_date 字段（包含星期）
                formatted[`_${field}_formatted`] = `${year}年${month}月${day}日（${weekday}）`;
            }
        }
        return formatted;
    }
    // 记录近期操作
    recordRecentMention(intent, taskId) {
        // 根据意图类型确定操作类型
        let operation = 'query';
        switch (intent.intent) {
            case 'create_task':
            case 'create_event':
                operation = 'create';
                break;
            case 'update_task':
            case 'update_event':
                operation = 'modify';
                break;
            case 'delete_task':
            case 'delete_event':
                operation = 'delete';
                break;
            case 'complete_task':
                operation = 'complete';
                break;
            case 'query_tasks':
            case 'query_events':
                operation = 'query';
                break;
        }
        // 获取任务标题
        const title = intent.parameters.title ||
            intent.parameters.resolvedTaskTitle ||
            `任务_${taskId.substring(0, 8)}`;
        // 从参数中获取 recordId
        const recordId = intent.parameters.recordId ||
            intent.parameters.resolvedRecordId ||
            taskId;
        this.contextManager.addMention(taskId, recordId, title, operation);
        logger_1.logger.info(`[SemanticService] Recorded mention: ${title} (${operation})`);
    }
    // 获取语义日志
    getSemanticLogger() {
        return this.semanticLogger;
    }
    // 获取追踪日志
    getTraceLogger() {
        return this.traceLogger;
    }
}
exports.SemanticService = SemanticService;
// 导出单例
let semanticServiceInstance = null;
function getSemanticService() {
    if (!semanticServiceInstance) {
        semanticServiceInstance = new SemanticService();
    }
    return semanticServiceInstance;
}
//# sourceMappingURL=semantic-service.js.map