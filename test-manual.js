#!/usr/bin/env node
// 人工测试脚本 - 模拟对话测试

const { NLParser } = require('./dist/parser/nl-parser');
const { calendarSuggestionService } = require('./dist/services/calendar-suggestion-service');
const { validationService } = require('./dist/services/validation-service');

const parser = new NLParser();

function test(input) {
  console.log('\n========================================');
  console.log('输入: "' + input + '"');
  console.log('========================================');

  const intents = parser.parse(input);
  console.log('\n[共解析出 ' + intents.length + ' 个事件]');

  intents.forEach((intent, idx) => {
    console.log('\n--- 事件 ' + (idx + 1) + ' ---');
    console.log('[解析结果]');
    console.log('  动作:', intent.action);
    console.log('  类型:', intent.entityType);
    console.log('  标题:', intent.entity.title);
    console.log('  优先级:', intent.entity.priority);
    console.log('  开始日期:', intent.entity.start_date || '(无)');
    console.log('  开始时间:', intent.entity.start_time || '(无)');
    console.log('  结束时间:', intent.entity.end_time || '(无)');
    console.log('  是否循环:', intent.entity.is_recurring || false);
    if (intent.entity.recurrence_type) {
      console.log('  循环类型:', intent.entity.recurrence_type);
    }

    // 日历建议（如果有时时间）
    if (intent.entity.start_date && intent.entity.start_time) {
      console.log('\n[日历分类建议]');
      const calSuggestion = calendarSuggestionService.suggestCalendar(intent);
      console.log('  建议分类:', calSuggestion.category);
      console.log('  置信度:', calSuggestion.confidence);
      console.log('  原因:', calSuggestion.reason);
      console.log('  需要确认:', calSuggestion.needsConfirmation);
    }

    // 验证
    console.log('\n[字段验证]');
    const validation = validationService.validate(intent);
    console.log('  验证通过:', validation.isValid);
    if (!validation.isValid) {
      console.log('  缺失字段:', validation.missingFields.join(', '));
      console.log('  确认消息:', validation.confirmationMessage);
    }
  });

  return intents;
}

// 测试用例
const tests = [
  // 1. 创建带时间的日程
  '周五下午3点开会',

  // 2. 查询
  '今天有什么安排',

  // 3. 普通任务
  '帮我安排下周出差',

  // 4. 带关键词的创建
  '带孩子去看医生',

  // 5. 带优先级
  '紧急任务：周五上午提交报告',

  // 6. 边界情况
  '明天上午10点开会，有什么注意事项',

  // 7. 循环任务
  '每3天提醒我跑步',
];

console.log('========================================');
console.log('项目秘书 - 人工测试');
console.log('========================================');
console.log('\n预定义测试用例:');
tests.forEach((t, i) => console.log(`  ${i+1}. ${t}`));

// 如果有命令行参数，执行单个测试
if (process.argv.length > 2) {
  const input = process.argv.slice(2).join(' ');
  test(input);
} else {
  console.log('\n用法: node test-manual.js "你的对话输入"');
  console.log('\n--- 执行预定义测试 ---\n');

  tests.forEach((t) => test(t));
}
