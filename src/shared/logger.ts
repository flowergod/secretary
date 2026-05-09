// 日志工具

import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';
  private logFile: string = '';
  private enableFile: boolean = true;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setLogFile(filePath: string): void {
    this.logFile = filePath;
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  setEnableFile(enable: boolean): void {
    this.enableFile = enable;
  }

  private writeToFile(message: string): void {
    if (this.enableFile && this.logFile) {
      try {
        fs.appendFileSync(this.logFile, message + '\n');
      } catch (e) {
        console.error('Failed to write to log file:', e);
      }
    }
  }

  private formatMessage(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    // 格式化额外参数，字符串直接拼接，对象用 JSON
    let argsStr = '';
    if (args.length > 0) {
      for (const arg of args) {
        if (typeof arg === 'string') {
          argsStr += ' ' + arg;
        } else {
          argsStr += ' ' + JSON.stringify(arg);
        }
      }
    }
    return `[${timestamp}] [${level}] ${message}${argsStr}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
      const formatted = this.formatMessage('DEBUG', message, args);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
      const formatted = this.formatMessage('INFO', message, args);
      console.log(formatted);
      this.writeToFile(formatted);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
      const formatted = this.formatMessage('WARN', message, args);
      console.warn(formatted);
      this.writeToFile(formatted);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
      const formatted = this.formatMessage('ERROR', message, args);
      console.error(formatted);
      this.writeToFile(formatted);
    }
  }
}

export const logger = new Logger();

// 设置默认日志文件
logger.setLogFile(path.join(__dirname, '../../logs/server.log'));