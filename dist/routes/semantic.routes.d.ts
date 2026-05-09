import { IncomingMessage, ServerResponse } from 'http';
export declare function semanticUnderstand(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function semanticConfirm(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function semanticGetContext(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function getSemanticLogs(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function getSemanticLog(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function getSemanticStats(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function getTrace(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function queryTraces(req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function getTraceStats(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=semantic.routes.d.ts.map