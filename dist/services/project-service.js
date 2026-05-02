"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = exports.ProjectService = void 0;
// 项目服务
const uuid_1 = require("uuid");
const feishu_1 = require("../connectors/feishu");
class ProjectService {
    /**
     * 创建项目
     */
    async createProject(intent) {
        const now = new Date().toISOString();
        const project = {
            id: (0, uuid_1.v4)(),
            type: 'project',
            title: intent.entity.title || '未命名项目',
            description: intent.entity.description,
            status: 'pending',
            priority: intent.entity.priority || '中',
            due_date: intent.entity.due_date,
            start_date: intent.entity.start_date,
            is_recurring: false,
            needs_expansion: intent.needsExpansion || false,
            expansion_type: intent.expansionType,
            created_at: now,
            updated_at: now,
        };
        return feishu_1.feishuConnector.create(project);
    }
    /**
     * 获取项目详情
     */
    async getProject(projectId) {
        return feishu_1.feishuConnector.get(projectId);
    }
    /**
     * 更新项目
     */
    async updateProject(projectId, updates) {
        return feishu_1.feishuConnector.update(projectId, {
            ...updates,
            updated_at: new Date().toISOString(),
        });
    }
    /**
     * 删除项目
     */
    async deleteProject(projectId) {
        return feishu_1.feishuConnector.delete(projectId);
    }
    /**
     * 获取项目下的所有任务
     */
    async getProjectTasks(projectId) {
        const allTasks = await feishu_1.feishuConnector.query({ type: 'task' });
        // Filter by project_name since the actual field is text, not an ID
        return allTasks.filter(t => t.project_name === projectId);
    }
    /**
     * 获取项目进度
     */
    async getProjectProgress(projectId) {
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
    async getAllProjects() {
        return feishu_1.feishuConnector.query({ type: 'project' });
    }
    /**
     * 搜索项目
     */
    async searchProjects(keyword) {
        const results = await feishu_1.feishuConnector.search(keyword);
        return results.filter(r => r.type === 'project');
    }
}
exports.ProjectService = ProjectService;
exports.projectService = new ProjectService();
//# sourceMappingURL=project-service.js.map