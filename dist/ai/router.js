"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = exports.AIRouter = void 0;
const volcano_1 = require("./volcano");
const minimax_1 = require("./minimax");
class AIRouter {
    constructor() {
        this.primary = new volcano_1.VolcanoProvider();
        this.fallback = new minimax_1.MiniMaxProvider();
    }
    async chat(request) {
        try {
            console.log(`[AIRouter] Using primary provider: ${this.primary.name()}`);
            return await this.primary.chat(request);
        }
        catch (error) {
            console.warn(`[AIRouter] Primary provider failed, trying fallback: ${error}`);
            return this.fallback.chat(request);
        }
    }
    getPrimaryProvider() {
        return this.primary;
    }
    getFallbackProvider() {
        return this.fallback;
    }
}
exports.AIRouter = AIRouter;
exports.aiRouter = new AIRouter();
//# sourceMappingURL=router.js.map