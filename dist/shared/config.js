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
class ConfigManager {
    constructor() {
        this.config = null;
    }
    load(configPath) {
        if (this.config) {
            return this.config;
        }
        const defaultPaths = [
            configPath,
            path.join(process.cwd(), 'config.yaml'),
            path.join(__dirname, '../../config.yaml'),
            'C:\\Users\\AILJ\\Documents\\Astalavista\\secretary\\config.yaml',
        ].filter(Boolean);
        for (const p of defaultPaths) {
            if (fs.existsSync(p)) {
                this.config = this.loadFromFile(p);
                console.log(`[Config] Loaded config from: ${p}`);
                return this.config;
            }
        }
        throw new Error('config.yaml not found');
    }
    loadFromFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = {};
        const lines = content.split('\n');
        let currentSection = result;
        const sectionStack = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const indent = line.length - line.trimStart().length;
            // Section header (ends with : and not a key-value pair)
            if (trimmed.endsWith(':') && !trimmed.includes(': ')) {
                const sectionName = trimmed.slice(0, -1).trim();
                const newSection = {};
                // Pop sections from stack that are at same or higher indent
                while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].indent >= indent) {
                    sectionStack.pop();
                }
                // Add to parent
                if (sectionStack.length > 0) {
                    sectionStack[sectionStack.length - 1].section[sectionName] = newSection;
                }
                else {
                    result[sectionName] = newSection;
                }
                // Push new section to stack
                sectionStack.push({ indent, section: newSection });
                currentSection = newSection;
                continue;
            }
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0) {
                const key = trimmed.substring(0, colonIndex).trim();
                let value = trimmed.substring(colonIndex + 1).trim();
                // Parse value types
                if (typeof value === 'string') {
                    if (value === 'true')
                        value = true;
                    else if (value === 'false')
                        value = false;
                    else if (/^\d+$/.test(value))
                        value = parseInt(value, 10);
                    else if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                }
                // Add to current section (which is the innermost section at current indent level)
                if (sectionStack.length > 0) {
                    sectionStack[sectionStack.length - 1].section[key] = value;
                }
                else {
                    currentSection[key] = value;
                }
            }
        }
        return result;
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