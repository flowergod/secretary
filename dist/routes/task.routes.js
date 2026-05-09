"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionTask = exports.completeTask = exports.batchDeleteTasks = exports.deleteTask = exports.updateTask = exports.getTask = exports.listTasks = exports.createTask = void 0;
const services_1 = require("../services");
const logger_1 = require("../shared/logger");
function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks).toString('utf8');
                resolve(JSON.parse(body || '{}'));
            }
            catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}
function parseQueryParams(req) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const params = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
// 从路径提取 ID (用于 /api/tasks/:id 和 /api/tasks/:id/action 两种情况)
function extractId(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    // /api/tasks/xxx → segments = ['api', 'tasks', 'xxx'], id = segments[2]
    // /api/tasks/xxx/action → segments = ['api', 'tasks', 'xxx', 'action'], id = segments[2]
    if (segments.length >= 3) {
        return segments[2]; // Always the 3rd segment for /api/tasks/:id paths
    }
    return '';
}
// POST /api/tasks - 创建任务
const createTask = async (req, res) => {
    try {
        const body = await parseBody(req);
        if (!body.title) {
            sendJson(res, 400, {
                success: false,
                error: { code: 400, message: 'title is required' }
            });
            return;
        }
        const result = await services_1.taskService.create(body);
        const statusCode = result.success ? 201 : 500;
        sendJson(res, statusCode, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] createTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.createTask = createTask;
// GET /api/tasks - 查询任务列表
const listTasks = async (req, res) => {
    try {
        const rawQuery = parseQueryParams(req);
        const query = {
            page: rawQuery.page ? parseInt(rawQuery.page, 10) : undefined,
            page_size: rawQuery.page_size ? parseInt(rawQuery.page_size, 10) : undefined,
            status: rawQuery.status,
            priority: rawQuery.priority,
            category: rawQuery.category,
            due_date: rawQuery.due_date,
            due_date_from: rawQuery.due_date_from,
            due_date_to: rawQuery.due_date_to,
            start_date: rawQuery.start_date,
            is_recurring: rawQuery.is_recurring === 'true' ? true : rawQuery.is_recurring === 'false' ? false : undefined,
            parent_id: rawQuery.parent_id,
            sort_by: rawQuery.sort_by,
            sort_order: rawQuery.sort_order,
        };
        const result = await services_1.taskService.list(query);
        sendJson(res, result.success ? 200 : 500, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] listTasks error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.listTasks = listTasks;
// GET /api/tasks/:id - 获取单个任务
const getTask = async (req, res) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const id = extractId(url.pathname);
        const result = await services_1.taskService.get(id);
        sendJson(res, result.success ? 200 : 404, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] getTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.getTask = getTask;
// PUT /api/tasks/:id - 更新任务
const updateTask = async (req, res) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const id = extractId(url.pathname);
        const body = await parseBody(req);
        const result = await services_1.taskService.update(id, body);
        sendJson(res, result.success ? 200 : 404, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] updateTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.updateTask = updateTask;
// DELETE /api/tasks/:id - 删除任务
const deleteTask = async (req, res) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const id = extractId(url.pathname);
        const result = await services_1.taskService.delete(id);
        sendJson(res, result.success ? 200 : 404, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] deleteTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.deleteTask = deleteTask;
// POST /api/tasks/batch-delete - 批量删除
const batchDeleteTasks = async (req, res) => {
    try {
        const body = await parseBody(req);
        if (!body.ids || !Array.isArray(body.ids)) {
            sendJson(res, 400, {
                success: false,
                error: { code: 400, message: 'ids array is required' }
            });
            return;
        }
        const result = await services_1.taskService.batchDelete(body.ids);
        sendJson(res, 200, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] batchDeleteTasks error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.batchDeleteTasks = batchDeleteTasks;
// POST /api/tasks/:id/complete - 完成任务
const completeTask = async (req, res) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const id = extractId(url.pathname);
        const result = await services_1.taskService.complete(id);
        sendJson(res, result.success ? 200 : 404, result);
    }
    catch (e) {
        logger_1.logger.error('[Route] completeTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.completeTask = completeTask;
// POST /api/tasks/:id/transition - 状态变更
const transitionTask = async (req, res) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const id = extractId(url.pathname);
        const body = await parseBody(req);
        if (!body.to_status) {
            sendJson(res, 400, {
                success: false,
                error: { code: 400, message: 'to_status is required' }
            });
            return;
        }
        const validStatuses = ['pending', 'in_progress', 'cancelled'];
        if (!validStatuses.includes(body.to_status)) {
            sendJson(res, 400, {
                success: false,
                error: { code: 400, message: 'to_status must be pending, in_progress, or cancelled' }
            });
            return;
        }
        const result = await services_1.taskService.transition(id, body.to_status);
        sendJson(res, result.success ? 200 : (result.error?.code === 2001 ? 404 : 400), result);
    }
    catch (e) {
        logger_1.logger.error('[Route] transitionTask error:', e);
        sendJson(res, 500, { success: false, error: { code: 500, message: 'Internal error' } });
    }
};
exports.transitionTask = transitionTask;
//# sourceMappingURL=task.routes.js.map