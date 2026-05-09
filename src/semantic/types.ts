// 语义理解层类型定义

// 意图类型枚举
export enum IntentType {
  CREATE_TASK = 'create_task',
  CREATE_EVENT = 'create_event',
  QUERY_TASKS = 'query_tasks',
  QUERY_EVENTS = 'query_events',
  UPDATE_TASK = 'update_task',
  UPDATE_EVENT = 'update_event',
  COMPLETE_TASK = 'complete_task',
  DELETE_TASK = 'delete_task',
  DELETE_EVENT = 'delete_event',
  EXPAND_TASK = 'expand_task',  // 智能规划
  OTHER = 'other',
}

// 实体类型
export type EntityType = 'task' | 'event' | 'calendar';

// 解析后的意图
export interface ParsedIntent {
  id?: string;
  intent: IntentType;
  entityType: EntityType;
  parameters: Record<string, unknown>;
  confidence: number;
  needsConfirmation: boolean;
  lowConfidence: boolean;  // 置信度太低，需要用户确认
  reasoning: string;
  rawInput: string;
}

// 确认选项
export interface ConfirmationOption {
  id: string;
  label: string;
  type: string;
  taskId?: string;  // 如果是任务类型选项，关联的任务ID
}

// 语义理解结果
export interface SemanticResult {
  success: boolean;
  intent?: ParsedIntent;
  confirmationQuestion?: string;
  confirmationOptions?: ConfirmationOption[];
  openOption?: { id: string; label: string };
  lowConfidence?: boolean;
  requiresExecution?: boolean;
  result?: {
    taskId: string;
    action: string;
    icloudEventId?: string;
  };
  cancelled?: boolean;
  message?: string;
  logId?: string;
  traceId?: string;
  error?: string;
}

// 能力定义
export interface Capability {
  id: string;
  name: string;
  intent: IntentType;
  requiredParams: string[];
  optionalParams: string[];
  description: string;
  examples: string[];
}

// 提示词模板
export interface PromptTemplate {
  id: string;
  version: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  examples?: Array<{
    input: string;
    output: Record<string, unknown>;
  }>;
}

// LLM请求
export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

// LLM响应
export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason?: string;
}

// LLM配置
export interface LLMConfig {
  provider: 'volcano' | 'minimax' | 'openai';
  apiKey: string;
  model: string;
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
}

// 能力分发结果
export interface DispatchResult {
  success: boolean;
  data?: unknown;
  error?: string;
  capabilityId?: string;
}

// 指代词解析结果
export interface ReferenceResolutionResult {
  found: boolean;
  resolvedTask: {
    taskId: string;
    recordId: string;
    title: string;
  } | null;
  resolvedUserInput: string;
}
