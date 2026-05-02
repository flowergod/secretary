"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolcanoProvider = void 0;
// 火山方舟 AI Provider
const client_1 = require("./client");
const config_1 = require("../shared/config");
class VolcanoProvider extends client_1.AIProvider {
    name() {
        return 'volcano';
    }
    async chat(request) {
        const config = config_1.configManager.get();
        const { apiKey, baseUrl, model } = config.ai.primary;
        const url = baseUrl
            ? `${baseUrl}/chat/completions`
            : 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model || 'coding-plan',
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2048,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Volcano API error: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || model || 'volcano',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
            } : undefined,
        };
    }
}
exports.VolcanoProvider = VolcanoProvider;
//# sourceMappingURL=volcano.js.map