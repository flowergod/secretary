// 提示词管理 - 加载、渲染提示词模板
import { PromptTemplate, Capability } from './types';
import { INTENT_CLASSIFICATION_PROMPT } from './prompts/intent-classification';
import { PARAMETER_EXTRACTION_PROMPT } from './prompts/parameter-extraction';
import { CONFIRMATION_PROMPT } from './prompts/confirmation';
import { CONTEXTUAL_UNDERSTANDING_PROMPT } from './prompts/contextual-understanding';
import { REFERENCE_RESOLUTION_PROMPT } from './prompts/reference-resolution';
import { MentionRecord } from './context-manager';
import { logger } from '../shared/logger';

export type PromptType = 'intent_classification' | 'parameter_extraction' | 'confirmation' | 'contextual_understanding' | 'reference_resolution';

export class PromptManager {
  private templates: Map<PromptType, PromptTemplate>;

  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.templates.set('intent_classification', INTENT_CLASSIFICATION_PROMPT);
    this.templates.set('parameter_extraction', PARAMETER_EXTRACTION_PROMPT);
    this.templates.set('confirmation', CONFIRMATION_PROMPT);
    this.templates.set('contextual_understanding', CONTEXTUAL_UNDERSTANDING_PROMPT);
    this.templates.set('reference_resolution', REFERENCE_RESOLUTION_PROMPT);
    logger.debug('[PromptManager] Loaded templates:', Array.from(this.templates.keys()));
  }

  // 获取提示词模板
  getTemplate(type: PromptType): PromptTemplate | undefined {
    return this.templates.get(type);
  }

  // 渲染意图分类提示词
  renderIntentClassification(
    userInput: string,
    capabilities: Capability[],
    resolvedContext?: {
      resolvedTaskId?: string;
      resolvedRecordId?: string;
      resolvedTaskTitle?: string;
    }
  ): { system: string; user: string } {
    const template = this.templates.get('intent_classification');
    if (!template) {
      throw new Error('Template not found: intent_classification');
    }

    // 生成能力列表
    const capabilitiesList = capabilities
      .map(c => `- ${c.id}: ${c.name} - ${c.description}`)
      .join('\n');

    // 生成解析上下文
    let contextText = '';
    if (resolvedContext?.resolvedTaskTitle) {
      contextText = `\n\n【上下文信息】\n用户可能在引用以下任务：\n- 任务标题：${resolvedContext.resolvedTaskTitle}\n- 任务ID：${resolvedContext.resolvedTaskId || '未知'}\n如果用户说"刚才那个"、"修改它"等指代词，应设置 taskId 参数为上述任务ID。`;

      // 更新 system prompt
      const system = template.systemPrompt
        .replace('{capabilities}', capabilitiesList) + contextText;

      const user = template.userPromptTemplate.replace('{user_input}', userInput);

      return { system, user };
    }

    // 渲染示例
    let examplesText = '';
    if (template.examples && template.examples.length > 0) {
      examplesText = '\n\n示例：\n';
      for (const ex of template.examples) {
        examplesText += `- 输入: "${ex.input}"\n`;
        examplesText += `  输出: ${JSON.stringify(ex.output, null, 2)}\n`;
      }
    }

    const system = template.systemPrompt.replace('{capabilities}', capabilitiesList);
    const user = template.userPromptTemplate.replace('{user_input}', userInput) + examplesText;

    return { system, user };
  }

  // 渲染参数提取提示词
  renderParameterExtraction(
    intent: string,
    userInput: string,
    timeEntities?: Record<string, string>
  ): { system: string; user: string } {
    const template = this.templates.get('parameter_extraction');
    if (!template) {
      throw new Error('Template not found: parameter_extraction');
    }

    const timeEntitiesText = timeEntities
      ? Object.entries(timeEntities)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')
      : '无';

    const system = template.systemPrompt;
    const user = template.userPromptTemplate
      .replace('{intent}', intent)
      .replace('{user_input}', userInput)
      .replace('{time_entities}', timeEntitiesText);

    return { system, user };
  }

  // 渲染确认提示词
  renderConfirmation(
    userInput: string,
    intent: string,
    parameters: Record<string, unknown>,
    missingInfo: string[]
  ): { system: string; user: string } {
    const template = this.templates.get('confirmation');
    if (!template) {
      throw new Error('Template not found: confirmation');
    }

    const system = template.systemPrompt;
    const user = template.userPromptTemplate
      .replace('{user_input}', userInput)
      .replace('{intent}', intent)
      .replace('{parameters}', JSON.stringify(parameters, null, 2))
      .replace('{missing_info}', missingInfo.join(', ') || '无');

    return { system, user };
  }

  // 渲染上下文理解提示词
  renderContextualUnderstanding(
    confirmationQuestion: string,
    options: Array<{ id: string; label: string }>,
    userInput: string
  ): { system: string; user: string } {
    const template = this.templates.get('contextual_understanding');
    if (!template) {
      throw new Error('Template not found: contextual_understanding');
    }

    const optionsList = options
      .map((opt, i) => `- ${opt.id}: ${opt.label}`)
      .join('\n');

    const system = template.systemPrompt;
    const user = template.userPromptTemplate
      .replace('{confirmation_question}', confirmationQuestion)
      .replace('{options_list}', optionsList)
      .replace('{user_input}', userInput);

    return { system, user };
  }

  // 渲染指代词解析提示词
  renderReferenceResolution(
    userInput: string,
    recentMentions: MentionRecord[]
  ): { system: string; user: string } {
    const template = this.templates.get('reference_resolution');
    if (!template) {
      throw new Error('Template not found: reference_resolution');
    }

    // 生成近期操作记录列表
    const mentionsText = recentMentions.length > 0
      ? recentMentions
          .map((m, i) => `${i + 1}. [${m.operation}] ${m.title} (${m.time.toLocaleString()})`)
          .join('\n')
      : '（暂无近期操作记录）';

    const system = template.systemPrompt;
    const user = template.userPromptTemplate
      .replace('{user_input}', userInput)
      .replace('{recent_mentions}', mentionsText);

    return { system, user };
  }

  // 列出所有可用的提示词类型
  listPromptTypes(): PromptType[] {
    return Array.from(this.templates.keys());
  }
}
