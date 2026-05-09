"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeishuBotConnector = void 0;
exports.getFeishuBotConnector = getFeishuBotConnector;
exports.createFeishuBotConnector = createFeishuBotConnector;
// 飞书机器人连接器 - 使用 WebSocket 长连接与飞书服务器通信
const node_sdk_1 = require("@larksuiteoapi/node-sdk");
const logger_1 = require("../shared/logger");
class FeishuBotConnector {
    constructor(config) {
        this.channel = null;
        this.isConnected = false;
        this.messageHandler = null;
        this.cardActionHandler = null;
        this.config = config;
    }
    // 启动长连接模式
    async start() {
        try {
            logger_1.logger.info('[FeishuBot] Starting WebSocket connection...');
            // 创建 LarkChannel 实例
            this.channel = new node_sdk_1.LarkChannel({
                appId: this.config.appId,
                appSecret: this.config.appSecret,
                loggerLevel: node_sdk_1.LoggerLevel.debug,
                logger: {
                    debug: (...args) => logger_1.logger.debug('[FeishuBot]', ...args),
                    info: (...args) => logger_1.logger.info('[FeishuBot]', ...args),
                    warn: (...args) => logger_1.logger.warn('[FeishuBot]', ...args),
                    error: (...args) => logger_1.logger.error('[FeishuBot]', ...args),
                    trace: (...args) => logger_1.logger.debug('[FeishuBot]', ...args),
                },
            });
            // 注册消息事件处理器
            this.channel.on('message', async (msg) => {
                logger_1.logger.info('[FeishuBot] Received message:', JSON.stringify(msg));
                if (this.messageHandler) {
                    await this.messageHandler(msg);
                }
            });
            // 注册卡片操作处理器
            this.channel.on('cardAction', async (evt) => {
                logger_1.logger.info('[FeishuBot] Received card action:', JSON.stringify(evt));
                if (this.cardActionHandler) {
                    await this.cardActionHandler(evt);
                }
            });
            // 启动连接（等待 WebSocket 握手完成）
            await this.channel.connect();
            this.isConnected = true;
            logger_1.logger.info('[FeishuBot] WebSocket connection established');
        }
        catch (error) {
            logger_1.logger.error('[FeishuBot] Failed to start:', error);
            throw error;
        }
    }
    // 停止连接
    async stop() {
        if (this.channel) {
            await this.channel.disconnect();
            this.channel = null;
        }
        this.isConnected = false;
        logger_1.logger.info('[FeishuBot] Connection stopped');
    }
    // 注册消息处理器
    onMessage(handler) {
        this.messageHandler = handler;
    }
    // 注册卡片操作处理器
    onCardAction(handler) {
        this.cardActionHandler = handler;
    }
    // 发送文本消息
    async sendMessage(receiveIdType, receiveId, text) {
        if (!this.channel) {
            throw new Error('FeishuBot not connected');
        }
        try {
            const input = { text };
            logger_1.logger.info(`[FeishuBot] Sending text message to ${receiveId} via ${receiveIdType}`);
            await this.channel.send(receiveId, input);
            logger_1.logger.debug(`[FeishuBot] Message sent to ${receiveId}`);
        }
        catch (error) {
            logger_1.logger.error('[FeishuBot] Failed to send message:', error);
            throw error;
        }
    }
    // 发送卡片消息
    async sendCardMessage(receiveIdType, receiveId, card) {
        if (!this.channel) {
            throw new Error('FeishuBot not connected');
        }
        try {
            const input = { card };
            await this.channel.send(receiveId, input);
            logger_1.logger.debug(`[FeishuBot] Card message sent to ${receiveId}`);
        }
        catch (error) {
            logger_1.logger.error('[FeishuBot] Failed to send card:', error);
            throw error;
        }
    }
    // 回复消息（使用 message_id）
    async replyMessage(messageId, text) {
        if (!this.channel) {
            throw new Error('FeishuBot not connected');
        }
        try {
            const input = { text };
            await this.channel.send(messageId, input, { replyTo: messageId });
            logger_1.logger.debug(`[FeishuBot] Replied to message ${messageId}`);
        }
        catch (error) {
            logger_1.logger.error('[FeishuBot] Failed to reply message:', error);
            throw error;
        }
    }
    // 获取连接状态
    getConnectionStatus() {
        return this.isConnected;
    }
    // 获取原始 channel 实例（用于高级操作）
    getChannel() {
        return this.channel;
    }
}
exports.FeishuBotConnector = FeishuBotConnector;
// 单例
let connectorInstance = null;
function getFeishuBotConnector() {
    return connectorInstance;
}
function createFeishuBotConnector(config) {
    connectorInstance = new FeishuBotConnector(config);
    return connectorInstance;
}
//# sourceMappingURL=feishu-bot.js.map