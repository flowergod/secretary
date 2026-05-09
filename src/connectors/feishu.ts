// 飞书表格 Connector v2.0
import { Task, TaskStatus, TaskPriority, RecurrenceType } from '../shared/types';
import { configManager, logger } from '../shared';

interface FeishuResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface FeishuRecord {
  record_id?: string;
  fields: Record<string, unknown>;
}

// 飞书字段名映射
const FIELD_MAP: Record<string, string> = {
  '任务ID': 'id',
  '飞书记录ID': 'record_id',
  '任务名称': 'title',
  '描述': 'description',
  '状态': 'status',
  '优先级': 'priority',
  '分类': 'category',
  '截止日期': 'due_date',
  '开始日期': 'start_date',
  '开始时间': 'start_time',
  '结束时间': 'end_time',
  '是否循环': 'is_recurring',
  '循环类型': 'recurrence_type',
  '循环规则': 'recurrence_rule',
  'iCloud事件ID': 'icloud_event_id',
  '父任务ID': 'parent_id',
  '来源': 'source',
  '创建时间': 'created_at',
  '更新时间': 'updated_at',
};

// 状态映射：飞书存储值 -> 内部枚举
const STATUS_MAP: Record<string, TaskStatus> = {
  '待处理': 'pending',
  '进行中': 'in_progress',
  '已完成': 'completed',
  '已取消': 'cancelled',
};

// 反向状态映射：内部枚举 -> 飞书存储值
const STATUS_REVERSE_MAP: Record<TaskStatus, string> = {
  'pending': '待处理',
  'in_progress': '进行中',
  'completed': '已完成',
  'cancelled': '已取消',
};

// 优先级映射
const PRIORITY_MAP: Record<string, TaskPriority> = {
  '高': 'high',
  '中': 'medium',
  '低': 'low',
};

const PRIORITY_REVERSE_MAP: Record<TaskPriority, string> = {
  'high': '高',
  'medium': '中',
  'low': '低',
};

// 循环类型映射
const RECURRENCE_TYPE_MAP: Record<string, RecurrenceType> = {
  '不循环': 'none',
  'none': 'none',
  '每天': 'daily',
  'daily': 'daily',
  '每周': 'weekly',
  'weekly': 'weekly',
  '每周N次': 'weekly_n',
  'weekly_n': 'weekly_n',
  '每月': 'monthly',
  'monthly': 'monthly',
  '每月N次': 'monthly_n',
  'monthly_n': 'monthly_n',
  '每年': 'yearly',
  'yearly': 'yearly',
  '每年N次': 'yearly_n',
  'yearly_n': 'yearly_n',
};

const RECURRENCE_REVERSE_MAP: Record<RecurrenceType, string> = {
  'none': '不循环',
  'daily': '每天',
  'weekly': '每周',
  'weekly_n': '每周N次',
  'monthly': '每月',
  'monthly_n': '每月N次',
  'yearly': '每年',
  'yearly_n': '每年N次',
};

export class FeishuConnector {
  private tableToken: string;
  private tableId: string;
  private appId: string;
  private appSecret: string;
  private accessToken?: string;
  private tokenExpiry: number = 0;

