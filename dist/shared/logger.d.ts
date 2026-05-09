type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class Logger {
    private level;
    private logFile;
    private enableFile;
    setLevel(level: LogLevel): void;
    setLogFile(filePath: string): void;
    setEnableFile(enable: boolean): void;
    private writeToFile;
    private formatMessage;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map