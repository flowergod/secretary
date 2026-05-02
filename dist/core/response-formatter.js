"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseFormatter = exports.ResponseFormatter = void 0;
class ResponseFormatter {
    /**
     * 格式化任务创建确认
     */
    formatTaskCreated(task, suggestion) {
        let response = `✓ 已添加${this.formatEntityType(task.type)}「${task.title}」\n`;
        if (task.start_date) {
            response += `- 日期：${task.start_date}`;
            if (task.start_time) {
                response += ` ${task.start_time}`;
            }
            response += '\n';
        }
        if (task.due_date) {
            response += `- 截止日期：${task.due_date}\n`;
        }
        response += `- 优先级：${this.formatPriority(task.priority)}\n`;
        response += `- 状态：${this.formatStatus(task.status)}\n`;
        if (suggestion) {
            response += `\n💡 提示：${suggestion}`;
        }
        return response;
    }
    /**
     * 格式化任务完成确认
     */
    formatTaskCompleted(task) {
        let response = `✓ 已完成任务「${task.title}」`;
        if (task.completion_date) {
            response += `\n完成时间：${this.formatDateTime(task.completion_date)}`;
        }
        return response;
    }
    /**
     * 格式化日程列表
     */
    formatScheduleList(events, date) {
        if (events.length === 0) {
            return date ? `【${date}】没有安排的事项。` : '没有安排的事项。';
        }
        const dateLabel = date || '今天';
        let response = `【${dateLabel}】共有${events.length}件事：\n`;
        const sorted = [...events].sort((a, b) => {
            if (!a.start_time || !b.start_time)
                return 0;
            return a.start_time.localeCompare(b.start_time);
        });
        for (const event of sorted) {
            const time = event.start_time || '全天';
            response += `- ${time} ${event.title}\n`;
        }
        return response;
    }
    /**
     * 格式化搜索结果
     */
    formatSearchResults(results, query) {
        if (results.length === 0) {
            return query ? `没有找到与"${query}"相关的记录。` : '没有找到相关记录。';
        }
        let response = query ? `找到${results.length}条与"${query}"相关的记录：\n` : `找到${results.length}条记录：\n`;
        for (const item of results.slice(0, 10)) {
            const date = item.due_date || item.start_date || '无日期';
            const typeIcon = this.getEntityTypeIcon(item.type);
            response += `${typeIcon} [${this.formatEntityType(item.type)}] ${item.title} (${date})\n`;
        }
        if (results.length > 10) {
            response += `...还有${results.length - 10}条记录`;
        }
        return response;
    }
    /**
     * 格式化项目进度
     */
    formatProjectProgress(project, progress) {
        let response = `📋 项目「${project.title}」进度：\n`;
        response += `  总任务数：${progress.total}\n`;
        response += `  已完成：${progress.completed}\n`;
        response += `  进度：${progress.percentage}%\n`;
        if (progress.total > 0) {
            const barLength = 20;
            const filled = Math.round((progress.percentage / 100) * barLength);
            const empty = barLength - filled;
            response += `  [${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
        }
        return response;
    }
    /**
     * 格式化错误消息
     */
    formatError(message) {
        return `❌ 错误：${message}`;
    }
    /**
     * 格式化帮助信息
     */
    formatHelp() {
        return `📖 项目管理 AI 助理使用指南

**任务管理**
- 创建任务：帮我安排明天上午10点开会
- 完成任务：完成任务A
- 查询任务：今天有什么任务？

**日程管理**
- 查看日程：今天有什么安排？
- 明天日程：明天有什么计划？

**项目管理**
- 创建项目：项目A需要在5月15日前完成
- 查看进度：项目A的进度怎么样了？

**循环任务**
- 定期提醒：每两周提醒我做一次体检
- 完成后循环：看完医生后3个月提醒复查

**智能拓展**
- 创建任务时标记 needs_expansion 会自动询问是否需要规划后续步骤`;
    }
    formatEntityType(type) {
        const map = {
            task: '任务',
            event: '日程',
            project: '项目',
        };
        return map[type] || type;
    }
    formatPriority(priority) {
        const map = {
            high: '高',
            medium: '中',
            low: '低',
        };
        return map[priority] || priority;
    }
    formatStatus(status) {
        const map = {
            pending: '待处理',
            in_progress: '进行中',
            completed: '已完成',
            cancelled: '已取消',
        };
        return map[status] || status;
    }
    formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    getEntityTypeIcon(type) {
        const map = {
            task: '📝',
            event: '📅',
            project: '📋',
        };
        return map[type] || '📄';
    }
}
exports.ResponseFormatter = ResponseFormatter;
exports.responseFormatter = new ResponseFormatter();
//# sourceMappingURL=response-formatter.js.map