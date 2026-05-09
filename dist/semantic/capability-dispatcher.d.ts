import { Capability, DispatchResult, ParsedIntent } from './types';
export declare class CapabilityDispatcher {
    private capabilities;
    constructor();
    getAllCapabilities(): Capability[];
    dispatch(parsedIntent: ParsedIntent): Promise<DispatchResult>;
    private createTask;
    private queryTasks;
    private queryEvents;
    private completeTask;
    private deleteTask;
    private updateTask;
    private createEvent;
    private updateEvent;
    private normalizeTimeString;
    private moveICloudEvent;
}
//# sourceMappingURL=capability-dispatcher.d.ts.map