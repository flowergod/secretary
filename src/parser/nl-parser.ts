// 自然语言理解引擎
import { ParsedIntent, EntityType, Priority, RecurrenceType, TaskStatus } from '../shared/types';

interface ParseContext {
  text: string;
  lowerText: string;
  position: number;
}

// 时间表达式映射
const TIME_PATTERNS: Record<string, RegExp> = {
  time: /(\d{1,2})[点时:](\d{0,2})/,
  date: /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})|(下[周个]?[一二三四五六日天]|本?[周个]?[一二三四五六日天]|今天|明天|后天|昨天|前天)/,
  interval: /每([\d]+)?(天|周|月|年|个小时?|分钟?|小时|分钟)/,
  afterComplete: /完成后?|之后?|之后?(\d+)天/,
};

// 优先级映射
const PRIORITY_MAP: Record<string, Priority> = {
  '高': 'high',
  '高优先级': 'high',
  '重要': 'high',
  '紧急': 'high',
  '中': 'medium',
  '中优先级': 'medium',
  '普通': 'medium',
  '低': 'low',
  '低优先级': 'low',
  '不急': 'low',
};

// 动作词映射
const ACTION_MAP: Record<string, ParsedIntent['action']> = {
  '创建': 'create',
  '添加': 'create',
  '新增': 'create',
  '新建': 'create',
  '安排': 'create',
  '修改': 'update',
  '更新': 'update',
  '改': 'update',
  '调整': 'update',
  '删除': 'delete',
  '删': 'delete',
  '移除': 'delete',
  '完成': 'complete',
  '标记完成': 'complete',
  '搞定': 'complete',
  '查询': 'query',
  '查找': 'search',
  '搜索': 'search',
  '找': 'search',
  '看': 'query',
};

// 类型词映射
const TYPE_MAP: Record<string, EntityType> = {
  '任务': 'task',
  '待办': 'task',
  'todo': 'task',
  '会议': 'event',
  '日程': 'event',
  '约': 'event',
  '日历': 'event',
  '项目': 'project',
  '计划': 'project',
};

export class NLParser {
  /**
   * 解析用户输入，提取意图和实体
   */
  parse(input: string): ParsedIntent[] {
    const intents: ParsedIntent[] = [];
    const ctx = this.createContext(input);

    // 检测动作
    const action = this.detectAction(ctx);
    if (!action) {
      // 默认为查询
      intents.push(this.buildQueryIntent(ctx));
      return intents;
    }

    // 根据动作类型分别处理
    switch (action) {
      case 'create':
        intents.push(this.buildCreateIntent(ctx));
        break;
      case 'update':
        intents.push(this.buildUpdateIntent(ctx));
        break;
      case 'delete':
        intents.push(this.buildDeleteIntent(ctx));
        break;
      case 'complete':
        intents.push(this.buildCompleteIntent(ctx));
        break;
      case 'query':
      case 'search':
        intents.push(this.buildSearchIntent(ctx, action));
        break;
      default:
        intents.push(this.buildQueryIntent(ctx));
    }

    return intents;
  }

  private createContext(text: string): ParseContext {
    return {
      text,
      lowerText: text.toLowerCase(),
      position: 0,
    };
  }

  private detectAction(ctx: ParseContext): ParsedIntent['action'] | null {
    for (const [keyword, action] of Object.entries(ACTION_MAP)) {
      if (ctx.lowerText.includes(keyword)) {
        return action;
      }
    }
    return null;
  }

  private detectEntityType(ctx: ParseContext): EntityType {
    for (const [keyword, type] of Object.entries(TYPE_MAP)) {
      if (ctx.lowerText.includes(keyword)) {
        return type;
      }
    }
    // 默认根据上下文推断
    if (ctx.lowerText.includes('开会') || ctx.lowerText.includes('会议')) {
      return 'event';
    }
    if (ctx.lowerText.includes('项目') || ctx.lowerText.includes('规划')) {
      return 'project';
    }
    return 'task';
  }

  private detectPriority(ctx: ParseContext): Priority {
    for (const [keyword, priority] of Object.entries(PRIORITY_MAP)) {
      if (ctx.lowerText.includes(keyword)) {
        return priority;
      }
    }
    return 'medium';
  }

  private extractTitle(ctx: ParseContext): string {
    // 简单策略：移除动作词后剩余部分作为标题
    let title = ctx.text;

    // 移除常见前缀
    const prefixes = ['帮我', '请', '我想', '我要', '帮我把', '帮我安排', '创建', '添加', '新增'];
    for (const prefix of prefixes) {
      if (title.includes(prefix)) {
        title = title.replace(prefix, '').trim();
      }
    }

    // 移除时间表达式
    title = title.replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g, '');
    title = title.replace(/下[周个]?[一二三四五六日天]+/g, '');
    title = title.replace(/今天|明天|后天|昨天/g, '');

