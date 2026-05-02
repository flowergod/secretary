"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiniMaxProvider = void 0;
// MiniMax AI Provider
const client_1 = require("./client");
const config_1 = require("../shared/config");
class MiniMaxProvider extends client_1.AIProvider {
    name() {
        return 'minimax';
    }
    async chat(request) {
        const config = config_1.configManager.get();
        const { apiKey, baseUrl, model } = config.ai.fallback;
        const url = baseUrl
            ? `${baseUrl}/chat/completions`
            : 'https://api.minimax.io/anthropic/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model || 'MiniMax-Text-01',
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2048,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || model || 'minimax',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
            } : undefined,
        };
    }
}
exports.MiniMaxProvider = MiniMaxProvider;
//# sourceMappingURL=minimax.js.map