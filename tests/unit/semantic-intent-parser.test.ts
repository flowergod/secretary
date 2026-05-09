// Semantic IntentParser Unit Tests
// Tests intent parsing and classification logic

import { IntentParser } from '../../src/semantic/intent-parser';
import { Capability, IntentType } from '../../src/semantic/types';

describe('IntentParser', () => {
  // Mock capabilities for testing
  const mockCapabilities: Capability[] = [
    {
      id: 'task.create',
      name: '创建任务',
      intent: IntentType.CREATE_TASK,
      requiredParams: ['title'],
      optionalParams: ['description', 'priority', 'category', 'due_date'],
      description: '创建新任务',
      examples: ['创建任务', '添加待办'],
    },
    {
      id: 'task.query',
      name: '查询任务',
      intent: IntentType.QUERY_TASKS,
      requiredParams: [],
      optionalParams: ['status', 'date'],
      description: '查询任务列表',
      examples: ['查看任务', '我的任务'],
    },
    {
      id: 'event.query',
      name: '查询日程',
      intent: IntentType.QUERY_EVENTS,
      requiredParams: [],
      optionalParams: ['date', 'start_date'],
      description: '查询日程',
      examples: ['今日日程', '明天安排'],
    },
  ];

  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser(mockCapabilities);
  });

  describe('parseIntentClassification', () => {
    it('should parse valid LLM output', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试任务' },
        confidence: 0.95,
        needsConfirmation: false,
        reasoning: '创建任务的明确意图',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建测试任务');

      expect(result.intent.intent).toBe(IntentType.CREATE_TASK);
      expect(result.intent.confidence).toBe(0.95);
      expect(result.intent.needsConfirmation).toBe(false);
      expect(result.missingParams).toEqual([]);
    });

    it('should detect missing required params', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: {},
        confidence: 0.6,
        needsConfirmation: false,
        reasoning: '意图不明确',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建任务');

      expect(result.intent.needsConfirmation).toBe(true);
      expect(result.missingParams).toContain('title');
    });

    it('should mark low confidence as needing confirmation', () => {
      const llmOutput = {
        intent: 'other',
        entity_type: 'task',
        parameters: { title: '测试' },
        confidence: 0.3,
        needsConfirmation: false,
        reasoning: '意图不明确',
      };

      const result = parser.parseIntentClassification(llmOutput, '随便');

      expect(result.intent.needsConfirmation).toBe(true);
      expect(result.intent.lowConfidence).toBe(true);
    });

    it('should handle invalid output with default result', () => {
      const invalidOutput = { invalid: 'data' };
      const result = parser.parseIntentClassification(invalidOutput as any, '测试');

      expect(result.intent.intent).toBe(IntentType.OTHER);
      expect(result.intent.confidence).toBe(0);
      expect(result.intent.needsConfirmation).toBe(true);
    });

    it('should map intent strings to enum values', () => {
      const llmOutput = {
        intent: 'query_events',
        entity_type: 'calendar',
        parameters: { date: 'today' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '查询日程',
      };

      const result = parser.parseIntentClassification(llmOutput, '今天有什么安排');

      expect(result.intent.intent).toBe(IntentType.QUERY_EVENTS);
      // ENTITY_TYPE_MAP maps 'calendar' to 'calendar'
      expect(result.intent.entityType).toBe('calendar');
    });

    it('should map unknown intent to OTHER', () => {
      const llmOutput = {
        intent: 'unknown_intent',
        entity_type: 'task',
        parameters: {},
        confidence: 0.5,
        needsConfirmation: false,
        reasoning: '无法识别',
      };

      const result = parser.parseIntentClassification(llmOutput, '测试');

      expect(result.intent.intent).toBe(IntentType.OTHER);
    });
  });

  describe('normalizeStatus', () => {
    it('should normalize Chinese status values', () => {
      const llmOutput = {
        intent: 'update_task',
        entity_type: 'task',
        parameters: { title: '测试', status: '待办' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '更新任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '更新测试任务');

      expect(result.intent.parameters.status).toBe('pending');
    });

    it('should normalize completed status', () => {
      const llmOutput = {
        intent: 'update_task',
        entity_type: 'task',
        parameters: { title: '测试', status: '已完成' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '更新任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '更新测试任务');

      expect(result.intent.parameters.status).toBe('completed');
    });

    it('should keep English status as-is', () => {
      const llmOutput = {
        intent: 'update_task',
        entity_type: 'task',
        parameters: { title: '测试', status: 'in_progress' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '更新任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '更新测试任务');

      expect(result.intent.parameters.status).toBe('in_progress');
    });
  });

  describe('normalizePriority', () => {
    it('should normalize Chinese priority values', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试', priority: '高' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建高优先级任务');

      expect(result.intent.parameters.priority).toBe('high');
    });

    it('should normalize medium priority', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试', priority: '中' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建中优先级任务');

      expect(result.intent.parameters.priority).toBe('medium');
    });

    it('should normalize low priority', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试', priority: '低' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建低优先级任务');

      expect(result.intent.parameters.priority).toBe('low');
    });
  });

  describe('isValidIntentOutput', () => {
    it('should validate correct output', () => {
      const validOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试' },
        confidence: 0.9,
      };

      // Access via parseIntentClassification behavior
      const result = parser.parseIntentClassification(validOutput, '测试');
      expect(result.intent.intent).toBe(IntentType.CREATE_TASK);
    });

    it('should reject output without intent field', () => {
      const invalidOutput = {
        entity_type: 'task',
        parameters: {},
        confidence: 0.9,
      };

      const result = parser.parseIntentClassification(invalidOutput as any, '测试');

      expect(result.intent.intent).toBe(IntentType.OTHER);
    });

    it('should reject output without entity_type field', () => {
      const invalidOutput = {
        intent: 'create_task',
        parameters: {},
        confidence: 0.9,
      };

      const result = parser.parseIntentClassification(invalidOutput as any, '测试');

      expect(result.intent.intent).toBe(IntentType.OTHER);
    });

    it('should reject output with non-numeric confidence', () => {
      const invalidOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: {},
        confidence: 'high',
      };

      const result = parser.parseIntentClassification(invalidOutput as any, '测试');

      expect(result.intent.intent).toBe(IntentType.OTHER);
    });
  });

  describe('validateParameters', () => {
    it('should return empty array when all required params present', () => {
      const params = { title: '测试任务' };

      const result = parser.validateParameters(IntentType.CREATE_TASK, params);

      expect(result).toEqual([]);
    });

    it('should return missing params when required params absent', () => {
      const params = {};

      const result = parser.validateParameters(IntentType.CREATE_TASK, params);

      expect(result).toContain('title');
    });

    it('should return error for unknown intent type', () => {
      const params = {};

      const result = parser.validateParameters('unknown' as IntentType, params);

      expect(result).toContain('未知意图类型');
    });

    it('should return empty for intent with no required params', () => {
      const params = {};

      const result = parser.validateParameters(IntentType.QUERY_TASKS, params);

      expect(result).toEqual([]);
    });
  });

  describe('getCapabilityForIntent', () => {
    it('should return matching capability', () => {
      const capability = parser.getCapabilityForIntent(IntentType.CREATE_TASK);

      expect(capability).toBeDefined();
      expect(capability?.id).toBe('task.create');
    });

    it('should return undefined for unknown intent', () => {
      const capability = parser.getCapabilityForIntent(IntentType.OTHER);

      expect(capability).toBeUndefined();
    });

    it('should return correct capability name', () => {
      const capability = parser.getCapabilityForIntent(IntentType.QUERY_EVENTS);

      expect(capability?.name).toBe('查询日程');
    });
  });

  describe('parameter normalization via parseIntentClassification', () => {
    it('should handle is_recurring as true string', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '每周开会', is_recurring: 'true' },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建循环任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建每周开会');

      expect(result.intent.parameters.is_recurring).toBe(true);
    });

    it('should handle is_recurring as boolean true', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '每周开会', is_recurring: true },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建循环任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建每周开会');

      expect(result.intent.parameters.is_recurring).toBe(true);
    });

    it('should preserve null/undefined values', () => {
      const llmOutput = {
        intent: 'create_task',
        entity_type: 'task',
        parameters: { title: '测试', description: null },
        confidence: 0.9,
        needsConfirmation: false,
        reasoning: '创建任务',
      };

      const result = parser.parseIntentClassification(llmOutput, '创建测试');

      expect(result.intent.parameters.description).toBeUndefined();
    });
  });
});

