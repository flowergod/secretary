// 日程 API 路由
import { IncomingMessage, ServerResponse } from 'http';
import { scheduleService, taskService } from '../services';
import { ICloudError } from '../connectors/icloud';
import { logger } from '../shared/logger';

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseQueryParams(req: IncomingMessage): Record<string, string> {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 从路径提取 ID (用于 /api/events/:id 等情况)
function extractId(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  // /api/events/xxx → segments = ['api', 'events', 'xxx'], id = segments[2]
  if (segments.length >= 3) {
    return segments[2];
  }
  return '';
}

// GET /api/events - 查询日程列表
export const listEvents: Handler = async (req, res) => {
  try {
    const rawQuery = parseQueryParams(req);

    const query: {
      date?: string;
      startDate?: string;
      endDate?: string;
      category?: string;
      page?: number;
      pageSize?: number;
    } = {};

    if (rawQuery.date) query.date = rawQuery.date;
    if (rawQuery.start_date) query.startDate = rawQuery.start_date;
    if (rawQuery.end_date) query.endDate = rawQuery.end_date;
    if (rawQuery.category) query.category = rawQuery.category;
    if (rawQuery.page) query.page = parseInt(rawQuery.page, 10);
    if (rawQuery.page_size) query.pageSize = parseInt(rawQuery.page_size, 10);

    const result = await scheduleService.querySchedules(query);

    sendJson(res, 200, {
      success: true,
      data: {
        items: result.items.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          start_date: t.start_date,
          start_time: t.start_time,
          end_time: t.end_time,
          category: t.category,
          status: t.status,
          priority: t.priority,
          is_recurring: t.is_recurring,
          recurrence_type: t.recurrence_type,
          recurrence_rule: t.recurrence_rule,
          icloud_event_id: t.icloud_event_id,
          icloud_sync_status: t.icloud_event_id ? 'synced' : 'pending',
        })),
        total: result.total,
        page: query.page || 1,
        page_size: query.pageSize || 20,
      },
    });
  } catch (e) {
    logger.error('[Route] listEvents error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// GET /api/events/:id - 获取单个日程
export const getEvent: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const task = await scheduleService.getSchedule(id);

    if (!task) {
      sendJson(res, 404, { success: false, error: { code: 404, message: 'Schedule not found' } });
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        start_date: task.start_date,
        start_time: task.start_time,
        end_time: task.end_time,
        category: task.category,
        status: task.status,
        priority: task.priority,
        is_recurring: task.is_recurring,
        recurrence_type: task.recurrence_type,
        recurrence_rule: task.recurrence_rule,
        icloud_event_id: task.icloud_event_id,
        icloud_sync_status: task.icloud_event_id ? 'synced' : 'pending',
      },
    });
  } catch (e) {
    logger.error('[Route] getEvent error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// POST /api/events - 创建日程
export const createEvent: Handler = async (req, res) => {
  try {
    const body = await parseBody<Record<string, unknown>>(req);

    const { title, description, start_date, start_time, end_time, category, is_recurring, recurrence_type, recurrence_rule } = body as {
      title?: string;
      description?: string;
      start_date?: string;
      start_time?: string;
      end_time?: string;
      category?: string;
      is_recurring?: boolean;
      recurrence_type?: string;
      recurrence_rule?: string;
    };

    // 验证必填字段
    if (!title) {
      sendJson(res, 400, { success: false, error: { code: 400, message: 'title is required' } });
      return;
    }
    if (!start_date) {
      sendJson(res, 400, { success: false, error: { code: 400, message: 'start_date is required for calendar events' } });
      return;
    }

    // 创建任务（含 start_date 会触发 iCloud 同步）
    const created = await taskService.create({
      title,
      description,
      start_date,
      start_time,
      end_time,
      category,
      is_recurring: is_recurring || !!recurrence_rule,
      recurrence_type: (recurrence_type || (recurrence_rule ? 'weekly' : 'none')) as any,
      recurrence_rule,
      source: 'api',
    });

    if (!created.success) {
      sendJson(res, 500, { success: false, error: { code: 500, message: created.error?.message || 'Create failed' } });
      return;
    }

    const taskData = created.data;
    sendJson(res, 201, {
      success: true,
      data: {
        id: taskData?.id,
        title: taskData?.title,
        start_date: taskData?.start_date,
        start_time: taskData?.start_time,
        end_time: taskData?.end_time,
        category: taskData?.category,
        icloud_event_id: taskData?.icloud_event_id,
        icloud_sync_status: taskData?.icloud_event_id ? 'synced' : 'pending',
      },
    });
  } catch (e) {
    logger.error('[Route] createEvent error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Failed to create schedule' } });
  }
};

