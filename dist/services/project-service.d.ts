import { TaskEntity, ParsedIntent } from '../shared/types';
export interface ProjectProgress {
    total: number;
    completed: number;
    percentage: number;
}
export declare class ProjectService {
    /**
     * 创建项目
     */
    createProject(intent: ParsedIntent): Promise<TaskEntity>;
    /**
     * 获取项目详情
     */
    getProject(projectId: string): Promise<TaskEntity | null>;
    /**
     * 更新项目
     */
    updateProject(projectId: string, updates: Partial<TaskEntity>): Promise<TaskEntity>;
    /**
     * 删除项目
     */
    deleteProject(projectId: string): Promise<void>;
    /**
     * 获取项目下的所有任务
     */
    getProjectTasks(projectId: string): Promise<TaskEntity[]>;
    /**
     * 获取项目进度
     */
    getProjectProgress(projectId: string): Promise<ProjectProgress>;
    /**
     * 获取所有项目
     */
    getAllProjects(): Promise<TaskEntity[]>;
    /**
     * 搜索项目
     */
    searchProjects(keyword: string): Promise<TaskEntity[]>;
}
export declare const projectService: ProjectService;
//# sourceMappingURL=project-service.d.ts.map