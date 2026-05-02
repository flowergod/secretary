"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nlParser = exports.NLParser = void 0;
// 时间表达式映射
const TIME_PATTERNS = {
    time: /(\d{1,2})[点时:](\d{0,2})/,
    date: /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})|(下[周个]?[一二三四五六日天]|本?[周个]?[一二三四五六日天]|今天|明天|后天|昨天|前天)/,
    interval: /每([\d]+)?(天|周|月|年|个小时?|分钟?|小时|分钟)/,
    afterComplete: /完成后?|之后?|之后?(\d+)天/,
};
// 优先级映射
const PRIORITY_MAP = {
    '高': '高',
    '高优先级': '高',
    '重要': '高',
    '紧急': '高',
    '中': '中',
    '中优先级': '中',
    '普通': '中',
    '低': '低',
    '低优先级': '低',
    '不急': '低',
};
// 动作词映射
const ACTION_MAP = {
    '创建': 'create',
    '添加': 'create',
    '新增': 'create',
    '新建': 'create',
    '安排': 'create',
    '修改': 'update',
    '更新': 'update',
    '改': 'update',
    '调整': 'update',
    '删除': 'delete',
    '删': 'delete',
    '移除': 'delete',
    '完成': 'complete',
    '标记完成': 'complete',
    '搞定': 'complete',
    '查询': 'query',
    '查找': 'search',
    '搜索': 'search',
    '找': 'search',
    '看': 'query',
};
// 类型词映射
const TYPE_MAP = {
    '任务': 'task',
    '待办': 'task',
    'todo': 'task',
    '会议': 'event',
    '日程': 'event',
    '约': 'event',
    '日历': 'event',
    '项目': 'project',
    '计划': 'project',
};
class NLParser {
    /**
     * 解析用户输入，提取意图和实体
     */
    parse(input) {
        const intents = [];
        const ctx = this.createContext(input);
        // 检测动作
        const action = this.detectAction(ctx);
        if (!action) {
            // 默认为查询
            intents.push(this.buildQueryIntent(ctx));
            return intents;
        }
        // 根据动作类型分别处理
        switch (action) {
            case 'create':
                intents.push(this.buildCreateIntent(ctx));
                break;
            case 'update':
                intents.push(this.buildUpdateIntent(ctx));
                break;
            case 'delete':
                intents.push(this.buildDeleteIntent(ctx));
                break;
            case 'complete':
                intents.push(this.buildCompleteIntent(ctx));
                break;
            case 'query':
                intents.push(this.buildQueryIntent(ctx));
                break;
            case 'search':
                intents.push(this.buildSearchIntent(ctx, action));
                break;
            default:
                intents.push(this.buildQueryIntent(ctx));
        }
        return intents;
    }
    createContext(text) {
        return {
            text,
            lowerText: text.toLowerCase(),
            position: 0,
        };
    }
    detectAction(ctx) {
        const text = ctx.lowerText;
        // 检测需要 expansion 的创建模式 - "完成后自动规划"、"做完自动..."
        // 这些不是完成动作，而是创建带后续规划的触发条件
        if (/^完成后/i.test(text) || /^做完/i.test(text) || /^完成后/i.test(text)) {
            // 这是创建任务，带 expansion 触发条件
            // 继续往下走，通过 detectNeedsExpansion 来识别
        }
        else {
            // 优先检测明确的完成动作
            // "完成任务" / "完成报告" / "搞定" / "做完了"
            if (/^完成任务|^完成.{1,10}$|^搞定|^做完了|^标记完成|^标记为完成/.test(text)) {
                return 'complete';
            }
        }
        // 检测搜索动作
        if (/^查找|^搜索|^找一下/.test(text)) {
            return 'search';
        }
        // 检测删除动作
        if (/^删除|^移除|^删/.test(text)) {
            return 'delete';
        }
        // 检测更新动作
        if (/^修改|^更新|^改到/.test(text)) {
            return 'update';
        }
        // 检测循环/定期任务的创建
        // "每X提醒我做..." / "每X做..." / "...后X天提醒"
        if (/每[\d一两二三四五六七八九十]?(天|周|月|年|个小时?|分钟)/.test(text) || /每[\d一两二三四五六七八九十]?(天|周|月|年|个小时?|分钟)?提醒/.test(text)) {
            return 'create';
        }
        // 检测带时间的任务创建 - "明天上午10点开会" / "周五下午3点去看牙医" / "后天10点约了xrc"
        // 必须有时序词(明天/后天/周五等) + 时间点(10点/下午3点等) + 动词/活动描述
        // 这个检测应该优先于疑问句检测，因为有时序词+时间的是创建任务
        if (/^(明天|后天|[周一二三四五六日])/.test(text) && /[\d点零上一二三四五六七八九十]/.test(text)) {
            return 'create';
        }
        // 检测查询动作 - 只匹配明确的疑问句式（句子开头）
        // "今天有什么安排" / "查看日程" / "今天干嘛" / "有什么任务"
        // 不能匹配普通任务描述如"明天上午10点开会，有什么注意事项"
        if (text.startsWith('今天有什么') || text.startsWith('查看日程') || text.startsWith('今天干嘛') || text === '待办事项' || text.startsWith('有什么任务')) {
            return 'query';
        }
        // 检测创建动作
        if (/帮我|创建|添加|新增|新建|安排|预约/.test(text)) {
            return 'create';
        }
        // "完成后..." 和 "做完..." 除非后面直接是结束词，否则是创建触发条件
        // "完成任务" 是完成，"完成后自动规划" 是创建
        if ((text.startsWith('完成后') && !/^完成任务$/.test(text)) || (text.startsWith('做完') && !/^做完$/.test(text))) {
            return 'create';
        }
        // 兜底检测动作关键词 (排除 '看'，因为太宽泛会误判)
        for (const [keyword, action] of Object.entries(ACTION_MAP)) {
            if (keyword !== '看' && text.includes(keyword)) {
                return action;
            }
        }
        // 最终兜底：如果文本不包含疑问词，假定为创建任务
        if (!text.includes('有什么') && !text.includes('有没有') && !text.includes('是不是') && !text.includes('吗') && !text.includes('?')) {
            return 'create';
        }
        return null;
    }
    detectEntityType(ctx) {
        for (const [keyword, type] of Object.entries(TYPE_MAP)) {
            if (ctx.lowerText.includes(keyword)) {
                return type;
            }
        }
        // 默认根据上下文推断
        if (ctx.lowerText.includes('开会') || ctx.lowerText.includes('会议')) {
            return 'event';
        }
        if (ctx.lowerText.includes('项目') || ctx.lowerText.includes('规划')) {
            return 'project';
        }
        return 'task';
    }
    detectPriority(ctx) {
        for (const [keyword, priority] of Object.entries(PRIORITY_MAP)) {
            if (ctx.lowerText.includes(keyword)) {
                return priority;
            }
        }
        return '中';
    }
    extractTitle(ctx) {
        // 简单策略：移除动作词后剩余部分作为标题
        let title = ctx.text;
        // 移除常见前缀
        const prefixes = ['帮我', '请', '我想', '我要', '帮我把', '帮我安排', '创建', '添加', '新增'];
        for (const prefix of prefixes) {
            if (title.includes(prefix)) {
                title = title.replace(prefix, '').trim();
            }
        }
        // 移除时间表达式
        title = title.replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g, '');
        title = title.replace(/下[周个]?[一二三四五六日天]+/g, '');
        title = title.replace(/今天|明天|后天|昨天/g, '');
        return title.trim() || ctx.text;
    }
    extractDate(ctx) {
        // 优先检测完整日期格式 YYYY-MM-DD 或 YYYY/MM/DD
        const dateMatch = ctx.text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/);
        if (dateMatch) {
            return dateMatch[1].replace(/[/年]/g, '-');
        }
        // 检测简写日期格式 M月D日 或 MM月DD日 (无年份)
        const shortDateMatch = ctx.text.match(/(\d{1,2})月(\d{1,2})日?/);
        if (shortDateMatch) {
            const month = shortDateMatch[1].padStart(2, '0');
            const day = shortDateMatch[2].padStart(2, '0');
            const year = new Date().getFullYear();
            return `${year}-${month}-${day}`;
        }
        const lowerText = ctx.lowerText;
        const now = new Date();
        // 相对日期 - 按优先级检查
        if (lowerText.includes('今天')) {
            return now.toISOString().split('T')[0];
        }
        if (lowerText.includes('明天')) {
            const d = new Date(now);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (lowerText.includes('后天')) {
            const d = new Date(now);
            d.setDate(d.getDate() + 2);
            return d.toISOString().split('T')[0];
        }
        // 周几的表达 - 计算下一个匹配日期
        const weekdayMap = {
            '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6,
            '星期日': 0, '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6,
        };
        for (const [weekday, dayNum] of Object.entries(weekdayMap)) {
            if (lowerText.includes(weekday)) {
                const d = new Date(now);
                const currentDay = d.getDay();
                let daysUntil = dayNum - currentDay;
                if (daysUntil <= 0)
                    daysUntil += 7; // 找下一个匹配的日期
                d.setDate(d.getDate() + daysUntil);
                return d.toISOString().split('T')[0];
            }
        }
        // 下周X
        if (lowerText.includes('下周一'))
            return this.getNextWeekday(1);
        if (lowerText.includes('下周二'))
            return this.getNextWeekday(2);
        if (lowerText.includes('下周三'))
            return this.getNextWeekday(3);
        if (lowerText.includes('下周四'))
            return this.getNextWeekday(4);
        if (lowerText.includes('下周五'))
            return this.getNextWeekday(5);
        if (lowerText.includes('下周六'))
            return this.getNextWeekday(6);
        if (lowerText.includes('下周日'))
            return this.getNextWeekday(0);
        return undefined;
    }
    getNextWeekday(dayNum) {
        const d = new Date();
        const currentDay = d.getDay();
        let daysUntil = dayNum - currentDay;
        if (daysUntil <= 0)
            daysUntil += 7;
        d.setDate(d.getDate() + daysUntil);
        return d.toISOString().split('T')[0];
    }
    extractTime(ctx) {
        // 先检查下午/上午，因为会影响时间解析
        let hourOffset = 0;
        const lowerText = ctx.lowerText;
        if (lowerText.includes('下午') || lowerText.includes('晚上')) {
            hourOffset = 12;
        }
        else if (lowerText.includes('上午') || lowerText.includes('早上')) {
            hourOffset = 0;
        }
        const timeMatch = ctx.text.match(/(\d{1,2})[点时:](\d{0,2})/);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = parseInt(timeMatch[2]?.padStart(2, '0') || '00', 10);
            // 下午/晚上且时间不是24小时制
            if (hourOffset === 12 && hour < 12) {
                hour += 12;
            }
            else if (hourOffset === 0 && hour === 12) {
                hour = 0; // 中午12点保持12
            }
            return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
        return undefined;
    }
    extractRecurrence(ctx) {
        // 固定间隔循环 - 支持中文数字
        const chineseNumeralMap = {
            '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
            '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
        };
        const intervalMatch = ctx.lowerText.match(/每([\d一两二三四五六七八九十]+)?(天|周|月|年|个小时?|分钟?)/);
        if (intervalMatch) {
            let interval = intervalMatch[1] || '1';
            const unit = intervalMatch[2];
            // 转换中文数字
            if (chineseNumeralMap[interval]) {
                interval = chineseNumeralMap[interval];
            }
            let intervalStr = interval;
            if (unit.includes('天') && !unit.includes('个')) {
                intervalStr += ' days';
            }
            else if (unit.includes('周')) {
                intervalStr += ' weeks';
            }
            else if (unit.includes('月')) {
                intervalStr += ' months';
            }
            else if (unit.includes('年')) {
                intervalStr += ' years';
            }
            else if (unit.includes('小时') || unit.includes('个小时')) {
                intervalStr += ' hours';
            }
            else if (unit.includes('分钟') || unit.includes('分钟')) {
                intervalStr += ' minutes';
            }
            return {
                type: 'weekly', // Maps to the Feishu recurrence types
                rule: {
                    type: 'weekly',
                    interval: intervalStr,
                    start_from: new Date().toISOString().split('T')[0],
                },
            };
        }
        // 基于完成时间 - "完成后3天" / "完成后N天"
        if (ctx.lowerText.includes('完成后')) {
            const daysMatch = ctx.lowerText.match(/完成后(\d+)天|之后?(\d+)天/);
            const days = daysMatch ? parseInt(daysMatch[1] || daysMatch[2]) : 90; // 默认90天
            return {
                type: 'after_complete',
                rule: {
                    type: 'after_complete',
                    days_after: days,
                    reminder: true,
                },
            };
        }
        return undefined;
    }
    detectNeedsExpansion(ctx) {
        // 检测是否需要智能拓展
        const expansionKeywords = ['完成后自动', '完成后规划', '做完'];
        for (const keyword of expansionKeywords) {
            if (ctx.lowerText.includes(keyword)) {
                return { needs: true, type: 'development_planning' };
            }
        }
        // 医疗类任务自动规划
        const medicalKeywords = ['医生', '体检', '复查', '检查'];
        for (const keyword of medicalKeywords) {
            if (ctx.lowerText.includes(keyword)) {
                return { needs: true, type: 'medical_followup' };
            }
        }
        return { needs: false, type: undefined };
    }
    buildCreateIntent(ctx) {
        const entityType = this.detectEntityType(ctx);
        const recurrence = this.extractRecurrence(ctx);
        const expansion = this.detectNeedsExpansion(ctx);
        return {
            action: 'create',
            entityType,
            entity: {
                type: entityType,
                title: this.extractTitle(ctx),
                priority: this.detectPriority(ctx),
                due_date: this.extractDate(ctx),
                start_date: this.extractDate(ctx),
                start_time: this.extractTime(ctx),
                is_recurring: !!recurrence,
                recurrence_type: recurrence?.type,
                recurrence_rule: recurrence?.rule,
                status: 'pending',
                needs_expansion: expansion.needs,
                expansion_type: expansion.type,
            },
            needsExpansion: expansion.needs,
            expansionType: expansion.type,
        };
    }
    buildUpdateIntent(ctx) {
        return {
            action: 'update',
            entityType: this.detectEntityType(ctx),
            entity: {
                due_date: this.extractDate(ctx),
                start_date: this.extractDate(ctx),
                start_time: this.extractTime(ctx),
                priority: this.detectPriority(ctx),
            },
        };
    }
    buildDeleteIntent(ctx) {
        return {
            action: 'delete',
            entityType: this.detectEntityType(ctx),
            entity: {},
        };
    }
    buildCompleteIntent(ctx) {
        // 尝试提取任务名称
        const title = this.extractTitle(ctx);
        return {
            action: 'complete',
            entityType: 'task',
            entity: {
                title,
                status: 'completed',
                completion_date: new Date().toISOString(),
            },
        };
    }
    buildQueryIntent(ctx) {
        let queryType = 'today_schedule';
        if (ctx.lowerText.includes('今天')) {
            queryType = 'today_schedule';
        }
        else if (ctx.lowerText.includes('明天')) {
            queryType = 'tomorrow_schedule';
        }
        else if (ctx.lowerText.includes('本周') || ctx.lowerText.includes('这周')) {
            queryType = 'week_schedule';
        }
        else if (ctx.lowerText.includes('下周')) {
            queryType = 'next_week_schedule';
        }
        return {
            action: 'query',
            entityType: 'task',
            entity: {},
            queryType,
        };
    }
    buildSearchIntent(ctx, action) {
        const searchQuery = ctx.text
            .replace(/查找|搜索|找/g, '')
            .trim();
        return {
            action,
            entityType: 'task',
            entity: {},
            searchQuery,
        };
    }
}
exports.NLParser = NLParser;
exports.nlParser = new NLParser();
//# sourceMappingURL=nl-parser.js.map