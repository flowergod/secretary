// 任务 API 路由
import { IncomingMessage, ServerResponse } from 'http';
import { taskService } from '../services';
import { CreateTaskRequest, UpdateTaskRequest, ListTasksQuery, TransitionTaskRequest, BatchDeleteTasksRequest, TaskStatus } from '../shared/types';
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

// 从路径提取 ID (用于 /api/tasks/:id 和 /api/tasks/:id/action 两种情况)
function extractId(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  // /api/tasks/xxx → segments = ['api', 'tasks', 'xxx'], id = segments[2]
  // /api/tasks/xxx/action → segments = ['api', 'tasks', 'xxx', 'action'], id = segments[2]
  if (segments.length >= 3) {
    return segments[2]; // Always the 3rd segment for /api/tasks/:id paths
  }
  return '';
}

// POST /api/tasks - 创建任务
export const createTask: Handler = async (req, res) => {
  try {
    const body = await parseBody<CreateTaskRequest>(req);
    if (!body.title) {
      sendJson(res, 400, {
        success: false,
        error: { code: 400, message: 'title is required' }
      });
      return;
    }
    const result = await taskService.create(body);
    const statusCode = result.success ? 201 : 500;
    sendJson(res, statusCode, result);
  } catch (e) {
    logger.error('[Route] createTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// GET /api/tasks - 查询任务列表
export const listTasks: Handler = async (req, res) => {
  try {
    const rawQuery = parseQueryParams(req);
    const query: ListTasksQuery = {
      page: rawQuery.page ? parseInt(rawQuery.page, 10) : undefined,
      page_size: rawQuery.page_size ? parseInt(rawQuery.page_size, 10) : undefined,
      status: rawQuery.status as ListTasksQuery['status'],
      priority: rawQuery.priority as ListTasksQuery['priority'],
      category: rawQuery.category,
      due_date: rawQuery.due_date,
      due_date_from: rawQuery.due_date_from,
      due_date_to: rawQuery.due_date_to,
      start_date: rawQuery.start_date,
      is_recurring: rawQuery.is_recurring === 'true' ? true : rawQuery.is_recurring === 'false' ? false : undefined,
      parent_id: rawQuery.parent_id,
      sort_by: rawQuery.sort_by,
      sort_order: rawQuery.sort_order as ListTasksQuery['sort_order'],
    };

    const result = await taskService.list(query);
    sendJson(res, result.success ? 200 : 500, result);
  } catch (e) {
    logger.error('[Route] listTasks error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// GET /api/tasks/:id - 获取单个任务
export const getTask: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const result = await taskService.get(id);
    sendJson(res, result.success ? 200 : 404, result);
  } catch (e) {
    logger.error('[Route] getTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// PUT /api/tasks/:id - 更新任务
export const updateTask: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const body = await parseBody<UpdateTaskRequest>(req);
    const result = await taskService.update(id, body);
    sendJson(res, result.success ? 200 : 404, result);
  } catch (e) {
    logger.error('[Route] updateTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// DELETE /api/tasks/:id - 删除任务
export const deleteTask: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const result = await taskService.delete(id);
    sendJson(res, result.success ? 200 : 404, result);
  } catch (e) {
    logger.error('[Route] deleteTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// POST /api/tasks/batch-delete - 批量删除
export const batchDeleteTasks: Handler = async (req, res) => {
  try {
    const body = await parseBody<BatchDeleteTasksRequest>(req);
    if (!body.ids || !Array.isArray(body.ids)) {
      sendJson(res, 400, {
        success: false,
        error: { code: 400, message: 'ids array is required' }
      });
      return;
    }
    const result = await taskService.batchDelete(body.ids);
    sendJson(res, 200, result);
  } catch (e) {
    logger.error('[Route] batchDeleteTasks error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// POST /api/tasks/:id/complete - 完成任务
export const completeTask: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const result = await taskService.complete(id);
    sendJson(res, result.success ? 200 : 404, result);
  } catch (e) {
    logger.error('[Route] completeTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};

// POST /api/tasks/:id/transition - 状态变更
export const transitionTask: Handler = async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const id = extractId(url.pathname);
    const body = await parseBody<TransitionTaskRequest>(req);

    if (!body.to_status) {
      sendJson(res, 400, {
        success: false,
        error: { code: 400, message: 'to_status is required' }
      });
      return;
    }

    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'cancelled'];
    if (!validStatuses.includes(body.to_status)) {
      sendJson(res, 400, {
        success: false,
        error: { code: 400, message: 'to_status must be pending, in_progress, or cancelled' }
      });
      return;
    }

    const result = await taskService.transition(id, body.to_status);
    sendJson(res, result.success ? 200 : (result.error?.code === 2001 ? 404 : 400), result);
  } catch (e) {
    logger.error('[Route] transitionTask error:', e);
    sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
  }
};
