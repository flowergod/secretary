"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuBotService = void 0;
exports.getFeishuBotService = getFeishuBotService;
exports.createFeishuBotService = createFeishuBotService;
const semantic_service_1 = require("../semantic/semantic-service");
const context_manager_1 = require("../semantic/context-manager");
const logger_1 = require("../shared/logger");
// 欢迎语
const WELCOME_MESSAGE = `👋 您好！我是秘书小助手。

我可以帮您：
• 创建和管理任务
• 查询日程安排
• 设置提醒

请直接告诉我您想做什么，比如：
「提醒我明天下午3点开会」
「今天有什么安排？」

需要开始新对话吗？请说「新对话」或点击下方按钮 👇`;
// 新上下文关键词
const NEW_CONTEXT_KEYWORDS = ['新对话', '重新开始', '换个话题', '新任务'];
const NEW_CONTEXT_COMMANDS = ['/new', '/reset', '/restart'];
// 确认关键词
const CONFIRM_KEYWORDS = ['好的', '是', '确认', 'ok', 'yes', 'confirm', '/confirm'];
const CANCEL_KEYWORDS = ['算了', '取消', '不要了', '/cancel'];
// 选项匹配正则
const OPT_PATTERN = /^opt_(\d+)$/i;
const CHINESE_OPT_PATTERN = /^(?:选项)?(\d+)$/i;
const NUMERIC_PATTERN = /^(\d+)$/;
class FeishuBotService {
    constructor(connector) {
        this.chatContextMap = new Map();
        this.connector = connector;
        this.semanticService = (0, semantic_service_1.getSemanticService)();
        this.contextManager = (0, context_manager_1.getContextManager)();
    }
    // 启动服务
    async start() {
        logger_1.logger.info('[FeishuBotService] Starting...');
        // 注册消息处理器
        this.connector.onMessage(this.handleMessage.bind(this));
        // 注册卡片操作处理器
        this.connector.onCardAction(this.handleCardAction.bind(this));
        // 启动连接
        await this.connector.start();
        logger_1.logger.info('[FeishuBotService] Started successfully');
    }
    // 停止服务
    stop() {
        this.connector.stop();
        this.chatContextMap.clear();
        logger_1.logger.info('[FeishuBotService] Stopped');
    }
    // 处理卡片操作
    async handleCardAction(evt) {
        try {
            logger_1.logger.info('[FeishuBotService] Received card action:', JSON.stringify(evt));
            // 提取卡片操作信息
            const openId = evt.operator?.openId;
            const chatId = evt.chatId;
            if (!openId) {
                logger_1.logger.warn('[FeishuBotService] Card action missing openId');
                return;
            }
            // 解析用户点击的按钮 - action.value 包含按钮值
            const actionValue = evt.action?.value;
            const selectedOption = typeof actionValue === 'string' ? actionValue : evt.action?.option;
            logger_1.logger.info(`[FeishuBotService] User selected option: ${selectedOption}, action value: ${JSON.stringify(actionValue)}`);
            // 获取当前 pending 的上下文
            const contextId = this.getPendingContextId(openId);
            const pendingContext = this.contextManager.getContext(contextId);
            if (!pendingContext) {
                logger_1.logger.warn('[FeishuBotService] No pending context for card action, contextId:', contextId);
                await this.replyText(openId, 'p2p', '会话已过期，请重新输入您的需求。');
                return;
            }
            // 调用确认接口
            const result = await this.semanticService.confirm(pendingContext.id, selectedOption);
            // 处理确认结果
            await this.processSemanticResult(result, chatId, 'p2p', openId, evt.messageId, pendingContext.id);
        }
        catch (error) {
            logger_1.logger.error('[FeishuBotService] Error handling card action:', error);
        }
    }
    getPendingContextId(openId) {
        // 遍历找到对应的 contextId
        for (const [, map] of this.chatContextMap.entries()) {
            if (map.openId === openId) {
                return map.contextId;
            }
        }
        return '';
    }
    // 处理接收到的消息
    async handleMessage(msg) {
        try {
            // 从 NormalizedMessage 提取信息
            const chatId = msg.chatId;
            const openId = msg.senderId;
            const text = msg.content;
            const messageId = msg.messageId;
            const chatType = msg.chatType;
            logger_1.logger.info(`[FeishuBotService] handleMessage: msg=`, JSON.stringify(msg));
            if (!text || !chatId || !openId) {
                logger_1.logger.warn('[FeishuBotService] Invalid message format:', { chatId, openId, text });
                return;
            }
            // 检测是否需要开启新上下文
            if (this.shouldStartNewContext(text, chatId)) {
                this.clearContext(chatId);
                logger_1.logger.info(`[FeishuBotService] Starting new context for chat ${chatId}`);
            }
            // 获取或创建 contextId
            const contextId = await this.getOrCreateContextId(chatId, openId);
            logger_1.logger.info(`[FeishuBotService] Using contextId: ${contextId}`);
            // 先检查是否是选项回复
            const handled = await this.handleOptionSelection(text, openId);
            if (handled) {
                logger_1.logger.info('[FeishuBotService] Option selection handled');
                return;
            }
            // 调用语义理解
            const result = await this.semanticService.understand(text, openId);
            logger_1.logger.info(`[FeishuBotService] Semantic result:`, JSON.stringify(result));
            // 处理结果
            await this.processSemanticResult(result, chatId, chatType, openId, messageId, contextId);
        }
        catch (error) {
            logger_1.logger.error('[FeishuBotService] Error handling message:', error);
            await this.replyError(msg);
        }
    }
    // 处理文本输入中的选项选择
    async handleOptionSelection(text, openId) {
        // 获取 pending 上下文
        const contextId = this.getPendingContextId(openId);
        const context = this.contextManager.getContext(contextId);
        if (!context || !context.confirmationOptions || context.confirmationOptions.length === 0) {
            return false; // 没有 pending 的选项
        }
        const lower = text.toLowerCase().trim();
        // 先检查是否匹配某个选项（优先于确认关键词）
        // 检查中文选项匹配 - 优先匹配完整选项
        for (const opt of context.confirmationOptions) {
            const optLower = opt.label.toLowerCase();
            if (lower === optLower || lower.includes(optLower) || optLower.includes(lower)) {
                await this.semanticService.confirm(context.id, opt.id);
                return true;
            }
        }
        // 检查数字选项 (1, 2, 3...)
        const numMatch = text.match(NUMERIC_PATTERN);
        if (numMatch) {
            const index = parseInt(numMatch[1], 10) - 1;
            if (index >= 0 && index < context.confirmationOptions.length) {
                const optionId = context.confirmationOptions[index].id;
                await this.semanticService.confirm(context.id, optionId);
                return true;
            }
        }
        // 检查单个字母选项 (a, b, c, d)
        const letterMatch = text.trim().toLowerCase().match(/^[a-d]$/);
        if (letterMatch) {
            const index = letterMatch[0].charCodeAt(0) - 'a'.charCodeAt(0);
            if (index >= 0 && index < context.confirmationOptions.length) {
                const optionId = context.confirmationOptions[index].id;
                await this.semanticService.confirm(context.id, optionId);
                return true;
            }
        }
        // 检查 opt_X 格式
        const optMatch = text.match(OPT_PATTERN) || text.match(CHINESE_OPT_PATTERN);
        if (optMatch) {
            const optionId = 'opt_' + optMatch[1];
            const exists = context.confirmationOptions.some(o => o.id === optionId);
            if (exists) {
                await this.semanticService.confirm(context.id, optionId);
                return true;
            }
        }
        // 检查是否是取消关键词
        if (CANCEL_KEYWORDS.some(k => lower.includes(k))) {
            await this.semanticService.confirm(context.id, 'cancel');
            return true;
        }
        // 检查是否是确认关键词 - 只有在输入与选项不匹配时才使用第一个选项
        if (CONFIRM_KEYWORDS.some(k => lower === k)) {
            const firstOption = context.confirmationOptions[0].id;
            await this.semanticService.confirm(context.id, firstOption);
            return true;
        }
        return false; // 没有匹配到选项
    }
    // 检测是否需要开启新上下文
    shouldStartNewContext(text, chatId) {
        const lower = text.toLowerCase().trim();
        // 检查显式指令
        if (NEW_CONTEXT_KEYWORDS.some(k => lower.includes(k))) {
            return true;
        }
        // 检查 /new 等命令
        if (NEW_CONTEXT_COMMANDS.some(c => lower.startsWith(c))) {
            return true;
        }
        // 如果没有现有上下文，是首次对话
        const existingContextId = this.chatContextMap.get(chatId);
        if (!existingContextId) {
            return true;
        }
        // 检查现有上下文状态
        const context = this.contextManager.getContext(existingContextId.contextId);
        if (!context || this.isTerminalState(context.status)) {
            return true;
        }
        // 如果有 pending 上下文且用户在选择选项，不开启新会话
        // 这由 semanticService.understand() 处理
        return false;
    }
    // 检查是否为终态
    isTerminalState(status) {
        return status === 'completed' || status === 'cancelled' || status === 'expired';
    }
    // 获取或创建 contextId
    async getOrCreateContextId(chatId, openId) {
        const existing = this.chatContextMap.get(chatId);
        if (existing) {
            const context = this.contextManager.getContext(existing.contextId);
            if (context && !this.isTerminalState(context.status)) {
                return existing.contextId;
            }
        }
        // 创建新上下文
        const contextId = `feishu_${chatId}_${Date.now()}`;
        this.chatContextMap.set(chatId, { chatId, openId, contextId });
        return contextId;
    }
    // 清除上下文
    clearContext(chatId) {
        this.chatContextMap.delete(chatId);
    }
    // 处理语义理解结果
    async processSemanticResult(result, chatId, chatType, openId, messageId, contextId) {
        logger_1.logger.info(`[FeishuBotService] processSemanticResult: success=${result.success}, confirmationQuestion=${result.confirmationQuestion}, confirmationOptions=${result.confirmationOptions?.length}, result=${!!result.result}`);
        // 错误处理
        if (!result.success) {
            logger_1.logger.warn('[FeishuBotService] Semantic result failed:', result.error);
            await this.replyText(openId, chatType, `抱歉，发生了错误：${result.error || '未知错误'}`);
            return;
        }
        // 需要确认 - 发送文本消息（带选项）
        if (result.confirmationQuestion && result.confirmationOptions) {
            logger_1.logger.info('[FeishuBotService] Sending confirmation with options');
            // 使用清晰的格式：1. 选项1  2. 选项2  3. 选项3
            const optionsText = result.confirmationOptions.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
            await this.replyText(openId, chatType, `🤔 ${result.confirmationQuestion}\n\n${optionsText}\n\n请回复数字（1、2、3...）或选项名称。`);
            return;
        }
        // 需要确认选项 - 发送文本消息
        if (result.confirmationOptions && result.confirmationOptions.length > 0) {
            logger_1.logger.info('[FeishuBotService] Sending options with text');
            // 使用清晰的格式：1. 选项1  2. 选项2  3. 选项3
            const optionsText = result.confirmationOptions.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
            const instruction = result.confirmationQuestion
                ? `${result.confirmationQuestion}\n\n${optionsText}\n\n请回复数字（1、2、3...）或选项名称。`
                : `请选择：\n\n${optionsText}\n\n请回复数字（1、2、3...）或选项名称。`;
            await this.replyText(openId, chatType, `🤔 ${instruction}`);
            return;
        }
        // 需要确认但没有选项
        if (result.confirmationQuestion) {
            logger_1.logger.info('[FeishuBotService] Sending confirmation with question');
            await this.replyText(openId, chatType, `🤔 ${result.confirmationQuestion}\n\n请回复"好的"确认，或输入您的补充。`);
            return;
        }
        // 执行成功
        if (result.result) {
            const message = this.formatResultMessage(result);
            await this.replyText(openId, chatType, message);
            return;
        }
        // 未知情况
        logger_1.logger.warn('[FeishuBotService] Unknown semantic result state, intent:', result.intent?.intent);
        await this.replyText(openId, chatType, '我已收到您的消息，正在处理中...');
    }
    // 格式化结果消息
    formatResultMessage(result) {
        const intent = result.intent;
        if (intent?.intent === 'create_task') {
            return `✅ 已为您创建任务：${intent.parameters?.title || '新任务'}`;
        }
        if (intent?.intent === 'query_tasks') {
            return `📋 已查询到任务列表`;
        }
        if (intent?.intent === 'query_events') {
            return `📅 已查询到日程安排`;
        }
        if (intent?.intent === 'complete_task') {
            return `✅ 已完成任务`;
        }
        if (intent?.intent === 'delete_task') {
            return `🗑️ 已删除任务`;
        }
        if (intent?.intent === 'update_task') {
            return `✏️ 已更新任务`;
        }
        return `✅ 操作完成`;
    }
    // 构建确认卡片
    buildConfirmationCard(result) {
        return {
            header: {
                title: { tag: 'plain_text', content: '🤔 请确认' },
                template: 'orange',
            },
            elements: [
                { tag: 'markdown', content: result.confirmationQuestion || '请确认您的意图' },
                { tag: 'hr' },
                {
                    tag: 'action',
                    actions: [
                        { tag: 'button', text: { tag: 'plain_text', content: '好的' }, type: 'primary' },
                        { tag: 'button', text: { tag: 'plain_text', content: '算了' }, type: 'secondary' },
                    ],
                },
            ],
        };
    }
    // 构建选项卡片
    buildOptionsCard(result) {
        const options = result.confirmationOptions || [];
        const buttons = options.map((opt, index) => ({
            tag: 'button',
            text: { tag: 'plain_text', content: opt.label },
            type: index === 0 ? 'primary' : 'default',
        }));
        return {
            header: {
                title: { tag: 'plain_text', content: '🤔 请选择' },
                template: 'orange',
            },
            elements: [
                { tag: 'markdown', content: result.confirmationQuestion || '请问您想做什么？' },
                { tag: 'hr' },
                { tag: 'action', actions: buttons },
            ],
        };
    }
    // 回复文本消息
    async replyText(openIdOrChatId, chatType, text) {
        const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';
        logger_1.logger.info(`[FeishuBotService] replyText: to=${openIdOrChatId}, type=${receiveIdType}, text="${text}"`);
        try {
            await this.connector.sendMessage(receiveIdType, openIdOrChatId, text);
            logger_1.logger.info('[FeishuBotService] Text reply sent successfully');
        }
        catch (error) {
            logger_1.logger.error('[FeishuBotService] Failed to send text reply:', error);
            throw error;
        }
    }
    // 回复卡片消息
    async replyCard(openIdOrChatId, chatType, card) {
        const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';
        logger_1.logger.info(`[FeishuBotService] replyCard: to=${openIdOrChatId}, type=${receiveIdType}, card=`, JSON.stringify(card));
        try {
            await this.connector.sendCardMessage(receiveIdType, openIdOrChatId, card);
            logger_1.logger.info('[FeishuBotService] Card reply sent successfully');
        }
        catch (error) {
            logger_1.logger.error('[FeishuBotService] Failed to send card reply:', error);
            throw error;
        }
    }
    // 回复错误
    async replyError(msg) {
        const errorMessage = '抱歉，我没能理解您的意思。请试试说"帮我创建任务"或"今天有什么安排"。';
        await this.replyText(msg.chatId, msg.chatType, errorMessage);
    }
    // 发送欢迎语
    async sendWelcome(openId, chatType) {
        await this.replyText(openId, chatType, WELCOME_MESSAGE);
    }
    // 发送定时推送通知
    async sendNotification(openId, chatType, content) {
        await this.replyText(openId, chatType, content);
    }
}
exports.FeishuBotService = FeishuBotService;
// 单例
let serviceInstance = null;
function getFeishuBotService() {
    return serviceInstance;
}
function createFeishuBotService(connector) {
    serviceInstance = new FeishuBotService(connector);
    return serviceInstance;
}
//# sourceMappingURL=feishu-bot-service.js.map