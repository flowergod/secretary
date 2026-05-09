"use strict";
// RRULE 生成助手
// 将自然语言描述转换为 RRULE 格式
Object.defineProperty(exports, "__esModule", { value: true });
exports.recurrenceHelper = void 0;
exports.parseRecurrence = parseRecurrence;
exports.describeRecurrence = describeRecurrence;
const DAY_MAP = {
    '周日': 'SU', '星期日': 'SU', '日': 'SU',
    '周一': 'MO', '星期一': 'MO', '一': 'MO',
    '周二': 'TU', '星期二': 'TU', '二': 'TU',
    '周三': 'WE', '星期三': 'WE', '三': 'WE',
    '周四': 'TH', '星期四': 'TH', '四': 'TH',
    '周五': 'FR', '星期五': 'FR', '五': 'FR',
    '周六': 'SA', '星期六': 'SA', '六': 'SA',
};
const ORDINAL_MAP = {
    '第一': 1, '第1': 1, '一': 1,
    '第二': 2, '第2': 2, '二': 2,
    '第三': 3, '第3': 3, '三': 3,
    '第四': 4, '第4': 4, '四': 4,
    '最后': -1, '末': -1,
};
/**
 * 从自然语言生成循环规则
 * @param description 中文描述，例如："每周二四"、"每月15号"、"每月第一个周一"
 * @returns RecurrenceConfig 对象
 */
function parseRecurrence(description) {
    const desc = description.trim();
    // 不循环
    if (desc === '不循环' || desc === '一次性' || desc === '') {
        return { recurrence_type: 'none', is_recurring: false };
    }
    // 每天
    if (desc.match(/每天|每日|天天/)) {
        return { recurrence_type: 'daily', is_recurring: true };
    }
    // 每周（同一天）
    if (desc === '每周') {
        return { recurrence_type: 'weekly', is_recurring: true };
    }
    // 每月（同一天）
    if (desc === '每月') {
        return { recurrence_type: 'monthly', is_recurring: true };
    }
    // 每年
    if (desc === '每年') {
        return { recurrence_type: 'yearly', is_recurring: true };
    }
    // 工作日
    if (desc.match(/工作日|周一到周五|周一至周五/)) {
        return {
            recurrence_type: 'weekly_n',
            recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
            is_recurring: true,
        };
    }
    // 周末
    if (desc.match(/周末|双休/)) {
        return {
            recurrence_type: 'weekly_n',
            recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=SA,SU',
            is_recurring: true,
        };
    }
    // 每周N次：匹配"每周二四"、"每周一三五"等
    const weeklyMatch = desc.match(/每周([周星期一二三四五六日、，和]+)/);
    if (weeklyMatch) {
        const dayStr = weeklyMatch[1];
        const days = [];
        for (const [key, value] of Object.entries(DAY_MAP)) {
            if (dayStr.includes(key)) {
                if (!days.includes(value)) {
                    days.push(value);
                }
            }
        }
        if (days.length > 0) {
            // 按标准顺序排序
            const order = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
            days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
            return {
                recurrence_type: 'weekly_n',
                recurrence_rule: `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`,
                is_recurring: true,
            };
        }
    }
    // 每月固定日期：匹配"每月15号"、"每月1号和15号"
    const monthDayMatch = desc.match(/每月(\d+)号?/g);
    if (monthDayMatch) {
        const days = monthDayMatch.map(m => {
            const match = m.match(/\d+/);
            return match ? match[0] : '';
        }).filter(d => d);
        if (days.length > 0) {
            return {
                recurrence_type: 'monthly_n',
                recurrence_rule: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${days.join(',')}`,
                is_recurring: true,
            };
        }
    }
    // 每月第N个星期几：匹配"每月第一个周一"
    const monthWeekMatch = desc.match(/每月(第[一二三四]|最后).*([周星期][一二三四五六日])/);
    if (monthWeekMatch) {
        const ordinalStr = monthWeekMatch[1];
        const dayStr = monthWeekMatch[2];
        let ordinal;
        for (const [key, value] of Object.entries(ORDINAL_MAP)) {
            if (ordinalStr.includes(key)) {
                ordinal = value;
                break;
            }
        }
        let dayCode;
        for (const [key, value] of Object.entries(DAY_MAP)) {
            if (dayStr.includes(key)) {
                dayCode = value;
                break;
            }
        }
        if (ordinal !== undefined && dayCode) {
            return {
                recurrence_type: 'monthly_n',
                recurrence_rule: `RRULE:FREQ=MONTHLY;BYDAY=${ordinal}${dayCode}`,
                is_recurring: true,
            };
        }
    }
    // 每年固定日期：匹配"每年3月15日"
    const yearlyMatch = desc.match(/每年(\d+)月(\d+)[日号]/);
    if (yearlyMatch) {
        const month = yearlyMatch[1];
        const day = yearlyMatch[2];
        return {
            recurrence_type: 'yearly_n',
            recurrence_rule: `RRULE:FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`,
            is_recurring: true,
        };
    }
    // 无法识别，返回不循环
    console.warn(`无法识别的循环规则: "${description}"`);
    return { recurrence_type: 'none', is_recurring: false };
}
/**
 * 生成循环规则的中文描述
 */
function describeRecurrence(config) {
    if (!config.is_recurring || config.recurrence_type === 'none') {
        return '不循环';
    }
    switch (config.recurrence_type) {
        case 'daily':
            return '每天';
        case 'weekly':
            return '每周';
        case 'monthly':
            return '每月';
        case 'yearly':
            return '每年';
        case 'weekly_n':
            if (config.recurrence_rule) {
                const match = config.recurrence_rule.match(/BYDAY=([A-Z,]+)/);
                if (match) {
                    const days = match[1].split(',');
                    const dayNames = days.map(d => {
                        const entry = Object.entries(DAY_MAP).find(([_, v]) => v === d);
                        return entry ? entry[0].replace('星期', '周') : d;
                    });
                    return `每周${dayNames.join('、')}`;
                }
            }
            return '每周多次';
        case 'monthly_n':
            if (config.recurrence_rule) {
                const dayMatch = config.recurrence_rule.match(/BYMONTHDAY=(\d+)/);
                if (dayMatch) {
                    return `每月${dayMatch[1]}号`;
                }
                const weekMatch = config.recurrence_rule.match(/BYDAY=(-?\d)([A-Z]{2})/);
                if (weekMatch) {
                    const ordinal = weekMatch[1];
                    const day = weekMatch[2];
                    const ordinalName = ordinal === '-1' ? '最后一个' : `第${ordinal}个`;
                    const entry = Object.entries(DAY_MAP).find(([_, v]) => v === day);
                    const dayName = entry ? entry[0].replace('星期', '周') : day;
                    return `每月${ordinalName}${dayName}`;
                }
            }
            return '每月多次';
        case 'yearly_n':
            if (config.recurrence_rule) {
                const match = config.recurrence_rule.match(/BYMONTH=(\d+);BYMONTHDAY=(\d+)/);
                if (match) {
                    return `每年${match[1]}月${match[2]}日`;
                }
            }
            return '每年';
        default:
            return '未知';
    }
}
// 导出便捷函数
exports.recurrenceHelper = {
    parse: parseRecurrence,
    describe: describeRecurrence,
};
//# sourceMappingURL=recurrence-helper.js.map