describe('IntentParser Edge Cases', () => {
  const mockCapabilities: Capability[] = [
    {
      id: 'task.create',
      name: '创建任务',
      intent: IntentType.CREATE_TASK,
      requiredParams: ['title'],
      optionalParams: ['start_date', 'start_time'],
      description: '创建新任务',
      examples: ['创建任务'],
    },
  ];

  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser(mockCapabilities);
  });

  it('should store rawInput in parsed intent', () => {
    const llmOutput = {
      intent: 'create_task',
      entity_type: 'task',
      parameters: { title: '测试' },
      confidence: 0.9,
      needsConfirmation: false,
      reasoning: '创建任务',
    };

    const rawInput = '这是一个原始输入';
    const result = parser.parseIntentClassification(llmOutput, rawInput);

    expect(result.intent.rawInput).toBe(rawInput);
  });

  it('should store reasoning in parsed intent', () => {
    const llmOutput = {
      intent: 'create_task',
      entity_type: 'task',
      parameters: { title: '测试' },
      confidence: 0.9,
      needsConfirmation: false,
      reasoning: '这是推理过程',
    };

    const result = parser.parseIntentClassification(llmOutput, '测试');

    expect(result.intent.reasoning).toBe('这是推理过程');
  });

  it('should handle missing parameters object', () => {
    const llmOutput = {
      intent: 'create_task',
      entity_type: 'task',
      parameters: undefined,
      confidence: 0.9,
      needsConfirmation: false,
      reasoning: '创建任务',
    };

    const result = parser.parseIntentClassification(llmOutput, '测试');

    // Should not throw and should have empty parameters
    expect(result.intent.parameters).toBeDefined();
  });
});
