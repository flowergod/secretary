import { LarkChannel, NormalizedMessage, CardActionEvent } from '@larksuiteoapi/node-sdk';
export type MessageHandler = (data: NormalizedMessage) => Promise<void>;
export type CardActionHandler = (data: CardActionEvent) => Promise<void>;
export interface FeishuBotConfig {
    appId: string;
    appSecret: string;
    botName?: string;
}
export declare class FeishuBotConnector {
    private config;
    private channel;
    private isConnected;
    private messageHandler;
    private cardActionHandler;
    constructor(config: FeishuBotConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    onMessage(handler: MessageHandler): void;
    onCardAction(handler: CardActionHandler): void;
    sendMessage(receiveIdType: 'open_id' | 'chat_id', receiveId: string, text: string): Promise<void>;
    sendCardMessage(receiveIdType: 'open_id' | 'chat_id', receiveId: string, card: object): Promise<void>;
    replyMessage(messageId: string, text: string): Promise<void>;
    getConnectionStatus(): boolean;
    getChannel(): LarkChannel | null;
}
export declare function getFeishuBotConnector(): FeishuBotConnector | null;
export declare function createFeishuBotConnector(config: FeishuBotConfig): FeishuBotConnector;
//# sourceMappingURL=feishu-bot.d.ts.map