// 测试文件 - NL Parser
import { NLParser } from '../src/parser/nl-parser';

describe('NLParser', () => {
  const parser = new NLParser();

  describe('parse', () => {
    it('should parse create task intent', () => {
      const result = parser.parse('帮我安排下周三下午3点开会');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('create');
      expect(result[0].entityType).toBe('event');
      expect(result[0].entity.title).toContain('开会');
    });

    it('should parse create recurring task intent', () => {
      const result = parser.parse('每两周提醒我做一次体检');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('create');
      expect(result[0].entity.is_recurring).toBe(true);
      expect(result[0].entity.recurrence_type).toBe('weekly');
    });

    it('should parse complete task intent', () => {
      const result = parser.parse('完成任务A');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('complete');
      expect(result[0].entity.status).toBe('completed');
    });

    it('should parse query intent', () => {
      const result = parser.parse('今天有什么安排？');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('query');
      expect(result[0].queryType).toBe('today_schedule');
    });

    it('should parse search intent', () => {
      const result = parser.parse('查找Q3的项目记录');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('search');
      expect(result[0].searchQuery).toContain('Q3');
    });
  });
});
