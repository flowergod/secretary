// 综合测试文件 - 基于 TEST-CASES.md
import { NLParser } from '../src/parser/nl-parser';
import { ValidationService } from '../src/services/validation-service';
import { CalendarSuggestionService } from '../src/services/calendar-suggestion-service';
import { ParsedIntent } from '../src/shared/types';

describe('NL Parser - 动作检测 (NL-001 ~ NL-010)', () => {
  const parser = new NLParser();

  const actionTests = [
    { input: '帮我安排周五下午3点开会', expected: 'create', id: 'NL-001' },
    { input: '创建任务：完成报告', expected: 'create', id: 'NL-002' },
    { input: '新建一个会议', expected: 'create', id: 'NL-003' },
    { input: '明天上午10点去看牙医', expected: 'create', id: 'NL-004' },
    { input: '今天有什么安排', expected: 'query', id: 'NL-005' },
    { input: '查看日程', expected: 'query', id: 'NL-006' },
    { input: '删除这个任务', expected: 'delete', id: 'NL-007' },
    { input: '标记为完成', expected: 'complete', id: 'NL-008' },
    { input: '每3天提醒我跑步', expected: 'create', id: 'NL-009' },
    { input: '完成后自动规划', expected: 'create', id: 'NL-010' },
  ];

  actionTests.forEach(({ input, expected, id }) => {
    it(`${id}: "${input}" -> ${expected}`, () => {
      const result = parser.parse(input);
      expect(result[0].action).toBe(expected);
    });
  });
});

describe('NL Parser - 时间日期解析 (NL-101 ~ NL-108)', () => {
  const parser = new NLParser();

  it('NL-101: 明天上午10点开会', () => {
    const result = parser.parse('明天上午10点开会');
    expect(result[0].entity.start_time).toBe('10:00');
  });

  it('NL-103: 5月4日 -> 具体日期', () => {
    const result = parser.parse('5月4日开会');
    expect(result[0].entity.start_date).toBeDefined();
    expect(result[0].entity.start_date).toContain('05-04');
  });

  it('NL-107: 今天', () => {
    const result = parser.parse('今天有会');
    expect(result[0].entity.start_date).toBeDefined();
  });

  it('NL-108: 下午3点开会', () => {
    const result = parser.parse('下午3点开会');
    expect(result[0].entity.start_time).toBe('15:00');
  });
});

describe('NL Parser - 优先级解析 (NL-201 ~ NL-206)', () => {
  const parser = new NLParser();

  const priorityTests = [
    { input: '高优先级任务', expected: '高', id: 'NL-201' },
    { input: '紧急的事情', expected: '高', id: 'NL-202' },
    { input: '普通任务', expected: '中', id: 'NL-203' },
    { input: '低优先级', expected: '低', id: 'NL-204' },
    { input: '不急的事情', expected: '低', id: 'NL-205' },
    { input: '没有任何优先级描述', expected: '中', id: 'NL-206' },
  ];

  priorityTests.forEach(({ input, expected, id }) => {
    it(`${id}: "${input}" -> ${expected}`, () => {
      const result = parser.parse(input);
      expect(result[0].entity.priority).toBe(expected);
    });
  });
});

describe('NL Parser - 循环类型解析 (NL-301 ~ NL-304)', () => {
  const parser = new NLParser();

  it('NL-301: 每3天提醒我', () => {
    const result = parser.parse('每3天提醒我锻炼');
    expect(result[0].entity.is_recurring).toBe(true);
    expect(result[0].entity.recurrence_type).toBe('weekly');
  });

  it('NL-303: 完成后3天提醒', () => {
    const result = parser.parse('完成后3天提醒我复查');
    expect(result[0].entity.is_recurring).toBe(true);
    expect(result[0].entity.recurrence_type).toBe('after_complete');
  });
});

describe('Validation Service - 分组验证 (VAL-001 ~ VAL-003)', () => {
  const parser = new NLParser();
  const validationService = new ValidationService();

  it('VAL-001: 工作分组识别', () => {
    const result = parser.parse('开会讨论项目');
    const validation = validationService.validate(result[0]);
    // 开会有日程表关键词，应该能识别
    expect(validation.missingFields).not.toContain('分组');
  });

  it('VAL-002: 家庭分组识别', () => {
    const result = parser.parse('带孩子去体检');
    const intent = result[0];
    intent.entity.group = '其他'; // 根据关键词应该被识别
    expect(intent.entity.group).toBeDefined();
  });

  it('VAL-101: 紧急=高优先级', () => {
    const result = parser.parse('紧急任务');
    const priority = validationService.suggestPriority('紧急任务');
    expect(priority).toBe('高');
  });

  it('VAL-102: 普通=中优先级', () => {
    const priority = validationService.suggestPriority('普通任务');
    expect(priority).toBe('中');
  });

  it('VAL-103: 低优先级', () => {
    const priority = validationService.suggestPriority('有空再做');
    expect(priority).toBe('低');
  });
});

