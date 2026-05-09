// 飞书机器人连接器 - 使用 WebSocket 长连接与飞书服务器通信
import { LarkChannel, LoggerLevel, NormalizedMessage, CardActionEvent, SendInput } from '@larksuiteoapi/node-sdk';
import { logger } from '../shared/logger';

// 消息处理器类型
export type MessageHandler = (data: NormalizedMessage) => Promise<void>;
export type CardActionHandler = (data: CardActionEvent) => Promise<void>;

// 飞书机器人配置
export interface FeishuBotConfig {
  appId: string;
  appSecret: string;
  botName?: string;
}

export class FeishuBotConnector {
  private config: FeishuBotConfig;
  private channel: LarkChannel | null = null;
  private isConnected = false;
  private messageHandler: MessageHandler | null = null;
  private cardActionHandler: CardActionHandler | null = null;

  constructor(config: FeishuBotConfig) {
    this.config = config;
  }

  // 启动长连接模式
  async start(): Promise<void> {
    try {
      logger.info('[FeishuBot] Starting WebSocket connection...');

      // 创建 LarkChannel 实例
      this.channel = new LarkChannel({
        appId: this.config.appId,
        appSecret: this.config.appSecret,
        loggerLevel: LoggerLevel.debug,
        logger: {
          debug: (...args: unknown[]) => logger.debug('[FeishuBot]', ...args),
          info: (...args: unknown[]) => logger.info('[FeishuBot]', ...args),
          warn: (...args: unknown[]) => logger.warn('[FeishuBot]', ...args),
          error: (...args: unknown[]) => logger.error('[FeishuBot]', ...args),
          trace: (...args: unknown[]) => logger.debug('[FeishuBot]', ...args),
        },
      });

      // 注册消息事件处理器
      this.channel.on('message', async (msg: NormalizedMessage) => {
        logger.info('[FeishuBot] Received message:', JSON.stringify(msg));

        if (this.messageHandler) {
          await this.messageHandler(msg);
        }
      });

      // 注册卡片操作处理器
      this.channel.on('cardAction', async (evt: CardActionEvent) => {
        logger.info('[FeishuBot] Received card action:', JSON.stringify(evt));

        if (this.cardActionHandler) {
          await this.cardActionHandler(evt);
        }
      });

      // 启动连接（等待 WebSocket 握手完成）
      await this.channel.connect();

      this.isConnected = true;
      logger.info('[FeishuBot] WebSocket connection established');
    } catch (error) {
      logger.error('[FeishuBot] Failed to start:', error);
      throw error;
    }
  }

  // 停止连接
  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.disconnect();
      this.channel = null;
    }

    this.isConnected = false;
    logger.info('[FeishuBot] Connection stopped');
  }

  // 注册消息处理器
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  // 注册卡片操作处理器
  onCardAction(handler: CardActionHandler): void {
    this.cardActionHandler = handler;
  }

  // 发送文本消息
  async sendMessage(receiveIdType: 'open_id' | 'chat_id', receiveId: string, text: string): Promise<void> {
    if (!this.channel) {
      throw new Error('FeishuBot not connected');
    }

    try {
      const input: SendInput = { text };
      logger.info(`[FeishuBot] Sending text message to ${receiveId} via ${receiveIdType}`);
      await this.channel.send(receiveId, input);
      logger.debug(`[FeishuBot] Message sent to ${receiveId}`);
    } catch (error) {
      logger.error('[FeishuBot] Failed to send message:', error);
      throw error;
    }
  }

  // 发送卡片消息
  async sendCardMessage(
    receiveIdType: 'open_id' | 'chat_id',
    receiveId: string,
    card: object
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('FeishuBot not connected');
    }

    try {
      const input: SendInput = { card };
      await this.channel.send(receiveId, input);
      logger.debug(`[FeishuBot] Card message sent to ${receiveId}`);
    } catch (error) {
      logger.error('[FeishuBot] Failed to send card:', error);
      throw error;
    }
  }

  // 回复消息（使用 message_id）
  async replyMessage(messageId: string, text: string): Promise<void> {
    if (!this.channel) {
      throw new Error('FeishuBot not connected');
    }

    try {
      const input: SendInput = { text };
      await this.channel.send(messageId, input, { replyTo: messageId });
      logger.debug(`[FeishuBot] Replied to message ${messageId}`);
    } catch (error) {
      logger.error('[FeishuBot] Failed to reply message:', error);
      throw error;
    }
  }

  // 获取连接状态
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // 获取原始 channel 实例（用于高级操作）
  getChannel(): LarkChannel | null {
    return this.channel;
  }
}

// 单例
let connectorInstance: FeishuBotConnector | null = null;

export function getFeishuBotConnector(): FeishuBotConnector | null {
  return connectorInstance;
}

export function createFeishuBotConnector(config: FeishuBotConfig): FeishuBotConnector {
  connectorInstance = new FeishuBotConnector(config);
  return connectorInstance;
}