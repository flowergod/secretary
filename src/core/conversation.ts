// 对话处理核心
import { nlParser } from '../parser/nl-parser';
import { taskService } from '../services/task-service';
import { scheduleService } from '../services/schedule-service';
import { projectService } from '../services/project-service';
import { feishuConnector } from '../connectors/feishu';
import { responseFormatter } from './response-formatter';

export interface ConversationRequest {
  userId?: string;
  message: string;
}

export interface ConversationResponse {
  content: string;
  success: boolean;
}

export class ConversationEngine {
  /**
   * 处理用户对话
   */
  async process(request: ConversationRequest): Promise<ConversationResponse> {
    try {
      const { message } = request;

      // 解析用户意图
      const intents = nlParser.parse(message);

      if (intents.length === 0) {
        return {
          content: '抱歉，我没有理解您的意思。请尝试更详细的描述。',
          success: false,
        };
      }

      // 处理第一个意图
      const intent = intents[0];

      switch (intent.action) {
        case 'create':
          return this.handleCreate(intent);

        case 'update':
          return this.handleUpdate(intent);

        case 'complete':
          return this.handleComplete(intent);

        case 'delete':
          return this.handleDelete(intent);

        case 'query':
          return this.handleQuery(intent);

        case 'search':
          return this.handleSearch(intent);

        default:
          return {
            content: '抱歉，该操作暂不支持。',
            success: false,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('[ConversationEngine] Error:', errorMessage);
      return {
        content: responseFormatter.formatError(`处理失败：${errorMessage}`),
        success: false,
      };
    }
  }

  /**
   * 处理创建操作
   */
  private async handleCreate(intent: any): Promise<ConversationResponse> {
    const { entityType, needsExpansion, expansionType } = intent;

    if (entityType === 'event') {
      const event = await scheduleService.createEvent(intent);
      return {
        content: responseFormatter.formatTaskCreated(event),
        success: true,
      };
    } else if (entityType === 'project') {
      const project = await projectService.createProject(intent);
      return {
        content: responseFormatter.formatTaskCreated(project),
        success: true,
      };
    } else {
      const { task, expansionSuggestion } = await taskService.createTask(intent);
      return {
        content: responseFormatter.formatTaskCreated(task, expansionSuggestion),
        success: true,
      };
    }
  }

  /**
   * 处理更新操作
   */
  private async handleUpdate(intent: any): Promise<ConversationResponse> {
    const { targetId, entity } = intent;

    if (!targetId) {
      return {
        content: '请指定要更新的任务ID。',
        success: false,
      };
    }

    if (entity.type === 'event' || entity.start_date) {
      const updated = await scheduleService.updateEvent(targetId, entity);
      return {
        content: responseFormatter.formatTaskCreated(updated, '已更新日程'),
        success: true,
      };
    } else if (entity.project_id) {
      const updated = await projectService.updateProject(targetId, entity);
      return {
        content: responseFormatter.formatTaskCreated(updated, '已更新项目'),
        success: true,
      };
    } else {
      const updated = await taskService.updateTask(targetId, entity);
      return {
        content: responseFormatter.formatTaskCreated(updated, '已更新任务'),
        success: true,
      };
    }
  }

  /**
   * 处理完成任务
   */
  private async handleComplete(intent: any): Promise<ConversationResponse> {
    const { entity, targetId } = intent;
    let taskId = targetId;

    // 如果没有指定 ID，尝试通过标题查找
    if (!taskId && entity.title) {
      const found = await taskService.findTaskByTitle(entity.title);
      if (found) {
        taskId = found.id;
      }
    }

    if (!taskId) {
      return {
        content: '找不到指定的任务。',
        success: false,
      };
    }

    const completed = await taskService.completeTask(taskId);
    return {
      content: responseFormatter.formatTaskCompleted(completed),
      success: true,
    };
  }

  /**
   * 处理删除操作
   */
  private async handleDelete(intent: any): Promise<ConversationResponse> {
    const { targetId, entityType } = intent;

    if (!targetId) {
      return {
        content: '请指定要删除的项目ID。',
        success: false,
      };
    }

    if (entityType === 'project') {
      await projectService.deleteProject(targetId);
    } else {
      await taskService.deleteTask(targetId);
    }

    return {
      content: '✓ 已删除',
      success: true,
    };
  }

  /**
   * 处理查询操作
   */
  private async handleQuery(intent: any): Promise<ConversationResponse> {
    const { queryType } = intent;

    switch (queryType) {
      case 'today_schedule':
        const todayEvents = await scheduleService.getTodayEvents();
        return {
          content: responseFormatter.formatScheduleList(todayEvents),
          success: true,
        };

      case 'tomorrow_schedule':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowEvents = await scheduleService.queryEventsByDateRange(tomorrowStr, tomorrowStr);
        return {
          content: responseFormatter.formatScheduleList(tomorrowEvents, tomorrowStr),
          success: true,
        };

      case 'week_schedule': {
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEvents = await scheduleService.queryEventsByDateRange(
          weekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        );
        return {
          content: responseFormatter.formatScheduleList(weekEvents, '本周'),
          success: true,
        };
      }

      default:
        // 默认查询所有待处理任务
        const pendingTasks = await taskService.queryTasks({ status: 'pending' });
        return {
          content: responseFormatter.formatSearchResults(pendingTasks, '待处理任务'),
          success: true,
        };
    }
  }

  /**
   * 处理搜索操作
   */
  private async handleSearch(intent: any): Promise<ConversationResponse> {
    const { searchQuery } = intent;

    if (!searchQuery) {
      return {
        content: '请指定搜索关键词。',
        success: false,
      };
    }

    const results = await feishuConnector.search(searchQuery);
    return {
      content: responseFormatter.formatSearchResults(results, searchQuery),
      success: true,
    };
  }
}

export const conversationEngine = new ConversationEngine();