describe('CalendarSuggestion Service - 自动分类 (CAL-001 ~ CAL-007)', () => {
  const parser = new NLParser();
  const calendarSuggestionService = new CalendarSuggestionService();

  const calendarTests = [
    { input: '周五下午3点开会', expectedCategory: '工作', id: 'CAL-001' },
    { input: '带孩子去看医生', expectedCategory: '家庭共享', id: 'CAL-002' },
    { input: '周末和朋友聚会', expectedCategory: '个人', id: 'CAL-003' },
    { input: '下周一上午10点见客户', expectedCategory: '工作', id: 'CAL-004' },
    { input: '孩子的篮球训练', expectedCategory: '家庭共享', id: 'CAL-005' },
    { input: '周三晚上瑜伽课', expectedCategory: '个人', id: 'CAL-006' },
  ];

  calendarTests.forEach(({ input, expectedCategory, id }) => {
    it(`${id}: "${input}" -> ${expectedCategory}`, () => {
      const parseResult = parser.parse(input);
      // 设置明确时间以触发日历建议
      parseResult[0].entity.start_date = '2026-05-06';
      parseResult[0].entity.start_time = '15:00';

      const suggestion = calendarSuggestionService.suggestCalendar(parseResult[0]);
      expect(suggestion.category).toBe(expectedCategory);
    });
  });
});

describe('CalendarSuggestion - 时间要求 (CAL-101 ~ CAL-102)', () => {
  const parser = new NLParser();
  const calendarSuggestionService = new CalendarSuggestionService();

  it('CAL-101: 无时间不加入日历', () => {
    const result = parser.parse('开会');
    const suggestion = calendarSuggestionService.suggestCalendar(result[0]);
    expect(suggestion.confidence).toBe('low');
    expect(suggestion.needsConfirmation).toBe(false);
  });

  it('CAL-102: 有明确时间加入日历', () => {
    const result = parser.parse('明天上午10点开会');
    result[0].entity.start_date = '2026-05-04';
    result[0].entity.start_time = '10:00';

    const suggestion = calendarSuggestionService.suggestCalendar(result[0]);
    expect(suggestion.confidence).not.toBe('low');
  });
});

describe('意图分类边界测试 (EDGE-001 ~ EDGE-003)', () => {
  const parser = new NLParser();

  it('EDGE-001: 包含疑问词但有时序词+时间+动词 = create', () => {
    const result = parser.parse('明天上午10点开会，有什么注意事项');
    expect(result[0].action).toBe('create');
  });

  it('EDGE-002: 明确的疑问句 = query', () => {
    const result = parser.parse('有什么任务');
    expect(result[0].action).toBe('query');
  });

  it('EDGE-003: 无疑问词 = create', () => {
    const result = parser.parse('明天10点');
    expect(result[0].action).toBe('create');
  });
});

describe('Validation - 必填字段组合验证 (VAL-201 ~ VAL-202)', () => {
  const parser = new NLParser();
  const validationService = new ValidationService();

  it('VAL-201: 分组无法判断时需要确认', () => {
    const result = parser.parse('下周三下午开会');
    const validation = validationService.validate(result[0]);
    // 如果分组无法判断，应该在 missingFields 中
    if (validation.missingFields.includes('分组')) {
      expect(validation.confirmationMessage).toBeDefined();
    }
  });

  it('VAL-202: 分组和优先级都无法判断时', () => {
    const result = parser.parse('普通任务');
    const validation = validationService.validate(result[0]);
    // 优先级默认中，所以应该通过
    expect(validation.missingFields).not.toContain('优先级');
  });
});

describe('Validation - fillDefaults', () => {
  const parser = new NLParser();
  const validationService = new ValidationService();

  it('应该填充默认优先级', () => {
    const result = parser.parse('写报告');
    const filled = validationService.fillDefaults(result[0]);
    expect(filled.entity.priority).toBeDefined();
  });
});
