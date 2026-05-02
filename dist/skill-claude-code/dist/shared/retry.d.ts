export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
}
export declare class RetryError extends Error {
    readonly attempts: number;
    readonly lastError: Error;
    constructor(message: string, attempts: number, lastError: Error);
}
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
export declare function retry(options?: RetryOptions): <T>(_target: object, _propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>) => TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>;
//# sourceMappingURL=retry.d.ts.map