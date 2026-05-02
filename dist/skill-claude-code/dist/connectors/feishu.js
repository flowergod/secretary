"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feishuConnector = exports.FeishuConnector = void 0;
const retry_1 = require("../shared/retry");
const config_1 = require("../shared/config");
// 飞书表格实际字段名映射
const FIELD_MAP = {
    '序号': 'seq',
    '任务名称': 'title',
    '分组': 'group',
    '优先级': 'priority',
    '状态': 'status',
    '计划日期': 'due_date',
    '日历分类': 'calendar_category',
    '循环类型': 'recurrence_type',
    '循环规则': 'recurrence_rule',
    '完成次数': 'completion_count',
    '链接': 'url',
    '标签': 'tags',
    '备注': 'description',
    '飞书日历事件ID': 'feishu_event_id',
    'iCloud事件ID': 'icloud_event_id',
    '来源文本': 'source_text',
    '开始时间': 'start_time',
    '结束时间': 'end_time',
    '项目': 'project_name',
    '子项目': 'subproject',
};
// 状态映射
const STATUS_MAP = {
    '待规划': '待规划',
    '待执行': 'pending',
    '进行中': 'in_progress',
    '已完成': 'completed',
    '暂停': 'cancelled',
};
// 反向状态映射
const STATUS_REVERSE_MAP = {
    'pending': '待执行',
    'in_progress': '进行中',
    'completed': '已完成',
    'cancelled': '暂停',
    '待规划': '待规划',
    '待执行': '待执行',
    '进行中': '进行中',
    '已完成': '已完成',
    '暂停': '暂停',
};
class FeishuConnector {
    constructor() {
        this.tokenExpiry = 0;
        const config = config_1.configManager.get();
        this.tableToken = config.feishu.tableToken;
        this.tableId = config.feishu.tableId;
        this.appId = config.feishu.appId;
        this.appSecret = config.feishu.appSecret;
        this.webhookUrl = config.feishu.webhookUrl;
    }
    /**
     * 获取访问令牌
     */
    async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: this.appId,
                app_secret: this.appSecret,
            }),
        });
        const data = await response.json();
        if (data.code !== 0) {
            throw new Error(`Failed to get access token: ${data.code}`);
        }
        this.accessToken = data.tenant_access_token;
        this.tokenExpiry = Date.now() + (data.expire - 60) * 1000; // 提前1分钟过期
        return this.accessToken;
    }
    /**
     * 创建任务/日程/项目记录
     */
    async create(entity) {
        return (0, retry_1.withRetry)(async () => {
            const fields = this.entityToFields(entity);
            const response = await this.executeFeishuAPI('POST', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records`, { fields });
            const recordId = response?.data?.record?.record_id;
            return {
                ...entity,
                id: recordId || entity.id,
            };
        });
    }
    /**
     * 更新任务/日程/项目记录
     */
    async update(id, entity) {
        return (0, retry_1.withRetry)(async () => {
            const fields = this.entityToFields(entity);
            await this.executeFeishuAPI('PUT', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${id}`, { fields });
            return { ...entity, id, updated_at: new Date().toISOString() };
        });
    }
    /**
     * 删除记录
     */
    async delete(id) {
        return (0, retry_1.withRetry)(async () => {
            await this.executeFeishuAPI('DELETE', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${id}`);
        });
    }
    /**
     * 获取单个记录
     */
    async get(id) {
        const response = await this.executeFeishuAPI('GET', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${id}`);
        if (!response?.data?.record) {
            return null;
        }
        return this.fieldsToEntity(response.data.record.fields, id);
    }
    /**
     * 查询记录列表
     */
    async query(filter) {
        const conditions = [];
        // 根据分组筛选类型
        if (filter?.type === 'event' || filter?.type === '日程表') {
            conditions.push({ field_name: '分组', operator: 'is', value: ['日程表'] });
        }
        else if (filter?.type === 'task' || filter?.type === 'project') {
            conditions.push({ field_name: '分组', operator: 'is_not', value: ['日程表'] });
        }
        if (filter?.status && STATUS_MAP[filter.status]) {
            conditions.push({ field_name: '状态', operator: 'is', value: [STATUS_MAP[filter.status]] });
        }
        if (filter?.priority) {
            conditions.push({ field_name: '优先级', operator: 'is', value: [filter.priority] });
        }
        const response = await this.executeFeishuAPI('POST', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/search`, {
            filter: conditions.length > 0 ? { conjunction: 'and', conditions } : undefined,
            page_size: 100,
        });
        const records = response?.data?.records || [];
        return records.map((record, index) => this.fieldsToEntity(record.fields, record.record_id || `record_${index}`));
    }
    /**
     * 搜索记录（支持模糊匹配）
     */
    async search(keyword) {
        const response = await this.executeFeishuAPI('POST', `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/search`, {
            filter: {
                conjunction: 'or',
                conditions: [
                    { field_name: '任务名称', operator: 'contains', value: [keyword] },
                    { field_name: '备注', operator: 'contains', value: [keyword] },
                    { field_name: '项目', operator: 'contains', value: [keyword] },
                ],
            },
            page_size: 100,
        });
        const records = response?.data?.records || [];
        return records.map((record, index) => this.fieldsToEntity(record.fields, record.record_id || `record_${index}`));
    }
    /**
     * 发送飞书消息
     */
    async sendMessage(content) {
        if (!this.webhookUrl) {
            console.warn('[FeishuConnector] Webhook URL not configured');
            return;
        }
        await fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                msg_type: 'text',
                content: { text: content },
            }),
        });
    }
    async executeFeishuAPI(method, path, body) {
        const url = `https://open.feishu.cn/open-apis${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this.getAccessToken()}`,
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Feishu API error: ${response.status} ${errorText}`);
        }
        return response.json();
    }
    /**
     * 将 TaskEntity 转换为飞书字段格式
     */
    entityToFields(entity) {
        const fields = {};
        if (entity.title !== undefined)
            fields['任务名称'] = entity.title;
        if (entity.description !== undefined)
            fields['备注'] = entity.description;
        if (entity.status !== undefined)
            fields['状态'] = STATUS_REVERSE_MAP[entity.status] || entity.status;
        if (entity.priority !== undefined)
            fields['优先级'] = entity.priority;
        if (entity.due_date !== undefined)
            fields['计划日期'] = this.parseDateToTimestamp(entity.due_date);
        if (entity.start_time !== undefined)
            fields['开始时间'] = this.parseTimeToTimestamp(entity.start_time, entity.start_date);
        if (entity.end_time !== undefined)
            fields['结束时间'] = this.parseTimeToTimestamp(entity.end_time, entity.start_date);
        if (entity.recurrence_type !== undefined)
            fields['循环类型'] = entity.recurrence_type;
        if (entity.recurrence_rule !== undefined)
            fields['循环规则'] = typeof entity.recurrence_rule === 'string' ? entity.recurrence_rule : JSON.stringify(entity.recurrence_rule);
        if (entity.completion_count !== undefined)
            fields['完成次数'] = entity.completion_count;
        if (entity.url !== undefined)
            fields['链接'] = entity.url;
        if (entity.tags !== undefined)
            fields['标签'] = entity.tags;
        if (entity.source_text !== undefined)
            fields['来源文本'] = entity.source_text;
        if (entity.feishu_event_id !== undefined)
            fields['飞书日历事件ID'] = entity.feishu_event_id;
        if (entity.icloud_event_id !== undefined)
            fields['iCloud事件ID'] = entity.icloud_event_id;
        if (entity.project_name !== undefined)
            fields['项目'] = entity.project_name;
        if (entity.subproject !== undefined)
            fields['子项目'] = entity.subproject;
        if (entity.calendar_category !== undefined)
            fields['日历分类'] = entity.calendar_category;
        // 根据 type 设置分组
        if (entity.type !== undefined) {
            if (entity.type === 'event') {
                fields['分组'] = '日程表';
            }
            else if (entity.group !== undefined) {
                fields['分组'] = entity.group;
            }
        }
        return fields;
    }
    /**
     * 将飞书字段转换为 TaskEntity
     */
    fieldsToEntity(fields, id) {
        const entity = { id };
        for (const [fieldName, value] of Object.entries(fields)) {
            const key = FIELD_MAP[fieldName];
            if (!key)
                continue;
            switch (key) {
                case 'title':
                    // 飞书文本类型是一个对象 { text: string }
                    entity[key] = this.extractTextValue(value);
                    break;
                case 'group':
                    entity.group = value;
                    // 根据分组判断类型
                    if (value === '日程表') {
                        entity.type = 'event';
                    }
                    else {
                        entity.type = 'task';
                    }
                    break;
                case 'priority':
                case 'status':
                case 'recurrence_type':
                case 'calendar_category':
                case 'project_name':
                case 'subproject':
                case 'source_text':
                case 'feishu_event_id':
                case 'icloud_event_id':
                    entity[key] = this.extractTextValue(value) || value;
                    break;
                case 'description':
                case 'recurrence_rule':
                case 'url':
                    entity[key] = this.extractTextValue(value) || value;
                    break;
                case 'due_date':
                case 'start_time':
                case 'end_time':
                    // 时间戳
                    entity[key] = typeof value === 'number' ? this.timestampToISOString(value) : value;
                    break;
                case 'completion_count':
                    entity[key] = typeof value === 'number' ? value : parseFloat(value) || 0;
                    break;
                case 'tags':
                    // 多选类型是数组
                    entity[key] = Array.isArray(value) ? value.map(v => this.extractTextValue(v)).filter((v) => v !== undefined) : [];
                    break;
            }
        }
        // 处理循环类型 -> is_recurring
        const recType = entity.recurrence_type;
        if (recType && recType !== '不循环' && recType !== 'none') {
            entity.is_recurring = true;
        }
        else {
            entity.is_recurring = false;
            entity.recurrence_type = 'none';
        }
        return entity;
    }
    /**
     * 提取飞书文本类型的值
     */
    extractTextValue(value) {
        if (typeof value === 'string')
            return value;
        if (typeof value === 'object' && value !== null && 'text' in value) {
            return String(value.text);
        }
        return undefined;
    }
    /**
     * 解析日期字符串为时间戳
     */
    parseDateToTimestamp(dateStr) {
        if (typeof dateStr === 'number')
            return dateStr;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    /**
     * 解析时间字符串 (HH:mm) 结合日期为时间戳
     */
    parseTimeToTimestamp(timeStr, dateStr) {
        if (typeof timeStr === 'number')
            return timeStr;
        if (!timeStr)
            return 0;
        // 如果是时间字符串 HH:mm 格式
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const hour = parseInt(timeMatch[1], 10);
            const minute = parseInt(timeMatch[2], 10);
            // 如果有日期，结合日期
            if (dateStr) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    date.setHours(hour, minute, 0, 0);
                    return date.getTime();
                }
            }
            // 没有日期，返回当天的时间戳（从 epoch 算起）
            const today = new Date();
            today.setHours(hour, minute, 0, 0);
            return today.getTime();
        }
        // 否则当作普通日期解析
        return this.parseDateToTimestamp(timeStr);
    }
    /**
     * 将时间戳转换为 ISO 字符串
     */
    timestampToISOString(timestamp) {
        return new Date(timestamp).toISOString();
    }
}
exports.FeishuConnector = FeishuConnector;
exports.feishuConnector = new FeishuConnector();
//# sourceMappingURL=feishu.js.map