  constructor() {
    const config = configManager.get();
    this.tableToken = config.feishu.tableToken;
    this.tableId = config.feishu.tableId;
    this.appId = config.feishu.appId;
    this.appSecret = config.feishu.appSecret;
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
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

    const data = await response.json() as { code: number; msg?: string; tenant_access_token: string; expire: number };
    if (data.code !== 0) {
      throw new Error(`Failed to get access token: ${data.code} ${data.msg || ''}`);
    }

    this.accessToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire - 60) * 1000;
    return this.accessToken;
  }

  /**
   * 执行飞书 API
   */
  private async executeAPI<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `https://open.feishu.cn/open-apis${path}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${await this.getAccessToken()}`,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Feishu API error: ${response.status} ${errorText}`);
    }

    const result = await response.json() as T;

    // 检查飞书API响应码（code !== 0 表示失败）
    if (typeof result === 'object' && result !== null && 'code' in result) {
      const code = (result as { code: number }).code;
      if (code !== 0) {
        const msg = (result as { msg?: string }).msg || 'Unknown error';
        throw new Error(`Feishu API error: code=${code} ${msg}`);
      }
    }

    return result;
  }

  /**
   * 创建任务记录
   */
  async create(task: Task): Promise<Task> {
    const fields = this.taskToFields(task);
    logger.debug(`[FeishuConnector] create fields: ${JSON.stringify(fields)}`);
    const response = await this.executeAPI<FeishuResponse<{ record: FeishuRecord }>>(
      'POST',
      `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records`,
      { fields }
    );

    const recordId = response.data?.record?.record_id;
    if (!recordId) {
      throw new Error('Failed to create record: no record_id returned');
    }

    // 创建成功后，将 record_id 写回到飞书表格的"飞书记录ID"字段
    await this.executeAPI(
      'PUT',
      `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${recordId}`,
      { fields: { '飞书记录ID': recordId } }
    );

    return { ...task, id: recordId, record_id: recordId };
  }

  /**
   * 更新任务记录
   * @param id 任务ID（用户设置的ID或record_id）
   * @param updates 要更新的字段
   * @param recordId record_id（用于API调用，可选）
   */
  async update(id: string, updates: Partial<Task>, recordId?: string): Promise<Task> {
    const fields = this.taskToFields(updates as Task);
    // 优先使用传入的recordId，否则用id（可能是用户ID或recordId）
    const apiId = recordId || id;
    await this.executeAPI(
      'PUT',
      `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${apiId}`,
      { fields }
    );

    // 获取更新后的完整记录
    const updated = await this.get(apiId);
    if (!updated) {
      throw new Error(`Task not found after update: ${apiId}`);
    }
    return updated;
  }

  /**
   * 删除任务记录
   */
  async delete(id: string): Promise<void> {
    await this.executeAPI(
      'DELETE',
      `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${id}`
    );
  }

  /**
   * 获取单个任务
   * 支持通过record_id或任务ID字段查询
   */
  async get(id: string): Promise<Task | null> {
    // 尝试直接用record_id获取
    try {
      const response = await this.executeAPI<FeishuResponse<{ record: FeishuRecord }>>(
        'GET',
        `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/${id}`
      );

      if (response.data?.record) {
        return this.fieldsToTask(response.data.record.fields, id);
      }
    } catch (e) {
      // record_id不存在，可能是任务ID字段，尝试搜索
    }

    // 如果record_id查询失败，尝试通过任务ID字段搜索
    const listResult = await this.list({ page_size: 100 });
    for (const task of listResult.items) {
      if (task.id === id) {
        return task;
      }
    }

    return null;
  }

  /**
   * 查询任务列表
   */
  async list(filter?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    category?: string;
    due_date_from?: string;
    due_date_to?: string;
    start_date_from?: string;
    start_date_to?: string;
    is_recurring?: boolean;
    parent_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: Task[]; total: number }> {
    const conditions: Array<{
      field_name: string;
      operator: string;
      value: unknown[];
    }> = [];

    if (filter?.status) {
      conditions.push({
        field_name: '状态',
        operator: 'is',
        value: [STATUS_REVERSE_MAP[filter.status]],
      });
    }

    if (filter?.priority) {
      conditions.push({
        field_name: '优先级',
        operator: 'is',
        value: [PRIORITY_REVERSE_MAP[filter.priority]],
      });
    }

    if (filter?.category) {
      conditions.push({
        field_name: '分类',
        operator: 'is',
        value: [filter.category],
      });
    }

    if (filter?.is_recurring !== undefined) {
      conditions.push({
        field_name: '是否循环',
        operator: filter.is_recurring ? 'isNotEmpty' : 'isEmpty',
        value: [],
      });
    }

    if (filter?.parent_id !== undefined) {
      conditions.push({
        field_name: '父任务ID',
        operator: filter.parent_id ? 'is' : 'isEmpty',
        value: filter.parent_id ? [filter.parent_id] : [],
      });
    }

    const pageSize = Math.min(filter?.page_size || 20, 100);
    const page = filter?.page || 1;

    // 记录需要客户端过滤的日期条件（飞书 API 不支持日期范围过滤）
    const dueDateFrom = filter?.due_date_from;
    const dueDateTo = filter?.due_date_to;
    const startDateFrom = filter?.start_date_from;
    const startDateTo = filter?.start_date_to;

    // 不向飞书 API 添加日期过滤条件（会导致 InvalidFilter 错误）
    // 日期过滤将在获取结果后在客户端进行

    const response = await this.executeAPI<FeishuResponse<{ items: FeishuRecord[]; total: number }>>(
      'POST',
      `/bitable/v1/apps/${this.tableToken}/tables/${this.tableId}/records/search`,
      {
        filter: conditions.length > 0 ? { conjunction: 'and', conditions } : undefined,
        page_size: pageSize,
        page: page,
      }
    );

    let items = (response.data?.items || []).map((record) =>
      this.fieldsToTask(record.fields, record.record_id || '')
    );

    // 客户端日期过滤（飞书 API 不支持日期范围查询）
    if (dueDateFrom) {
      items = items.filter(item => item.due_date && item.due_date >= dueDateFrom);
    }
    if (dueDateTo) {
      items = items.filter(item => item.due_date && item.due_date <= dueDateTo);
    }
    if (startDateFrom) {
      items = items.filter(item => item.start_date && item.start_date >= startDateFrom);
    }
    if (startDateTo) {
      items = items.filter(item => item.start_date && item.start_date <= startDateTo);
    }

    return {
      items,
      total: items.length,
    };
  }

  /**
   * 批量删除任务
   */
  async batchDelete(ids: string[]): Promise<{ deleted: number; failed: number; errors: string[] }> {
    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        // 先获取任务，获得record_id
        const task = await this.get(id);
        if (!task) {
          failed++;
          errors.push(`${id}: Task not found`);
          continue;
        }

        // 使用record_id删除
        const deleteId = task.record_id || id;
        await this.delete(deleteId);
        deleted++;
      } catch (e) {
        failed++;
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { deleted, failed, errors };
  }

  /**
   * 将 Task 转换为飞书字段格式
   */
  private taskToFields(task: Partial<Task>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    if (task.id !== undefined) fields['任务ID'] = task.id;
    if (task.record_id !== undefined) fields['飞书记录ID'] = task.record_id;
    if (task.title !== undefined) fields['任务名称'] = task.title;
    if (task.description !== undefined) fields['描述'] = task.description;
    if (task.status !== undefined) fields['状态'] = STATUS_REVERSE_MAP[task.status];
    if (task.priority !== undefined) fields['优先级'] = PRIORITY_REVERSE_MAP[task.priority];
    if (task.category !== undefined) fields['分类'] = task.category;
    if (task.due_date !== undefined) fields['截止日期'] = task.due_date;
    if (task.start_date !== undefined) fields['开始日期'] = task.start_date;
    if (task.start_time !== undefined) fields['开始时间'] = task.start_time;
    if (task.end_time !== undefined) fields['结束时间'] = task.end_time;
    if (task.is_recurring !== undefined) fields['是否循环'] = task.is_recurring ? ['循环'] : [];
    if (task.recurrence_type !== undefined) fields['循环类型'] = RECURRENCE_REVERSE_MAP[task.recurrence_type];
    if (task.recurrence_rule !== undefined) fields['循环规则'] = task.recurrence_rule;
    if (task.icloud_event_id !== undefined) fields['iCloud事件ID'] = task.icloud_event_id;
    if (task.parent_id !== undefined) fields['父任务ID'] = task.parent_id;
    if (task.source !== undefined) fields['来源'] = task.source;
    if (task.created_at !== undefined) fields['创建时间'] = task.created_at;
    if (task.updated_at !== undefined) fields['更新时间'] = task.updated_at;

    return fields;
  }

  /**
   * 将飞书字段转换为 Task
   */
  private fieldsToTask(fields: Record<string, unknown>, recordId: string): Task {
    // 优先使用任务ID字段（用户设置的ID），否则使用record_id（系统生成的ID）
    const taskIdField = this.extractTextValue(fields['任务ID']);
    const id = taskIdField && taskIdField.trim() !== '' ? taskIdField : recordId;
    const task: Record<string, unknown> = { id, record_id: recordId };

    for (const [fieldName, value] of Object.entries(fields)) {
      const key = FIELD_MAP[fieldName];
      if (!key) continue;

      // 跳过 id 和 record_id 字段，使用传入的 recordId 作为权威值
      if (key === 'id' || key === 'record_id') continue;

      switch (key) {
        case 'title':
          task[key] = this.extractTextValue(value);
          break;
        case 'status':
          task[key] = STATUS_MAP[this.extractTextValue(value) as string] || 'pending';
          break;
        case 'priority':
          task[key] = PRIORITY_MAP[this.extractTextValue(value) as string] || 'medium';
          break;
        case 'recurrence_type':
          task[key] = RECURRENCE_TYPE_MAP[this.extractTextValue(value) as string] || 'none';
          break;
        case 'is_recurring':
          task[key] = Array.isArray(value) && value.length > 0;
          break;
        case 'description':
        case 'category':
        case 'due_date':
        case 'start_date':
        case 'start_time':
        case 'end_time':
        case 'recurrence_rule':
        case 'icloud_event_id':
        case 'parent_id':
        case 'source':
        case 'created_at':
        case 'updated_at':
          task[key] = this.extractTextValue(value) || value;
          break;
        default:
          task[key] = value;
      }
    }

    // 确保必填字段有默认值
    task.title = task.title || '未命名任务';
    task.status = task.status || 'pending';
    task.priority = task.priority || 'medium';
    task.recurrence_type = task.recurrence_type || 'none';
    task.is_recurring = task.is_recurring || false;
    task.created_at = task.created_at || new Date().toISOString();
    task.updated_at = task.updated_at || new Date().toISOString();

    return task as unknown as Task;
  }

  /**
   * 提取飞书文本类型的值
   */
  private extractTextValue(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.map(v => this.extractTextValue(v)).filter(v => v !== undefined).join('');
    }
    if (typeof value === 'object' && value !== null && 'text' in value) {
      return String((value as { text: unknown }).text);
    }
    return undefined;
  }
}

export const feishuConnector = new FeishuConnector();
