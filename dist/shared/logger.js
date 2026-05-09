"use strict";
// 日志工具
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class Logger {
    constructor() {
        this.level = 'info';
        this.logFile = '';
        this.enableFile = true;
    }
    setLevel(level) {
        this.level = level;
    }
    setLogFile(filePath) {
        this.logFile = filePath;
        // Ensure directory exists
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    setEnableFile(enable) {
        this.enableFile = enable;
    }
    writeToFile(message) {
        if (this.enableFile && this.logFile) {
            try {
                fs_1.default.appendFileSync(this.logFile, message + '\n');
            }
            catch (e) {
                console.error('Failed to write to log file:', e);
            }
        }
    }
    formatMessage(level, message, args) {
        const timestamp = new Date().toISOString();
        // 格式化额外参数，字符串直接拼接，对象用 JSON
        let argsStr = '';
        if (args.length > 0) {
            for (const arg of args) {
                if (typeof arg === 'string') {
                    argsStr += ' ' + arg;
                }
                else {
                    argsStr += ' ' + JSON.stringify(arg);
                }
            }
        }
        return `[${timestamp}] [${level}] ${message}${argsStr}`;
    }
    debug(message, ...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
            const formatted = this.formatMessage('DEBUG', message, args);
            console.log(formatted);
            this.writeToFile(formatted);
        }
    }
    info(message, ...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
            const formatted = this.formatMessage('INFO', message, args);
            console.log(formatted);
            this.writeToFile(formatted);
        }
    }
    warn(message, ...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
            const formatted = this.formatMessage('WARN', message, args);
            console.warn(formatted);
            this.writeToFile(formatted);
        }
    }
    error(message, ...args) {
        if (LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
            const formatted = this.formatMessage('ERROR', message, args);
            console.error(formatted);
            this.writeToFile(formatted);
        }
    }
}
exports.logger = new Logger();
// 设置默认日志文件
exports.logger.setLogFile(path_1.default.join(__dirname, '../../logs/server.log'));
//# sourceMappingURL=logger.js.map