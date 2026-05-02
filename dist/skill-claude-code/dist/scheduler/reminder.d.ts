export interface ReminderSchedule {
    name: string;
    schedule: string;
    handler: string;
}
export declare class ReminderScheduler {
    private schedules;
    private isRunning;
    /**
     * 启动调度器
     */
    start(): void;
    /**
     * 停止调度器
     */
    stop(): void;
    /**
     * 执行指定任务
     */
    execute(handler: string): Promise<void>;
    /**
     * 早安提醒
     */
    private handleMorningReminder;
    /**
     * 晚安提醒
     */
    private handleEveningReminder;
    /**
     * 周末总结
     */
    private handleWeekendSummary;
    /**
     * 事前提醒
     */
    private handlePreEventReminder;
    private scheduleJob;
    private parseCron;
    private matchesCron;
}
export declare const reminderScheduler: ReminderScheduler;
//# sourceMappingURL=reminder.d.ts.map