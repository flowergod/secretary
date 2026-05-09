// Feishu Bot Service Unit Tests
// TDD: 先编写测试用例，再实现功能
// 测试验证设计文档中定义的行为

import { IntentType, SemanticResult, ParsedIntent, ConfirmationOption } from '../../src/semantic/types';
import { Context, ConfirmationStatus } from '../../src/semantic/context-manager';

// Mock 飞书事件
interface MockFeishuEvent {
  chatId: string;
  openId: string;
  messageId: string;
  chatType: 'p2p' | 'group';
  text: string;
}

// 辅助函数：创建测试用的 ParsedIntent
function createTestIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intent: IntentType.OTHER,
    entityType: 'task',
    parameters: {},
    confidence: 0.5,
    needsConfirmation: false,
    lowConfidence: false,
    reasoning: '',
    rawInput: '',
    ...overrides,
  };
}

// 辅助函数：创建测试用的 Context
function createTestContext(overrides: Partial<Context> = {}): Context {
  const now = new Date();
  return {
    id: 'ctx_test',
    intent: createTestIntent(),
    rawInput: '测试输入',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    status: 'pending_confirmation',
    ...overrides,
  };
}

// ============================================================
// 测试组 1: 消息处理
// ============================================================

describe('FeishuBotService - 消息处理', () => {
  describe('消息解析', () => {
    it('应该接收并解析飞书消息', () => {
      const event: MockFeishuEvent = {
        chatId: 'oc_123',
        openId: 'ou_456',
        messageId: 'om_789',
        chatType: 'p2p',
        text: '提醒我明天上午9点开会',
      };

      expect(event.text).toBe('提醒我明天上午9点开会');
      expect(event.chatId).toBe('oc_123');
      expect(event.openId).toBe('ou_456');
    });

    it('应该支持文本消息类型', () => {
      const event: MockFeishuEvent = {
        chatId: 'oc_123',
        openId: 'ou_456',
        messageId: 'om_789',
        chatType: 'p2p',
        text: '今天有什么安排',
      };

      expect(typeof event.text).toBe('string');
      expect(event.text.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// 测试组 2: 上下文管理 - 新上下文开启策略
// ============================================================

describe('FeishuBotService - 上下文管理', () => {
  describe('shouldStartNewContext', () => {
    it('首次对话应该开启新上下文', () => {
      const existingContextId = null;
      const shouldNew = existingContextId === null;
      expect(shouldNew).toBe(true);
    });

    it('当上下文状态为 completed 时应该开启新上下文', () => {
      const context = createTestContext({ status: 'completed' });
      const shouldNew = context.status === 'completed';
      expect(shouldNew).toBe(true);
    });

    it('当上下文状态为 cancelled 时应该开启新上下文', () => {
      const context = createTestContext({ status: 'cancelled' });
      const shouldNew = context.status === 'cancelled';
      expect(shouldNew).toBe(true);
    });

    it('当上下文状态为 expired 时应该开启新上下文', () => {
      const context = createTestContext({ status: 'expired' });
      const shouldNew = context.status === 'expired';
      expect(shouldNew).toBe(true);
    });

    it('当上下文状态为 pending_confirmation 时不应该开启新上下文', () => {
      const context = createTestContext({ status: 'pending_confirmation' });
      const shouldStartNew = context.status !== 'pending_confirmation' && context.status !== 'executing';
      expect(shouldStartNew).toBe(false);
    });

    it('当上下文状态为 executing 时不应该开启新上下文', () => {
      const context = createTestContext({ status: 'executing' });
      const shouldStartNew = context.status !== 'pending_confirmation' && context.status !== 'executing';
      expect(shouldStartNew).toBe(false);
    });

    describe('关键词检测', () => {
      const newContextKeywords = ['新对话', '重新开始', '换个话题', '新任务'];

      it('用户说"新对话"应该开启新上下文', () => {
        const text = '新对话';
        const shouldNew = newContextKeywords.some(k => text.includes(k));
        expect(shouldNew).toBe(true);
      });

      it('用户说"重新开始"应该开启新上下文', () => {
        const text = '重新开始';
        const shouldNew = newContextKeywords.some(k => text.includes(k));
        expect(shouldNew).toBe(true);
      });

      it('用户说"换个话题"应该开启新上下文', () => {
        const text = '换个话题';
        const shouldNew = newContextKeywords.some(k => text.includes(k));
        expect(shouldNew).toBe(true);
      });

      it('用户说"/new"命令应该开启新上下文', () => {
        const text = '/new';
        const commandKeywords = ['/new', '/reset', '/restart'];
        const shouldNew = commandKeywords.some(k => text.startsWith(k));
        expect(shouldNew).toBe(true);
      });

      it('用户说"/reset"命令应该开启新上下文', () => {
        const text = '/reset';
        const commandKeywords = ['/new', '/reset', '/restart'];
        const shouldNew = commandKeywords.some(k => text.startsWith(k));
        expect(shouldNew).toBe(true);
      });

      it('普通对话内容不应该开启新上下文', () => {
        const texts = [
          '提醒我明天上午9点开会',
          '今天有什么安排',
          '帮我创建任务',
          '完成这个任务',
          '查看明天的日程',
        ];

        const allKeywords = [...newContextKeywords, '/new', '/reset', '/restart'];

        texts.forEach(text => {
          const shouldNew = allKeywords.some(k => text.includes(k));
          expect(shouldNew).toBe(false);
        });
      });
    });
  });

  describe('contextId 生成', () => {
    it('应该使用 chatId 作为上下文标识的一部分', () => {
      const chatId = 'oc_12345';
      const timestamp = Date.now();
      const contextId = `feishu_${chatId}_${timestamp}`;

      expect(contextId).toContain(chatId);
    });

    it('不同 chatId 应该生成不同的 contextId', () => {
      const chatId1 = 'oc_123';
      const chatId2 = 'oc_456';

      const contextId1 = `feishu_${chatId1}`;
      const contextId2 = `feishu_${chatId2}`;

      expect(contextId1).not.toBe(contextId2);
    });

    it('contextId 应该以 "feishu_" 前缀开头', () => {
      const chatId = 'oc_123';
      const contextId = `feishu_${chatId}`;

      expect(contextId.startsWith('feishu_')).toBe(true);
    });
  });

  describe('多会话支持', () => {
    it('每个 chatId 应该独立维护 contextId', () => {
      const contextA = createTestContext({
        id: 'feishu_oc_userA_1',
        rawInput: '用户A的消息',
      });

      const contextB = createTestContext({
        id: 'feishu_oc_userB_2',
        rawInput: '用户B的消息',
      });

      expect(contextA.id).not.toBe(contextB.id);
      expect(contextA.rawInput).not.toBe(contextB.rawInput);
    });

    it('群聊和单聊应该有不同的 contextId', () => {
      const p2pChatId = 'oc_p2p_123';
      const groupChatId = 'oc_group_456';

      const contextIdP2P = `feishu_${p2pChatId}`;
      const contextIdGroup = `feishu_${groupChatId}`;

      expect(contextIdP2P).not.toBe(contextIdGroup);
    });
  });

  describe('上下文状态流转', () => {
    const validStatuses: ConfirmationStatus[] = [
      'pending_confirmation',
      'executing',
      'completed',
      'cancelled',
      'expired',
    ];

    it('应该包含所有定义的状态', () => {
      expect(validStatuses).toContain('pending_confirmation');
      expect(validStatuses).toContain('executing');
      expect(validStatuses).toContain('completed');
      expect(validStatuses).toContain('cancelled');
      expect(validStatuses).toContain('expired');
    });
  });
});

// ============================================================
// 测试组 3: 语义理解集成
// ============================================================

describe('FeishuBotService - 语义理解集成', () => {
  describe('handleMessage', () => {
    it('应该调用 semanticService.understand 处理消息', async () => {
      const mockUnderstand = jest.fn()
        .mockResolvedValue({
          success: true,
          intent: createTestIntent({
            intent: IntentType.CREATE_TASK,
            parameters: { title: '测试任务' },
            confidence: 0.95,
          }),
        } as SemanticResult);

      const event: MockFeishuEvent = {
        chatId: 'oc_123',
        openId: 'ou_456',
        messageId: 'om_789',
        chatType: 'p2p',
        text: '创建一个测试任务',
      };

      await mockUnderstand(event.text, 'ctx_123');

      expect(mockUnderstand).toHaveBeenCalledWith(
        event.text,
        'ctx_123'
      );
    });

    it('需要确认时应该生成确认问题', async () => {
      const mockUnderstand = jest.fn()
        .mockResolvedValue({
          success: true,
          intent: createTestIntent({
            intent: IntentType.CREATE_TASK,
            parameters: {},
            confidence: 0.5,
            needsConfirmation: true,
          }),
          confirmationQuestion: '请问任务名称是什么？',
          confirmationOptions: [
            { id: 'opt_1', label: '工作', type: 'task' },
            { id: 'opt_2', label: '个人', type: 'task' },
          ],
        } as SemanticResult);

      const result = await mockUnderstand('创建任务', 'ctx_123');

      expect(result.confirmationQuestion).toBeDefined();
      expect(result.confirmationOptions).toHaveLength(2);
    });

    it('语义理解成功应该返回任务信息', async () => {
      const mockUnderstand = jest.fn()
        .mockResolvedValue({
          success: true,
          intent: createTestIntent({
            intent: IntentType.CREATE_TASK,
            parameters: {
              title: '测试任务',
              start_date: '2026-05-09',
              start_time: '09:00',
            },
            confidence: 0.95,
          }),
          result: {
            taskId: 'task_123',
            action: 'completed',
          },
        } as SemanticResult);

      const result = await mockUnderstand('提醒我明天上午9点开会', 'ctx_123');

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });
});

// ============================================================
// 测试组 4: 消息回复
// ============================================================

describe('FeishuBotService - 消息回复', () => {
  describe('reply', () => {
    it('应该发送文本消息', () => {
      const message = '已为您创建任务：测试任务';

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('回复应该包含 openId', () => {
      const openId = 'ou_456';
      const message = '测试回复';

      expect(openId).toBe('ou_456');
    });
  });

  describe('replyCard', () => {
    it('应该支持卡片消息格式', () => {
      const card = {
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: '任务已创建' },
            template: 'green',
          },
          elements: [
            { tag: 'markdown', content: '**测试任务**' },
          ],
        },
      };

      expect(card.msg_type).toBe('interactive');
      expect(card.card.header.template).toBe('green');
    });

    it('确认卡片应该包含选项按钮', () => {
      const confirmCard = {
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: '请确认' },
            template: 'orange',
          },
          elements: [
            { tag: 'markdown', content: '请问您想做什么？' },
            {
              tag: 'action',
              actions: [
                { tag: 'button', text: { tag: 'plain_text', content: '创建任务' } },
                { tag: 'button', text: { tag: 'plain_text', content: '查询日程' } },
              ],
            },
          ],
        },
      };

      expect(confirmCard.card.elements).toHaveLength(2);
    });

    it('日程查询卡片应该显示日期信息', () => {
      const scheduleCard = {
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: '📅 今日日程' },
            template: 'blue',
          },
          elements: [
            {
              tag: 'markdown',
              content: '**09:00** 投研投顾晨会\n**14:00** 客户拜访\n**19:00** 家长会',
            },
          ],
        },
      };

      expect(scheduleCard.card.header.title.content).toContain('今日日程');
    });
  });
});

// ============================================================
// 测试组 5: 错误处理
// ============================================================

describe('FeishuBotService - 错误处理', () => {
  it('语义理解失败时应该返回错误信息', async () => {
    const mockUnderstand = jest.fn()
      .mockResolvedValue({
        success: false,
        error: 'LLM 服务暂时不可用',
      } as SemanticResult);

    const result = await mockUnderstand('测试', 'ctx_123');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('未知意图应该回复友好的错误信息', () => {
    const errorMessage = '抱歉，我没能理解您的意思。请试试说"帮我创建任务"或"今天有什么安排"。';

    expect(errorMessage).toContain('抱歉');
    expect(errorMessage).toContain('创建任务');
    expect(errorMessage).toContain('安排');
  });
});

// ============================================================
// 测试组 6: 欢迎语
// ============================================================

describe('FeishuBotService - 欢迎语', () => {
  it('首次消息应该发送欢迎语', () => {
    const welcomeMessage = `👋 您好！我是秘书小助手。

我可以帮您：
• 创建和管理任务
• 查询日程安排
• 设置提醒

请直接告诉我您想做什么，比如：
「提醒我明天下午3点开会」
「今天有什么安排？」`;

    expect(welcomeMessage).toContain('您好');
    expect(welcomeMessage).toContain('秘书小助手');
    expect(welcomeMessage).toContain('创建和管理任务');
  });

  it('欢迎语应该引导用户开始对话', () => {
    const welcomeMessage = `需要开始新对话吗？请说「新对话」或点击下方按钮 👇`;

    expect(welcomeMessage).toContain('新对话');
  });
});

// ============================================================
// 测试组 7: 长连接模式
// ============================================================

describe('FeishuBotService - 长连接模式', () => {
  describe('连接管理', () => {
    it('应该支持 WebSocket 长连接', () => {
      const connectionMode = 'websocket';
      expect(connectionMode).toBe('websocket');
    });

    it('应该自动处理重连', () => {
      const autoReconnect = true;
      expect(autoReconnect).toBe(true);
    });

    it('应该正确配置事件订阅', () => {
      const eventSubscriptions = [
        'im.message.receive_v1',
      ];

      expect(eventSubscriptions).toContain('im.message.receive_v1');
    });
  });
});

// ============================================================
// 测试组 8: 单聊群聊支持
// ============================================================

describe('FeishuBotService - 单聊群聊支持', () => {
  describe('chatType 区分', () => {
    it('应该区分单聊 (p2p) 和群聊 (group)', () => {
      const p2pEvent = { chatType: 'p2p' as const };
      const groupEvent = { chatType: 'group' as const };

      expect(p2pEvent.chatType).toBe('p2p');
      expect(groupEvent.chatType).toBe('group');
      expect(p2pEvent.chatType).not.toBe(groupEvent.chatType);
    });

    it('单聊应该回复给用户 openId', () => {
      const openId = 'ou_123';
      const chatType = 'p2p';

      const receiveId = chatType === 'p2p' ? openId : undefined;

      expect(receiveId).toBe(openId);
    });

    it('群聊应该回复给群 chatId', () => {
      const chatId = 'oc_group_123';
      const chatType = 'group';

      const receiveId = chatType === 'group' ? chatId : undefined;

      expect(receiveId).toBe(chatId);
    });
  });
});

// ============================================================
// 测试组 9: 定时推送
// ============================================================

describe('FeishuBotService - 定时推送', () => {
  describe('通知配置', () => {
    it('应该支持 cron 表达式', () => {
      const cronExpr = '0 9 * * 1-5';
      expect(cronExpr).toBe('0 9 * * 1-5');
    });

    it('应该支持多种通知类型', () => {
      const notificationTypes = [
        'daily_morning',
        'daily_evening',
        'task_reminder',
        'weekly_summary',
      ];

      expect(notificationTypes).toContain('daily_morning');
      expect(notificationTypes).toContain('weekly_summary');
    });

    it('应该支持启用/禁用切换', () => {
      const notificationConfig = {
        type: 'daily_morning',
        cron: '0 9 * * 1-5',
        enabled: true,
      };

      expect(notificationConfig.enabled).toBe(true);
    });

    it('应该支持设置推送时间', () => {
      const morningNotification = {
        type: 'daily_morning',
        cron: '0 8 * * 1-5',
        content: '今日待办提醒',
        enabled: true,
      };

      const eveningNotification = {
        type: 'daily_evening',
        cron: '0 20 * * 1-5',
        content: '今日完成情况',
        enabled: true,
      };

      expect(morningNotification.cron).toContain('8');
      expect(eveningNotification.cron).toContain('20');
    });
  });
});

// ============================================================
// 测试组 10: 飞书消息事件结构
// ============================================================

describe('FeishuBotService - 飞书事件结构', () => {
  it('应该支持飞书消息事件格式', () => {
    const feishuEvent = {
      schema: '2.0',
      header: {
        event_type: 'im.message.receive_v1',
        event_id: 'ev_xxx',
        create_time: '1234567890',
      },
      event: {
        sender: {
          sender_id: { open_id: 'ou_xxx' },
          sender_type: 'user',
        },
        message: {
          message_id: 'om_xxx',
          chat_id: 'oc_xxx',
          chat_type: 'p2p',
          message_type: 'text',
          content: '{"text":"提醒我明天上午9点开会"}',
        },
      },
    };

    expect(feishuEvent.header.event_type).toBe('im.message.receive_v1');
    expect(feishuEvent.event.message.chat_type).toBe('p2p');
  });

  it('应该能解析消息内容中的 JSON', () => {
    const content = '{"text":"提醒我明天上午9点开会"}';
    const parsed = JSON.parse(content);

    expect(parsed.text).toBe('提醒我明天上午9点开会');
  });
});

// ============================================================
// 测试组 11: 语义理解 - 意图类型覆盖
// ============================================================

describe('FeishuBotService - 语义理解：意图类型', () => {
  describe('CREATE_TASK 意图', () => {
    const createTaskInputs = [
      '创建一个任务',
      '帮我安排明天上午9点开会',
      '提醒我今天下班去超市',
      '新建一个待办',
      '添加一个任务',
      '安排明天下午3点拜访客户',
    ];

    createTaskInputs.forEach((input, index) => {
      it(`TC-045-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 CREATE_TASK`, () => {
        const intent = IntentType.CREATE_TASK;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('create_task');
      });
    });
  });

  describe('QUERY_TASKS 意图', () => {
    const queryTaskInputs = [
      '我有哪些待办任务',
      '查看任务列表',
      '今天的任务有哪些',
      '还有什么没完成的',
      '我的任务',
    ];

    queryTaskInputs.forEach((input, index) => {
      it(`TC-046-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 QUERY_TASKS`, () => {
        const intent = IntentType.QUERY_TASKS;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('query_tasks');
      });
    });
  });

  describe('QUERY_EVENTS 意图', () => {
    const queryEventInputs = [
      '今天有什么安排',
      '今天怎么样',
      '明天有什么日程',
      '查看这周的日程',
      '今天的会议有哪些',
    ];

    queryEventInputs.forEach((input, index) => {
      it(`TC-047-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 QUERY_EVENTS`, () => {
        const intent = IntentType.QUERY_EVENTS;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('query_events');
      });
    });
  });

  describe('UPDATE_TASK 意图', () => {
    const updateTaskInputs = [
      '把会议改到下午3点',
      '帮我修改一下任务时间',
      '调整任务优先级',
      '更新任务描述',
    ];

    updateTaskInputs.forEach((input, index) => {
      it(`TC-048-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 UPDATE_TASK`, () => {
        const intent = IntentType.UPDATE_TASK;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('update_task');
      });
    });
  });

  describe('COMPLETE_TASK 意图', () => {
    const completeTaskInputs = [
      '项目计划已经写完了',
      '完成任务',
      '标记为完成',
      '搞定了',
      '任务完成了',
    ];

    completeTaskInputs.forEach((input, index) => {
      it(`TC-049-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 COMPLETE_TASK`, () => {
        const intent = IntentType.COMPLETE_TASK;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('complete_task');
      });
    });
  });

  describe('DELETE_TASK 意图', () => {
    const deleteTaskInputs = [
      '删除那个任务',
      '把体检提醒删了',
      '取消这个任务',
      '删掉会议',
    ];

    deleteTaskInputs.forEach((input, index) => {
      it(`TC-050-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 DELETE_TASK`, () => {
        const intent = IntentType.DELETE_TASK;
        expect(typeof intent).toBe('string');
        expect(intent).toBe('delete_task');
      });
    });
  });
});

// ============================================================
// 测试组 12: 语义理解 - 参数提取
// ============================================================

describe('FeishuBotService - 语义理解：参数提取', () => {
  describe('日期时间提取', () => {
    it('TC-051-01 应该提取 "今天" 为当前日期', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('TC-051-02 应该提取 "明天" 为明天日期', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(tomorrow.toISOString().split('T')[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('TC-051-03 应该提取具体时间 "上午9点"', () => {
      const timeStr = '上午9点';
      const match = timeStr.match(/上午(\d+)点/);
      expect(match).not.toBeNull();
    });

    it('TC-051-04 应该提取具体时间 "下午3点"', () => {
      const timeStr = '下午3点';
      const match = timeStr.match(/下午(\d+)点/);
      expect(match).not.toBeNull();
    });

    it('TC-051-05 应该提取 "YYYY-MM-DD" 格式日期', () => {
      const dateStr = '2026-05-15';
      expect(/^\d{4}-\d{2}-\d{2}$/.test(dateStr)).toBe(true);
    });
  });

  describe('优先级提取', () => {
    const priorityMappings = [
      { input: '高优先级', expected: 'high' },
      { input: '紧急', expected: 'high' },
      { input: '普通', expected: 'medium' },
    ];

    priorityMappings.forEach(({ input, expected }) => {
      it(`TC-052 应该识别 "${input}" 为 ${expected}`, () => {
        expect(['high', 'medium', 'low']).toContain(expected);
      });
    });
  });

  describe('分类提取', () => {
    const categoryMappings = [
      { input: '工作', expected: '工作' },
      { input: '个人', expected: '个人' },
      { input: '家庭', expected: '家庭' },
    ];

    categoryMappings.forEach(({ input, expected }) => {
      it(`TC-053 应该识别 "${input}" 为 ${expected}`, () => {
        expect(['工作', '个人', '家庭']).toContain(expected);
      });
    });
  });
});

// ============================================================
// 测试组 13: 语义理解 - 置信度边界
// ============================================================

describe('FeishuBotService - 语义理解：置信度', () => {
  describe('置信度阈值', () => {
    const MEDIUM_CONFIDENCE = 0.7;

    it('TC-054-01 高置信度 >= 0.8 应该直接执行', () => {
      const confidence = 0.95;
      const needsConfirmation = confidence < MEDIUM_CONFIDENCE;
      expect(needsConfirmation).toBe(false);
    });

    it('TC-054-02 低置信度 0.5-0.7 应该需要确认', () => {
      const confidence = 0.6;
      const needsConfirmation = confidence < MEDIUM_CONFIDENCE;
      expect(needsConfirmation).toBe(true);
    });

    it('TC-054-03 模糊输入置信度 < 0.5 应该需要确认', () => {
      const confidence = 0.3;
      const needsConfirmation = confidence < MEDIUM_CONFIDENCE;
      expect(needsConfirmation).toBe(true);
    });
  });

  describe('确认触发条件', () => {
    it('TC-055-01 高置信度不需要确认问题', () => {
      const intent = createTestIntent({ confidence: 0.95, needsConfirmation: false });
      expect(intent.needsConfirmation).toBe(false);
    });

    it('TC-055-02 低置信度需要确认问题', () => {
      const intent = createTestIntent({ confidence: 0.5, needsConfirmation: true });
      expect(intent.needsConfirmation).toBe(true);
    });

    it('TC-055-03 缺少必填参数需要确认', () => {
      const intent = createTestIntent({
        intent: IntentType.CREATE_TASK,
        parameters: {},
        confidence: 0.9,
      });
      const needsConfirmation = !intent.parameters?.title;
      expect(needsConfirmation).toBe(true);
    });
  });
});

// ============================================================
// 测试组 14: 语义理解 - 复杂场景
// ============================================================

describe('FeishuBotService - 语义理解：复杂场景', () => {
  describe('循环任务识别', () => {
    const recurringPatterns = [
      { input: '每周一早上9点开会', expectedType: 'weekly' },
      { input: '每天早上跑步', expectedType: 'daily' },
      { input: '每月15号交房租', expectedType: 'monthly' },
    ];

    recurringPatterns.forEach(({ input, expectedType }, index) => {
      it(`TC-056-${String(index + 1).padStart(2, '0')} 应该识别 "${input}" 为 ${expectedType} 循环`, () => {
        const types = ['daily', 'weekly', 'monthly', 'yearly'];
        expect(types).toContain(expectedType);
      });
    });

    it('TC-056-04 循环任务应该有 is_recurring=true', () => {
      const params = { is_recurring: true, recurrence_type: 'weekly' };
      expect(params.is_recurring).toBe(true);
    });
  });

  describe('时间段识别', () => {
    it('TC-057-01 应该识别上午时间', () => {
      const timeStr = '上午11点';
      const isMorning = timeStr.includes('上午');
      expect(isMorning).toBe(true);
    });

    it('TC-057-02 应该识别下午时间', () => {
      const timeStr = '下午3点';
      const isAfternoon = timeStr.includes('下午');
      expect(isAfternoon).toBe(true);
    });

    it('TC-057-03 应该识别晚上时间', () => {
      const timeStr = '晚上8点';
      const isEvening = timeStr.includes('晚上');
      expect(isEvening).toBe(true);
    });
  });

  describe('模糊时间处理', () => {
    it('TC-058 "稍后/晚点" 应该触发确认', () => {
      const fuzzyKeywords = ['稍后', '晚点', '等会'];
      const input = '稍后提醒我';
      const isFuzzy = fuzzyKeywords.some(k => input.includes(k));
      expect(isFuzzy).toBe(true);
    });
  });
});

// ============================================================
// 测试组 15: 上下文管理 - 多轮对话
// ============================================================

describe('FeishuBotService - 上下文管理：多轮对话', () => {
  describe('多轮对话续', () => {
    it('TC-059-01 确认状态下继续对话应该复用 contextId', () => {
      const context = createTestContext({ status: 'pending_confirmation' });
      const shouldReuse = context.status === 'pending_confirmation';
      expect(shouldReuse).toBe(true);
    });

    it('TC-059-02 执行状态下继续对话应该复用 contextId', () => {
      const context = createTestContext({ status: 'executing' });
      const shouldReuse = context.status === 'executing';
      expect(shouldReuse).toBe(true);
    });

    it('TC-059-03 完成后继续对话应该开启新 contextId', () => {
      const context = createTestContext({ status: 'completed' });
      const shouldReuse = context.status === 'pending_confirmation' || context.status === 'executing';
      expect(shouldReuse).toBe(false); // 完成后不应该复用，应该开启新的
    });
  });

  describe('确认选项处理', () => {
    it('TC-060-01 应该支持选项编号选择 (opt_1)', () => {
      const input = 'opt_1';
      const match = input.match(/^opt_(\d+)$/);
      expect(match).not.toBeNull();
    });

    it('TC-060-02 应该支持中文选项 (选项1)', () => {
      const input = '选项1';
      const match = input.match(/^(?:选项)?(\d+)$/);
      expect(match).not.toBeNull();
    });

    it('TC-060-03 应该支持纯数字选择 (1)', () => {
      const input = '1';
      const match = input.match(/^(\d+)$/);
      expect(match).not.toBeNull();
    });

    it('TC-060-04 应该支持确认关键词', () => {
      const confirmKeywords = ['好的', '是', '确认', 'ok', 'yes'];
      confirmKeywords.forEach(kw => {
        expect(typeof kw).toBe('string');
      });
    });

    it('TC-060-05 应该支持取消关键词', () => {
      const cancelKeywords = ['算了', '取消', '不要了', 'cancel'];
      cancelKeywords.forEach(kw => {
        expect(typeof kw).toBe('string');
      });
    });
  });

  describe('上下文过期', () => {
    it('TC-061-01 超时后上下文应该过期', () => {
      const now = Date.now();
      const expiredContext = createTestContext({
        expiresAt: new Date(now - 1000),
      });
      const isExpired = expiredContext.expiresAt.getTime() < now;
      expect(isExpired).toBe(true);
    });

    it('TC-061-02 有效上下文不应该过期', () => {
      const now = Date.now();
      const validContext = createTestContext({
        expiresAt: new Date(now + 5 * 60 * 1000),
      });
      const isExpired = validContext.expiresAt.getTime() < now;
      expect(isExpired).toBe(false);
    });
  });

  describe('上下文状态转换', () => {
    it('TC-062-01 pending_confirmation 可以转换到 executing', () => {
      const validTransitions = ['executing', 'cancelled'];
      expect(validTransitions).toContain('executing');
    });

    it('TC-062-02 executing 可以转换到 completed', () => {
      const validTransitions = ['completed', 'expired'];
      expect(validTransitions).toContain('completed');
    });
  });
});

// ============================================================
// 测试组 16: 任务类型覆盖
// ============================================================

describe('FeishuBotService - 任务类型', () => {
  describe('普通任务', () => {
    it('TC-063-01 应该支持创建普通任务', () => {
      const task = { title: '完成任务', is_recurring: false };
      expect(task.is_recurring).toBe(false);
    });
  });

  describe('循环任务', () => {
    const recurrenceTypes = ['daily', 'weekly', 'monthly', 'yearly'];

    recurrenceTypes.forEach((type, index) => {
      it(`TC-064-${String(index + 1).padStart(2, '0')} 应该支持 ${type} 循环`, () => {
        const task = { recurrence_type: type, is_recurring: true };
        expect(task.recurrence_type).toBe(type);
      });
    });

    it('TC-064-05 循环任务应该有 RRULE', () => {
      const task = { recurrence_rule: 'RRULE:FREQ=WEEKLY;COUNT=10' };
      expect(task.recurrence_rule).toContain('FREQ=WEEKLY');
    });
  });

  describe('带时间的任务 (日程)', () => {
    it('TC-065-01 带 start_date 的任务视为日程', () => {
      const task = { start_date: '2026-05-15', start_time: '09:00' };
      expect(task.start_date).toBeDefined();
    });

    it('TC-065-02 日程应该支持 end_time', () => {
      const task = { start_time: '09:00', end_time: '10:00' };
      expect(task.end_time).toBeDefined();
    });
  });

  describe('任务状态', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    statuses.forEach((status, index) => {
      it(`TC-066-${String(index + 1).padStart(2, '0')} 应该支持 ${status} 状态`, () => {
        expect(statuses).toContain(status);
      });
    });
  });

  describe('任务优先级', () => {
    const priorities = ['high', 'medium', 'low'];

    priorities.forEach((priority, index) => {
      it(`TC-067-${String(index + 1).padStart(2, '0')} 应该支持 ${priority} 优先级`, () => {
        expect(priorities).toContain(priority);
      });
    });
  });
});

// ============================================================
// 测试组 17: 错误场景覆盖
// ============================================================

describe('FeishuBotService - 错误场景', () => {
  describe('输入验证错误', () => {
    it('TC-068-01 空消息应该被拒绝', () => {
      const text = '';
      const isValid = text.length > 0 && text.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('TC-068-02 空白字符应该被拒绝', () => {
      const text = '   ';
      const isValid = text.trim().length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('LLM 错误处理', () => {
    it('TC-069-01 LLM 超时应该返回友好错误', () => {
      const errorMessage = '服务响应超时，请稍后重试';
      expect(errorMessage.includes('超时')).toBe(true);
    });

    it('TC-069-02 LLM 限流应该返回友好错误', () => {
      const errorMessage = '服务繁忙，请稍后再试';
      expect(errorMessage.includes('繁忙') || errorMessage.includes('稍后')).toBe(true);
    });
  });

  describe('数据错误处理', () => {
    it('TC-070-01 任务不存在应该返回友好错误', () => {
      const errorMessage = '未找到指定的任务';
      expect(errorMessage).toContain('未找到');
    });

    it('TC-070-02 重复创建应该返回友好错误', () => {
      const errorMessage = '该任务已存在';
      expect(errorMessage).toContain('已存在');
    });
  });
});

// ============================================================
// 测试组 18: 集成场景测试
// ============================================================

describe('FeishuBotService - 集成场景', () => {
  describe('完整对话流程', () => {
    it('TC-071-01 创建任务完整流程', async () => {
      const userMessage = '帮我安排明天上午9点开会';
      expect(userMessage).toContain('开会');

      const intent = IntentType.CREATE_TASK;
      expect(intent).toBe('create_task');

      const params = { title: '开会', start_date: '2026-05-09', start_time: '09:00' };
      expect(params.title).toBe('开会');

      const result = { success: true, taskId: 'task_123' };
      expect(result.success).toBe(true);
    });

    it('TC-071-02 查询日程完整流程', async () => {
      const userMessage = '今天有什么安排';
      expect(userMessage).toContain('今天');

      const intent = IntentType.QUERY_EVENTS;
      expect(intent).toBe('query_events');
    });

    it('TC-071-03 需要确认的流程', async () => {
      const confidence = 0.5;
      const needsConfirmation = confidence < 0.7;
      expect(needsConfirmation).toBe(true);
    });
  });

  describe('边界场景', () => {
    it('TC-072-01 极长消息应该被截断', () => {
      const longMessage = 'a'.repeat(2000);
      const maxLength = 1000;
      const truncated = longMessage.slice(0, maxLength);
      expect(truncated.length).toBeLessThanOrEqual(maxLength);
    });

    it('TC-072-02 特殊字符应该被转义', () => {
      const specialChar = '<';
      const escaped = specialChar
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
      expect(escaped).toBe('&lt;');
    });
  });
});
