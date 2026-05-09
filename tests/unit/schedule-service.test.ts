// ScheduleService Unit Tests

describe('ScheduleService', () => {
  let scheduleService: any;
  let mockICloudConnector: any;
  let mockFeishuConnector: any;
  let mockLogger: any;

  const mockTask = {
    id: 'task-123',
    title: '测试日程',
    description: '测试描述',
    status: 'pending',
    priority: 'medium' as const,
    category: '工作',
    start_date: '2026-05-05',
    start_time: '09:00',
    end_time: '10:00',
    is_recurring: false,
    recurrence_type: 'none' as const,
    created_at: '2026-05-04T00:00:00Z',
    updated_at: '2026-05-04T00:00:00Z',
  };

  beforeEach(() => {
    jest.resetModules();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    jest.mock('../../src/shared/logger', () => ({
      logger: mockLogger,
    }));

    // Mock ICloudConnector
    mockICloudConnector = {
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
      queryEvents: jest.fn(),
      calendarMapping: {
        '工作': 'work-calendar-id',
        '个人': 'personal-calendar-id',
      },
      getCalendarIdByCategory: jest.fn((cat: string) => {
        if (cat === '工作') return 'work-calendar-id';
        if (cat === '个人') return 'personal-calendar-id';
        return undefined;
      }),
    };
    jest.mock('../../src/connectors/icloud', () => ({
      icloudConnector: mockICloudConnector,
      ICloudError: class ICloudError extends Error {
        constructor(public message: string, public code: string, public statusCode?: number) {
          super(message);
          this.name = 'ICloudError';
        }
      },
    }));

    // Mock FeishuConnector
    mockFeishuConnector = {
      create: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };
    jest.mock('../../src/connectors/feishu', () => ({
      feishuConnector: mockFeishuConnector,
    }));

    // Get fresh instance
    const scheduleModule = require('../../src/services/schedule-service');
    scheduleService = new scheduleModule.ScheduleService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncToICalendar', () => {
    it('should skip sync when task has no start_date', async () => {
      const taskWithoutStartDate = { ...mockTask, start_date: undefined };
      const result = await scheduleService.syncToICalendar(taskWithoutStartDate);

      expect(result.success).toBe(true);
      expect(mockICloudConnector.createEvent).not.toHaveBeenCalled();
    });

    it('should create iCloud event for task with start_date', async () => {
      mockICloudConnector.createEvent.mockResolvedValue('icloud-event-uid');

      const result = await scheduleService.syncToICalendar(mockTask);

      expect(result.success).toBe(true);
      expect(result.icloud_event_id).toBe('icloud-event-uid');
      expect(mockICloudConnector.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '测试日程',
          startDate: '2026-05-05',
          startTime: '09:00',
          calendarId: 'work-calendar-id',
        })
      );
    });

    it('should update existing iCloud event', async () => {
      const taskWithIcloudId = { ...mockTask, icloud_event_id: 'existing-uid' };
      mockICloudConnector.updateEvent.mockResolvedValue(undefined);

      const result = await scheduleService.syncToICalendar(taskWithIcloudId);

      expect(result.success).toBe(true);
      expect(result.icloud_event_id).toBe('existing-uid');
      expect(mockICloudConnector.updateEvent).toHaveBeenCalledWith(
        'existing-uid',
        expect.any(Object)
      );
    });

    it('should return error when category is unknown', async () => {
      const taskWithUnknownCategory = { ...mockTask, category: '未知分类' };

      const result = await scheduleService.syncToICalendar(taskWithUnknownCategory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown category');
    });

    it('should handle iCloud create failure', async () => {
      mockICloudConnector.createEvent.mockRejectedValue(new Error('iCloud error'));

      const result = await scheduleService.syncToICalendar(mockTask);

      expect(result.success).toBe(false);
      expect(result.error).toBe('iCloud error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteFromICalendar', () => {
    it('should skip delete when task has no icloud_event_id', async () => {
      const taskWithoutIcloudId = { ...mockTask, icloud_event_id: undefined };
      const result = await scheduleService.deleteFromICalendar(taskWithoutIcloudId);

      expect(result.success).toBe(true);
      expect(mockICloudConnector.deleteEvent).not.toHaveBeenCalled();
    });

    it('should delete iCloud event when icloud_event_id exists', async () => {
      const taskWithIcloudId = { ...mockTask, icloud_event_id: 'test-uid' };
      mockICloudConnector.deleteEvent.mockResolvedValue(undefined);

      const result = await scheduleService.deleteFromICalendar(taskWithIcloudId);

      expect(result.success).toBe(true);
      expect(mockICloudConnector.deleteEvent).toHaveBeenCalledWith('test-uid', 'work-calendar-id');
    });

    it('should return error when category is unknown', async () => {
      const taskWithUnknownCategory = { ...mockTask, icloud_event_id: 'test-uid', category: '未知分类' };

      const result = await scheduleService.deleteFromICalendar(taskWithUnknownCategory);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown category');
    });
  });

  describe('querySchedules', () => {
    it('should query with date filter', async () => {
      mockFeishuConnector.list.mockResolvedValue({
        items: [mockTask],
        total: 1,
      });

      const result = await scheduleService.querySchedules({ date: '2026-05-05' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFeishuConnector.list).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date_from: '2026-05-05',
          start_date_to: '2026-05-05',
        })
      );
    });

    it('should query with date range', async () => {
      mockFeishuConnector.list.mockResolvedValue({ items: [], total: 0 });

      await scheduleService.querySchedules({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });

      expect(mockFeishuConnector.list).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date_from: '2026-05-01',
          start_date_to: '2026-05-31',
        })
      );
    });

    it('should query with category filter', async () => {
      mockFeishuConnector.list.mockResolvedValue({ items: [], total: 0 });

      await scheduleService.querySchedules({ category: '工作' });

      expect(mockFeishuConnector.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: '工作' })
      );
    });

    it('should filter out tasks without start_date', async () => {
      const taskWithoutStartDate = { ...mockTask, start_date: undefined };
      mockFeishuConnector.list.mockResolvedValue({
        items: [mockTask, taskWithoutStartDate],
        total: 2,
      });

      const result = await scheduleService.querySchedules({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].start_date).toBe('2026-05-05');
    });
  });

  describe('getSchedule', () => {
    it('should return task when found with start_date', async () => {
      mockFeishuConnector.get.mockResolvedValue(mockTask);

      const result = await scheduleService.getSchedule('task-123');

      expect(result).toEqual(mockTask);
    });

    it('should return null when task has no start_date', async () => {
      const taskWithoutStartDate = { ...mockTask, start_date: undefined };
      mockFeishuConnector.get.mockResolvedValue(taskWithoutStartDate);

      const result = await scheduleService.getSchedule('task-123');

      expect(result).toBeNull();
    });

    it('should return null when task not found', async () => {
      mockFeishuConnector.get.mockResolvedValue(null);

      const result = await scheduleService.getSchedule('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('syncFromICalendar', () => {
    it('should sync events from iCloud to Feishu', async () => {
      const mockICloudEvents = [
        {
          uid: 'icloud-event-1',
          title: 'iCloud Event 1',
          startDate: '2026-05-05',
          startTime: '09:00',
        },
      ];

      mockICloudConnector.queryEvents.mockResolvedValue(mockICloudEvents);
      mockFeishuConnector.list.mockResolvedValue({ items: [], total: 0 });
      mockFeishuConnector.create.mockResolvedValue({ id: 'new-task-id' });

      const result = await scheduleService.syncFromICalendar('work-calendar-id');

      expect(result.synced).toBe(1);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing task when iCloud event changed', async () => {
      const mockICloudEvents = [
        {
          uid: 'icloud-event-1',
          title: 'Updated iCloud Event',
          startDate: '2026-05-06', // Changed
          startTime: '10:00', // Changed
        },
      ];

      const existingTask = {
        ...mockTask,
        icloud_event_id: 'icloud-event-1',
        title: 'Old Title',
      };

      mockICloudConnector.queryEvents.mockResolvedValue(mockICloudEvents);
      mockFeishuConnector.list.mockResolvedValue({ items: [existingTask], total: 1 });
      mockFeishuConnector.update.mockResolvedValue({ ...existingTask, title: 'Updated iCloud Event' });

      const result = await scheduleService.syncFromICalendar('work-calendar-id');

      expect(result.synced).toBe(1);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
    });

    it('should handle multiple calendars', async () => {
      mockICloudConnector.queryEvents.mockResolvedValue([]);

      await scheduleService.syncFromICalendar();

      // Should query all calendars in calendarMapping
      expect(mockICloudConnector.queryEvents).toHaveBeenCalled();
    });
  });
});