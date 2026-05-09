// 配置管理
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './types';

export class ConfigManager {
  private config: AppConfig | null = null;

  load(configPath?: string): AppConfig {
    if (this.config) {
      return this.config;
    }

    const defaultPaths = [
      configPath,
      path.join(process.cwd(), 'config.yaml'),
      path.join(__dirname, '../../config.yaml'),
      'C:\\Users\\AILJ\\Documents\\Astalavista\\secretary\\config.yaml',
    ].filter(Boolean) as string[];

    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        this.config = this.loadFromFile(p);
        console.log(`[Config] Loaded config from: ${p}`);
        return this.config;
      }
    }

    throw new Error('config.yaml not found');
  }

  private loadFromFile(filePath: string): AppConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result: Record<string, unknown> = {};

    const lines = content.split('\n');
    let currentSection: Record<string, unknown> = result;
    const sectionStack: Array<{ indent: number; section: Record<string, unknown> }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.length - line.trimStart().length;

      // Section header (ends with : and not a key-value pair)
      if (trimmed.endsWith(':') && !trimmed.includes(': ')) {
        const sectionName = trimmed.slice(0, -1).trim();
        const newSection: Record<string, unknown> = {};

        // Pop sections from stack that are at same or higher indent
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].indent >= indent) {
          sectionStack.pop();
        }

        // Add to parent
        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].section[sectionName] = newSection;
        } else {
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
        let value: unknown = trimmed.substring(colonIndex + 1).trim();

        // Parse value types
        if (typeof value === 'string') {
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (/^\d+$/.test(value)) value = parseInt(value as string, 10);
          else if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = (value as string).slice(1, -1);
          }
        }

        // Add to current section (which is the innermost section at current indent level)
        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].section[key] = value;
        } else {
          currentSection[key] = value;
        }
      }
    }

    return result as unknown as AppConfig;
  }

  get(): AppConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }
}

export const configManager = new ConfigManager();