// PUT /api/events/:id - 更新日程
export const updateEvent: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const body = await parseBody<Record<string, unknown>>(req);

    // 验证日程是否存在
    const existing = await scheduleService.getSchedule(id);
    if (!existing) {
      sendJson(res, 404, { success: false, error: { code: 404, message: 'Schedule not found' } });
      return;
    }

    // 调用 TaskService 更新
    const result = await taskService.update(id, body);

    if (!result.success) {
      sendJson(res, 404, result);
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        id: result.data?.id,
        title: result.data?.title,
        start_date: result.data?.start_date,
        start_time: result.data?.start_time,
        end_time: result.data?.end_time,
        category: result.data?.category,
        icloud_event_id: result.data?.icloud_event_id,
        icloud_sync_status: result.data?.icloud_event_id ? 'synced' : 'pending',
      },
    });
  } catch (e) {
    logger.error('[Route] updateEvent error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Failed to update schedule' } });
  }
};

// DELETE /api/events/:id - 删除日程
export const deleteEvent: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);

    // 获取日程信息用于判断是否需要删除 iCloud 事件
    const existing = await scheduleService.getSchedule(id);
    if (!existing) {
      sendJson(res, 404, { success: false, error: { code: 404, message: 'Schedule not found' } });
      return;
    }

    // 调用 TaskService 删除
    const result = await taskService.delete(id);

    if (!result.success) {
      sendJson(res, 404, result);
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        deleted: 1,
        icloud_deleted: !!existing.icloud_event_id,
      },
    });
  } catch (e) {
    logger.error('[Route] deleteEvent error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Failed to delete schedule' } });
  }
};

// POST /api/events/sync-from-icloud - 从 iCloud 同步日程到飞书
export const syncFromICloud: Handler = async (req, res) => {
  try {
    const body = await parseBody<{ calendar_id?: string; start_date?: string; end_date?: string }>(req);
    const { calendar_id, start_date, end_date } = body;

    const result = await scheduleService.syncFromICalendar(calendar_id, start_date, end_date);

    sendJson(res, 200, {
      success: true,
      data: {
        synced: result.synced,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      },
    });
  } catch (e) {
    logger.error('[Route] syncFromICloud error:', e);

    if (e instanceof ICloudError) {
      sendJson(res, e.statusCode || 500, {
        success: false,
        error: { code: e.statusCode || 500, message: e.message, details: e.code },
      });
      return;
    }

    sendJson(res, 500, { success: false, error: { code: 500, message: 'Failed to sync from iCloud' } });
  }
};

// POST /api/events/sync-to-icloud/:id - 手动同步指定日程到 iCloud
export const syncToICloud: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const task = await scheduleService.getSchedule(id);

    if (!task) {
      sendJson(res, 404, { success: false, error: { code: 404, message: 'Schedule not found' } });
      return;
    }

    const result = await scheduleService.syncToICalendar(task);

    if (!result.success) {
      sendJson(res, 500, { success: false, error: { code: 500, message: result.error || 'Sync failed' } });
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        id: task.id,
        icloud_event_id: result.icloud_event_id,
        icloud_sync_status: 'synced',
      },
    });
  } catch (e) {
    logger.error('[Route] syncToICloud error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Failed to sync to iCloud' } });
  }
};