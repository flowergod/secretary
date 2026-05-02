// 必填字段验证服务
import { ParsedIntent } from '../shared/types';

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  confirmationMessage?: string;
}

const GROUP_KEYWORDS: Record<string, string[]> = {
  '工作': ['工作', '开会', '会议', '项目', '客户', '商务', '谈判', '面试', '报告', '述职', '汇报'],
  '日程表': ['日程', '日历', '约', '会议'],
  '其他': [],
};

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  '高': ['紧急', '重要', '高优先级', '必须', '急需'],
  '中': ['普通', '中优先级', '正常'],
  '低': ['低优先级', '不急', '有空再'],
};

export class ValidationService {
  /**
   * 验证必填字段，如果无法判断，返回需要确认的信息
   */
  validate(intent: ParsedIntent): ValidationResult {
    const missingFields: string[] = [];
    const text = (intent.entity.title || '') + ' ' + (intent.entity.description || '');

    // 验证分组
    if (!intent.entity.group) {
      const suggestedGroup = this.suggestGroup(text);
      if (suggestedGroup) {
        // AI 可以判断
      } else {
        missingFields.push('分组');
      }
    }

    // 验证优先级
    if (!intent.entity.priority) {
      missingFields.push('优先级');
    }

    if (missingFields.length > 0) {
      const messages: string[] = [];

      if (missingFields.includes('分组')) {
        messages.push('属于哪个分组（工作/日程表/其他）？');
      }
      if (missingFields.includes('优先级')) {
        messages.push('优先级是高/中/低？');
      }

      return {
        isValid: false,
        missingFields,
        confirmationMessage: `「${intent.entity.title}」请确认：${messages.join('、')}。`,
      };
    }

    return { isValid: true, missingFields: [] };
  }

  /**
   * AI 判断分组
   */
  private suggestGroup(text: string): string | null {
    const lowerText = text.toLowerCase();

    for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        return group;
      }
    }

    return null;
  }

  /**
   * AI 判断优先级
   */
  suggestPriority(text: string): string {
    const lowerText = text.toLowerCase();

    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        return priority;
      }
    }

    return '中'; // 默认中优先级
  }

  /**
   * 填充缺失的必填字段默认值
   */
  fillDefaults(intent: ParsedIntent): ParsedIntent {
    const text = (intent.entity.title || '') + ' ' + (intent.entity.description || '');

    if (!intent.entity.priority) {
      intent.entity.priority = this.suggestPriority(text) as any;
    }

    // 分组由上层业务逻辑判断，这里不做默认填充

    return intent;
  }
}

export const validationService = new ValidationService();