    return title.trim() || ctx.text;
  }

  private extractDate(ctx: ParseContext): string | undefined {
    const dateMatch = ctx.text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/);
    if (dateMatch) {
      return dateMatch[1].replace(/[/年]/g, '-');
    }

    // 相对日期
    if (ctx.lowerText.includes('今天')) {
      return new Date().toISOString().split('T')[0];
    }
    if (ctx.lowerText.includes('明天')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    if (ctx.lowerText.includes('后天')) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d.toISOString().split('T')[0];
    }
    if (ctx.lowerText.includes('下周三')) {
      const d = new Date();
      const daysUntilWed = (3 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilWed);
      return d.toISOString().split('T')[0];
    }

    return undefined;
  }

  private extractTime(ctx: ParseContext): string | undefined {
    const timeMatch = ctx.text.match(/(\d{1,2})[点时:](\d{0,2})/);
    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = timeMatch[2]?.padStart(2, '0') || '00';
      return `${hour}:${minute}`;
    }

    // 下午/上午
    if (ctx.lowerText.includes('下午') || ctx.lowerText.includes('晚上')) {
      const pmMatch = ctx.text.match(/下午(\d{1,2})/);
      if (pmMatch) {
        const hour = parseInt(pmMatch[1]) + 12;
        return `${hour}:00`;
      }
    }

    return undefined;
  }

  private extractRecurrence(ctx: ParseContext): { type: RecurrenceType; rule: Record<string, unknown> } | undefined {
    // 固定间隔循环
    const intervalMatch = ctx.lowerText.match(/每(\d+)?(天|周|月|年|个小时?|分钟?)/);
    if (intervalMatch) {
      const interval = intervalMatch[1] || '1';
      const unit = intervalMatch[2];
      let intervalStr = interval;
      if (unit.includes('天') && !unit.includes('个')) {
        intervalStr += ' days';
      } else if (unit.includes('周')) {
        intervalStr += ' weeks';
      } else if (unit.includes('月')) {
        intervalStr += ' months';
      } else if (unit.includes('年')) {
        intervalStr += ' years';
      } else if (unit.includes('小时') || unit.includes('个小时')) {
        intervalStr += ' hours';
      } else if (unit.includes('分钟') || unit.includes('分钟')) {
        intervalStr += ' minutes';
      }

      return {
        type: 'fixed_interval',
        rule: {
          type: 'fixed_interval',
          interval: intervalStr,
          start_from: new Date().toISOString().split('T')[0],
        },
      };
    }

    // 基于完成时间
    if (ctx.lowerText.includes('完成后') || ctx.lowerText.includes('之后') || ctx.lowerText.includes('看完')) {
      const daysMatch = ctx.lowerText.match(/(\d+)天/);
      const days = daysMatch ? parseInt(daysMatch[1]) : 90; // 默认90天
      return {
        type: 'after_complete',
        rule: {
          type: 'after_complete',
          days_after: days,
          reminder: true,
        },
      };
    }

    return undefined;
  }

  private detectNeedsExpansion(ctx: ParseContext): { needs: boolean; type: string | undefined } {
    // 检测是否需要智能拓展
    const expansionKeywords = ['完成后自动', '完成后规划', '做完'];
    for (const keyword of expansionKeywords) {
      if (ctx.lowerText.includes(keyword)) {
        return { needs: true, type: 'development_planning' };
      }
    }

    // 医疗类任务自动规划
    const medicalKeywords = ['医生', '体检', '复查', '检查'];
    for (const keyword of medicalKeywords) {
      if (ctx.lowerText.includes(keyword)) {
        return { needs: true, type: 'medical_followup' };
      }
    }

    return { needs: false, type: undefined };
  }

  private buildCreateIntent(ctx: ParseContext): ParsedIntent {
    const entityType = this.detectEntityType(ctx);
    const recurrence = this.extractRecurrence(ctx);
    const expansion = this.detectNeedsExpansion(ctx);

    return {
      action: 'create',
      entityType,
      entity: {
        type: entityType,
        title: this.extractTitle(ctx),
        priority: this.detectPriority(ctx),
        due_date: this.extractDate(ctx),
        start_date: this.extractDate(ctx),
        start_time: this.extractTime(ctx),
        is_recurring: !!recurrence,
        recurrence_type: recurrence?.type,
        recurrence_rule: recurrence?.rule as Record<string, unknown>,
        status: 'pending' as TaskStatus,
        needs_expansion: expansion.needs,
        expansion_type: expansion.type,
      },
      needsExpansion: expansion.needs,
      expansionType: expansion.type,
    };
  }

  private buildUpdateIntent(ctx: ParseContext): ParsedIntent {
    return {
      action: 'update',
      entityType: this.detectEntityType(ctx),
      entity: {
        due_date: this.extractDate(ctx),
        start_date: this.extractDate(ctx),
        start_time: this.extractTime(ctx),
        priority: this.detectPriority(ctx),
      },
    };
  }

  private buildDeleteIntent(ctx: ParseContext): ParsedIntent {
    return {
      action: 'delete',
      entityType: this.detectEntityType(ctx),
      entity: {},
    };
  }

  private buildCompleteIntent(ctx: ParseContext): ParsedIntent {
    // 尝试提取任务名称
    const title = this.extractTitle(ctx);
    return {
      action: 'complete',
      entityType: 'task',
      entity: {
        title,
        status: 'completed',
        completion_date: new Date().toISOString(),
      },
    };
  }

  private buildQueryIntent(ctx: ParseContext): ParsedIntent {
    let queryType = 'today_schedule';
    if (ctx.lowerText.includes('今天')) {
      queryType = 'today_schedule';
    } else if (ctx.lowerText.includes('明天')) {
      queryType = 'tomorrow_schedule';
    } else if (ctx.lowerText.includes('本周') || ctx.lowerText.includes('这周')) {
      queryType = 'week_schedule';
    } else if (ctx.lowerText.includes('下周')) {
      queryType = 'next_week_schedule';
    }

    return {
      action: 'query',
      entityType: 'task',
      entity: {},
      queryType,
    };
  }

  private buildSearchIntent(ctx: ParseContext, action: ParsedIntent['action']): ParsedIntent {
    const searchQuery = ctx.text
      .replace(/查找|搜索|找/g, '')
      .trim();

    return {
      action,
      entityType: 'task',
      entity: {},
      searchQuery,
    };
  }
}

export const nlParser = new NLParser();
