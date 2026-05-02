// 日历分类建议服务
import { ParsedIntent } from '../shared/types';

interface CalendarSuggestion {
  category: string;           // 建议的日历分类
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  needsConfirmation: boolean;  // 是否需要用户确认
}

const WORK_KEYWORDS = ['工作', '开会', '会议', '项目', '客户', '商务', '谈判', '面试', '报告', '述职', '汇报'];
const FAMILY_KEYWORDS = ['家庭', '孩子', '笑笑', '妙妙', '家人', '亲戚', '聚餐', '父母', '爸妈', '看医生', '体检', '复查', '学校', '班级', '篮球', '足球', '游泳', '课外', '课'];
const PERSONAL_KEYWORDS = ['个人', '自己', '学习', '读书', '运动', '健身', '跑步', '瑜伽', '朋友', '聚会', '约'];

export class CalendarSuggestionService {
  /**
   * 分析任务内容，建议日历分类
   */
  suggestCalendar(intent: ParsedIntent): CalendarSuggestion {
    const title = intent.entity.title || '';
    const description = intent.entity.description || '';
    const text = title + ' ' + description;

    // 1. 检查是否有明确的时间信息（有明确时间才建议加入日历）
    const hasExplicitTime = !!(intent.entity.start_date && intent.entity.start_time);
    if (!hasExplicitTime) {
      return {
        category: '',
        confidence: 'low',
        reason: '没有明确时间，不加入日历',
        needsConfirmation: false,
      };
    }

    // 2. 关键词匹配判断日历分类
    const workScore = WORK_KEYWORDS.filter(k => text.includes(k)).length;
    const familyScore = FAMILY_KEYWORDS.filter(k => text.includes(k)).length;
    const personalScore = PERSONAL_KEYWORDS.filter(k => text.includes(k)).length;

    // 3. 综合判断
    if (workScore > 0 && workScore >= familyScore && workScore >= personalScore) {
      return {
        category: '工作',
        confidence: 'high',
        reason: `检测到工作相关关键词: ${WORK_KEYWORDS.filter(k => text.includes(k)).join(', ')}`,
        needsConfirmation: false,
      };
    }

    if (familyScore > 0 && familyScore >= workScore && familyScore >= personalScore) {
      return {
        category: '家庭共享',
        confidence: 'high',
        reason: `检测到家庭相关关键词: ${FAMILY_KEYWORDS.filter(k => text.includes(k)).join(', ')}`,
        needsConfirmation: false,
      };
    }

    if (personalScore > 0 && personalScore > workScore && personalScore > familyScore) {
      return {
        category: '个人',
        confidence: 'medium',
        reason: `检测到个人相关关键词: ${PERSONAL_KEYWORDS.filter(k => text.includes(k)).join(', ')}`,
        needsConfirmation: false,
      };
    }

    // 4. 无法明确判断，返回最低建议，需要用户确认
    return {
      category: '个人',  // 默认个人
      confidence: 'low',
      reason: '无法明确判断日历分类，已默认选择「个人」',
      needsConfirmation: true,
    };
  }

  /**
   * 生成确认问题
   */
  askForConfirmation(suggestion: CalendarSuggestion): string {
    if (!suggestion.needsConfirmation) {
      return '';
    }
    return `这个事项「${suggestion.category === '个人' ? '个人' : suggestion.category === '工作' ? '工作' : '家庭共享'}」日历比较合适，我已将其加入${suggestion.category}日历。如果不对请告诉我。`;
  }
}

export const calendarSuggestionService = new CalendarSuggestionService();
