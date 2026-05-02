import { AppConfig } from './types';
export declare class ConfigManager {
    private config;
    load(configPath?: string): AppConfig;
    private loadFromFile;
    private parseYaml;
    private getDefaultConfig;
    private mergeConfig;
    get(): AppConfig;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=config.d.ts.map