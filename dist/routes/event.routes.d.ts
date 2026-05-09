import { IncomingMessage, ServerResponse } from 'http';
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export declare const listEvents: Handler;
export declare const getEvent: Handler;
export declare const createEvent: Handler;
export declare const updateEvent: Handler;
export declare const deleteEvent: Handler;
export declare const syncFromICloud: Handler;
export declare const syncToICloud: Handler;
export {};
//# sourceMappingURL=event.routes.d.ts.map