// 配置管理
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './types';

const DEFAULT_CONFIG: Partial<AppConfig> = {
  reminders: {
    morning: { enabled: true, time: '8:30' },
    evening: { enabled: true, time: '21:00' },
    weekendSummary: { enabled: true, time: '18:00', dayOfWeek: 5 },
    preEvent: { enabled: true, minutesBefore: 15 },
    idleTime: { enabled: true, minFreeMinutes: 60 },
  },
};

export class ConfigManager {
  private config: AppConfig | null = null;

  load(configPath?: string): AppConfig {
    if (this.config) {
      return this.config;
    }

    const defaultConfig = this.getDefaultConfig();

    if (configPath && fs.existsSync(configPath)) {
      const userConfig = this.loadFromFile(configPath);
      this.config = this.mergeConfig(defaultConfig, userConfig);
    } else {
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

      this.config = defaultConfig as AppConfig;
    }

    return this.config;
  }

  private loadFromFile(filePath: string): Partial<AppConfig> {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      return this.parseYaml(content);
    }

    return {};
  }

  private parseYaml(content: string): Partial<AppConfig> {
    // Simple YAML parser for nested structures
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentSection: Record<string, unknown> | null = null;
    let currentSubsection: Record<string, unknown> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for section header (no colon or ends with colon without value)
      if (trimmed.endsWith(':') && !trimmed.includes(': ')) {
        const sectionName = trimmed.slice(0, -1).trim();
        if (sectionName === 'feishu' || sectionName === 'icloud' || sectionName === 'ai' || sectionName === 'reminders') {
          currentSection = {};
          result[sectionName] = currentSection;
          currentSubsection = null;
        } else if (currentSection && ['primary', 'fallback', 'morning', 'evening', 'weekendSummary', 'preEvent', 'idleTime'].includes(sectionName)) {
          currentSubsection = {};
          currentSection[sectionName] = currentSubsection;
        }
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value: unknown = trimmed.substring(colonIndex + 1).trim();

        // Parse value types
        if (typeof value === 'string') {
          if (value === 'true' || value === 'false') {
            value = value === 'true';
          } else if (/^\d+$/.test(value)) {
            value = parseInt(value, 10);
          } else if ((value.startsWith('"') && value.endsWith('"')) ||
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
        } else if (currentSection) {
          currentSection[key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    return result as Partial<AppConfig>;
  }

  private getDefaultConfig(): AppConfig {
    return {
      feishu: {
        webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
        tableToken: process.env.FEISHU_TABLE_TOKEN || '',
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
      reminders: DEFAULT_CONFIG.reminders!,
    };
  }

  private mergeConfig(defaults: AppConfig, overrides: Partial<AppConfig>): AppConfig {
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
    };
  }

  get(): AppConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }
}

export const configManager = new ConfigManager();
