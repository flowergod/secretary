import { FeishuBotConnector } from '../connectors/feishu-bot';
import { CardActionEvent } from '@larksuiteoapi/node-sdk';
import { NormalizedMessage } from '@larksuiteoapi/node-sdk';
export declare class FeishuBotService {
    private connector;
    private semanticService;
    private contextManager;
    private chatContextMap;
    constructor(connector: FeishuBotConnector);
    start(): Promise<void>;
    stop(): void;
    handleCardAction(evt: CardActionEvent): Promise<void>;
    private getPendingContextId;
    handleMessage(msg: NormalizedMessage): Promise<void>;
    private handleOptionSelection;
    private shouldStartNewContext;
    private isTerminalState;
    private getOrCreateContextId;
    private clearContext;
    private processSemanticResult;
    private formatResultMessage;
    private buildConfirmationCard;
    private buildOptionsCard;
    private replyText;
    private replyCard;
    private replyError;
    sendWelcome(openId: string, chatType: 'p2p' | 'group'): Promise<void>;
    sendNotification(openId: string, chatType: 'p2p' | 'group', content: string): Promise<void>;
}
export declare function getFeishuBotService(): FeishuBotService | null;
export declare function createFeishuBotService(connector: FeishuBotConnector): FeishuBotService;
//# sourceMappingURL=feishu-bot-service.d.ts.map