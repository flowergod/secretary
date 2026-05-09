import { IncomingMessage, ServerResponse } from 'http';
type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export declare const createTask: Handler;
export declare const listTasks: Handler;
export declare const getTask: Handler;
export declare const updateTask: Handler;
export declare const deleteTask: Handler;
export declare const batchDeleteTasks: Handler;
export declare const completeTask: Handler;
export declare const transitionTask: Handler;
export {};
//# sourceMappingURL=task.routes.d.ts.map