// 项目服务
import { v4 as uuidv4 } from 'uuid';
import { TaskEntity, ParsedIntent } from '../shared/types';
import { feishuConnector } from '../connectors/feishu';

export interface ProjectProgress {
  total: number;
  completed: number;
  percentage: number;
}

export class ProjectService {
  /**
   * 创建项目
   */
  async createProject(intent: ParsedIntent): Promise<TaskEntity> {
    const now = new Date().toISOString();
    const project: TaskEntity = {
      id: uuidv4(),
      type: 'project',
      title: intent.entity.title || '未命名项目',
      description: intent.entity.description,
      status: 'pending',
      priority: intent.entity.priority || 'medium',
      due_date: intent.entity.due_date,
      start_date: intent.entity.start_date,
      is_recurring: false,
      needs_expansion: intent.needsExpansion || false,
      expansion_type: intent.expansionType,
      created_at: now,
      updated_at: now,
    };

    return feishuConnector.create(project);
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<TaskEntity | null> {
    return feishuConnector.get(projectId);
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, updates: Partial<TaskEntity>): Promise<TaskEntity> {
    return feishuConnector.update(projectId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    return feishuConnector.delete(projectId);
  }

  /**
   * 获取项目下的所有任务
   */
  async getProjectTasks(projectId: string): Promise<TaskEntity[]> {
    return feishuConnector.query({ type: 'task', project_id: projectId });
  }

  /**
   * 获取项目进度
   */
  async getProjectProgress(projectId: string): Promise<ProjectProgress> {
    const tasks = await this.getProjectTasks(projectId);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * 获取所有项目
   */
  async getAllProjects(): Promise<TaskEntity[]> {
    return feishuConnector.query({ type: 'project' });
  }

  /**
   * 搜索项目
   */
  async searchProjects(keyword: string): Promise<TaskEntity[]> {
    const results = await feishuConnector.search(keyword);
    return results.filter(r => r.type === 'project');
  }
}

export const projectService = new ProjectService();