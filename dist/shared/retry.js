"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryError = void 0;
exports.withRetry = withRetry;
exports.retry = retry;
const DEFAULT_OPTIONS = {
    maxAttempts: 3,
    delayMs: 2000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
};
class RetryError extends Error {
    constructor(message, attempts, lastError) {
        super(message);
        this.attempts = attempts;
        this.lastError = lastError;
        this.name = 'RetryError';
    }
}
exports.RetryError = RetryError;
async function withRetry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === opts.maxAttempts) {
                throw new RetryError(`Failed after ${attempt} attempts: ${lastError.message}`, attempt, lastError);
            }
            const delay = Math.min(opts.delayMs * Math.pow(opts.backoffMultiplier, attempt - 1), opts.maxDelayMs);
            if (attempt < opts.maxAttempts) {
                await sleep(delay);
            }
        }
    }
    throw new RetryError(`Failed after ${opts.maxAttempts} attempts`, opts.maxAttempts, lastError || new Error('Unknown error'));
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function retry(options = {}) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        if (!originalMethod) {
            return descriptor;
        }
        descriptor.value = async function (...args) {
            return withRetry(() => originalMethod.apply(this, args), options);
        };
        return descriptor;
    };
}
//# sourceMappingURL=retry.js.map