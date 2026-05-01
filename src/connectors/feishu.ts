// 飞书表格 Connector
import { TaskEntity } from '../shared/types';
import { withRetry, RetryError } from '../shared/retry';
import { configManager } from '../shared/config';

interface FeishuResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface FeishuTableRow {
  fields: Record<string, unknown>;
}

export class FeishuConnector {
  private tableToken: string;
  private webhookUrl: string;

  constructor() {
    const config = configManager.get();
    this.tableToken = config.feishu.tableToken;
    this.webhookUrl = config.feishu.webhookUrl;
  }

  /**
   * 创建任务/日程/项目记录
   */
  async create(entity: TaskEntity): Promise<TaskEntity> {
    return withRetry(async () => {
      const fields = this.entityToFields(entity);
      const response = await this.executeFeishuAPI('POST', '/bitable/v1/apps/{table_token}/records', {
        records: [{ fields }],
      });

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
  async update(id: string, entity: Partial<TaskEntity>): Promise<TaskEntity> {
    return withRetry(async () => {
      const fields = this.entityToFields(entity as TaskEntity);
      await this.executeFeishuAPI('PUT', `/bitable/v1/apps/{table_token}/records/${id}`, {
        fields,
      });

      return { ...entity, id, updated_at: new Date().toISOString() } as TaskEntity;
    });
  }

  /**
   * 删除记录
   */
  async delete(id: string): Promise<void> {
    return withRetry(async () => {
      await this.executeFeishuAPI('DELETE', `/bitable/v1/apps/{table_token}/records/${id}`);
    });
  }

  /**
   * 获取单个记录
   */
  async get(id: string): Promise<TaskEntity | null> {
    const response = await this.executeFeishuAPI<FeishuResponse<{ record: FeishuTableRow }>>(
      'GET',
      `/bitable/v1/apps/{table_token}/records/${id}`
    );

    if (!response?.data?.record) {
      return null;
    }

    return this.fieldsToEntity(response.data.record.fields, id);
  }

  /**
   * 查询记录列表
   */
  async query(filter?: {
    type?: string;
    status?: string;
    priority?: string;
    start_date?: string;
    due_date?: string;
  }): Promise<TaskEntity[]> {
    const conditions: string[] = [];

    if (filter?.type) {
      conditions.push(`[类型] = "${filter.type}"`);
    }
    if (filter?.status) {
      conditions.push(`[状态] = "${filter.status}"`);
    }
    if (filter?.priority) {
      conditions.push(`[优先级] = "${filter.priority}"`);
    }

    const filterStr = conditions.length > 0 ? conditions.join(' AND ') : '';

    const response = await this.executeFeishuAPI<FeishuResponse<{ records: FeishuTableRow[] }>>(
      'POST',
      '/bitable/v1/apps/{table_token}/records/search',
      {
        filter: filterStr ? { conjunction: 'and', conditions: [{ field_name: '条件', operator: 'is', value: [filterStr] }] } : undefined,
        page_size: 100,
      }
    );

    const records = response?.data?.records || [];
    return records.map((record, index) => this.fieldsToEntity(record.fields, `record_${index}`));
  }

  /**
   * 搜索记录（支持模糊匹配）
   */
  async search(keyword: string): Promise<TaskEntity[]> {
    const response = await this.executeFeishuAPI<FeishuResponse<{ records: FeishuTableRow[] }>>(
      'POST',
      '/bitable/v1/apps/{table_token}/records/search',
      {
        filter: {
          conjunction: 'or',
          conditions: [
            { field_name: '标题', operator: 'contains', value: [keyword] },
            { field_name: '描述', operator: 'contains', value: [keyword] },
          ],
        },
        page_size: 100,
      }
    );

    const records = response?.data?.records || [];
    return records.map((record, index) => this.fieldsToEntity(record.fields, `record_${index}`));
  }

  /**
   * 发送飞书消息
   */
  async sendMessage(content: string): Promise<void> {
    const payload = {
      msg_type: 'text',
      content: {
        text: content,
      },
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async executeFeishuAPI<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `https://open.feishu.cn${path}`.replace('{table_token}', this.tableToken);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAccessToken()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Feishu API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getAccessToken(): Promise<string> {
    // Note: In production, implement proper OAuth2 or use tenant access token
    // This is a simplified version
    return process.env.FEISHU_ACCESS_TOKEN || '';
  }

  private entityToFields(entity: TaskEntity): Record<string, unknown> {
    const fieldMap: Record<string, unknown> = {
      'ID': entity.id,
      '类型': entity.type,
      '标题': entity.title,
      '描述': entity.description || '',
      '状态': entity.status,
      '优先级': entity.priority,
      '截止日期': entity.due_date || '',
      '开始日期': entity.start_date || '',
      '开始时间': entity.start_time || '',
      '是否循环': entity.is_recurring ? '是' : '否',
      '循环类型': entity.recurrence_type || '',
      '循环规则': entity.recurrence_rule ? JSON.stringify(entity.recurrence_rule) : '',
      '父任务ID': entity.parent_id || '',
      '项目ID': entity.project_id || '',
      '完成时间': entity.completion_date || '',
      '需要拓展': entity.needs_expansion ? '是' : '否',
      '拓展类型': entity.expansion_type || '',
      '创建时间': entity.created_at,
      '更新时间': entity.updated_at,
    };

    return fieldMap;
  }

  private fieldsToEntity(fields: Record<string, unknown>, id: string): TaskEntity {
    const fieldNames: Record<string, string> = {
      'ID': 'id',
      '类型': 'type',
      '标题': 'title',
      '描述': 'description',
      '状态': 'status',
      '优先级': 'priority',
      '截止日期': 'due_date',
      '开始日期': 'start_date',
      '开始时间': 'start_time',
      '是否循环': 'is_recurring',
      '循环类型': 'recurrence_type',
      '循环规则': 'recurrence_rule',
      '父任务ID': 'parent_id',
      '项目ID': 'project_id',
      '完成时间': 'completion_date',
      '需要拓展': 'needs_expansion',
      '拓展类型': 'expansion_type',
      '创建时间': 'created_at',
      '更新时间': 'updated_at',
    };

    const entity: Record<string, unknown> = { id };

    for (const [fieldName, value] of Object.entries(fields)) {
      const key = fieldNames[fieldName] || fieldName;
      if (key === 'is_recurring') {
        entity[key] = value === '是' || value === true;
      } else if (key === 'needs_expansion') {
        entity[key] = value === '是' || value === true;
      } else if (key === 'recurrence_rule' && typeof value === 'string') {
        try {
          entity[key] = JSON.parse(value);
        } catch {
          entity[key] = value;
        }
      } else {
        entity[key] = value;
      }
    }

    return entity as unknown as TaskEntity;
  }
}

export const feishuConnector = new FeishuConnector();
