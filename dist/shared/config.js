"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = void 0;
// 配置管理
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    reminders: {
        morning: { enabled: true, time: '8:30' },
        evening: { enabled: true, time: '21:00' },
        weekendSummary: { enabled: true, time: '18:00', dayOfWeek: 5 },
        preEvent: { enabled: true, minutesBefore: 15 },
        idleTime: { enabled: true, minFreeMinutes: 60 },
    },
};
class ConfigManager {
    constructor() {
        this.config = null;
    }
    load(configPath) {
        if (this.config) {
            return this.config;
        }
        const defaultConfig = this.getDefaultConfig();
        if (configPath && fs.existsSync(configPath)) {
            const userConfig = this.loadFromFile(configPath);
            this.config = this.mergeConfig(defaultConfig, userConfig);
        }
        else {
            // Try to load from default locations
            const defaultPaths = [
                path.join(process.cwd(), 'config.yaml'),
                path.join(process.cwd(), 'config.json'),
                path.join(__dirname, '../../config.yaml'),
                path.join(__dirname, '../../config.json'),
            ];
            for (const p of defaultPaths) {
                if (fs.existsSync(p)) {
                    const userConfig = this.loadFromFile(p);
                    this.config = this.mergeConfig(defaultConfig, userConfig);
                    return this.config;
                }
            }
            this.config = defaultConfig;
        }
        return this.config;
    }
    loadFromFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf-8');
        if (ext === '.json') {
            return JSON.parse(content);
        }
        else if (ext === '.yaml' || ext === '.yml') {
            return this.parseYaml(content);
        }
        return {};
    }
    parseYaml(content) {
        // Simple YAML parser for nested structures
        const result = {};
        const lines = content.split('\n');
        let currentSection = null;
        let currentSubsection = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            // Check for section header (no colon or ends with colon without value)
            if (trimmed.endsWith(':') && !trimmed.includes(': ')) {
                const sectionName = trimmed.slice(0, -1).trim();
                if (sectionName === 'feishu' || sectionName === 'icloud' || sectionName === 'ai' || sectionName === 'reminders' || sectionName === 'nlParse') {
                    currentSection = {};
                    result[sectionName] = currentSection;
                    currentSubsection = null;
                }
                else if (currentSection && ['primary', 'fallback', 'morning', 'evening', 'weekendSummary', 'preEvent', 'idleTime', 'calendarMapping'].includes(sectionName)) {
                    currentSubsection = {};
                    currentSection[sectionName] = currentSubsection;
                }
                continue;
            }
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0) {
                const key = trimmed.substring(0, colonIndex).trim();
                let value = trimmed.substring(colonIndex + 1).trim();
                // Parse value types
                if (typeof value === 'string') {
                    if (value === 'true' || value === 'false') {
                        value = value === 'true';
                    }
                    else if (/^\d+$/.test(value)) {
                        value = parseInt(value, 10);
                    }
                    else if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                }
                if (value === '') {
                    value = undefined;
                }
                // Handle ${ENV_VAR} placeholder
                if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
                    const envVar = value.slice(2, -1);
                    value = process.env[envVar] || '';
                }
                if (currentSubsection) {
                    currentSubsection[key] = value;
                }
                else if (currentSection) {
                    currentSection[key] = value;
                }
                else {
                    result[key] = value;
                }
            }
        }
        return result;
    }
    getDefaultConfig() {
        return {
            feishu: {
                appId: process.env.FEISHU_APP_ID || '',
                appSecret: process.env.FEISHU_APP_SECRET || '',
                webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
                tableToken: process.env.FEISHU_TABLE_TOKEN || '',
                tableId: process.env.FEISHU_TABLE_ID || '',
            },
            icloud: {
                appleId: process.env.ICLOUD_APPLE_ID || '',
                appPassword: process.env.ICLOUD_APP_PASSWORD || '',
            },
            ai: {
                primary: {
                    provider: 'volcano',
                    apiKey: process.env.VOLCANO_API_KEY || '',
                    model: 'coding-plan',
                },
                fallback: {
                    provider: 'minimax',
                    apiKey: process.env.MINIMAX_API_KEY || '',
                    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic',
                },
            },
            reminders: DEFAULT_CONFIG.reminders,
            nlParse: {
                enabled: true,
                fallbackThreshold: 0.3,
                learnFromSuccess: true,
                maxRetries: 2,
            },
        };
    }
    mergeConfig(defaults, overrides) {
        return {
            feishu: { ...defaults.feishu, ...overrides.feishu },
            icloud: { ...defaults.icloud, ...overrides.icloud },
            ai: {
                primary: { ...defaults.ai.primary, ...overrides.ai?.primary },
                fallback: { ...defaults.ai.fallback, ...overrides.ai?.fallback },
            },
            reminders: {
                morning: { ...defaults.reminders.morning, ...overrides.reminders?.morning },
                evening: { ...defaults.reminders.evening, ...overrides.reminders?.evening },
                weekendSummary: { ...defaults.reminders.weekendSummary, ...overrides.reminders?.weekendSummary },
                preEvent: { ...defaults.reminders.preEvent, ...overrides.reminders?.preEvent },
                idleTime: { ...defaults.reminders.idleTime, ...overrides.reminders?.idleTime },
            },
            nlParse: {
                enabled: overrides.nlParse?.enabled ?? defaults.nlParse?.enabled ?? true,
                fallbackThreshold: overrides.nlParse?.fallbackThreshold ?? defaults.nlParse?.fallbackThreshold ?? 0.3,
                learnFromSuccess: overrides.nlParse?.learnFromSuccess ?? defaults.nlParse?.learnFromSuccess ?? true,
                maxRetries: overrides.nlParse?.maxRetries ?? defaults.nlParse?.maxRetries ?? 2,
            },
        };
    }
    get() {
        if (!this.config) {
            return this.load();
        }
        return this.config;
    }
}
exports.ConfigManager = ConfigManager;
exports.configManager = new ConfigManager();
//# sourceMappingURL=config.js.map