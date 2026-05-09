#!/usr/bin/env node
// 循环任务创建助手 - 命令行工具
import * as readline from 'readline';
import { parseRecurrence, describeRecurrence } from '../src/shared/recurrence-helper';
import { taskService } from '../src/services';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== 循环任务创建助手 ===\n');

  // 1. 任务标题
  const title = await question('任务名称: ');
  if (!title) {
    console.log('任务名称不能为空');
    rl.close();
    return;
  }

  // 2. 描述
  const description = await question('任务描述（可选，按回车跳过）: ');

  // 3. 优先级
  console.log('\n优先级: 1-高 2-中 3-低');
  const priorityInput = await question('选择优先级（默认2-中）: ');
  const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
    '1': 'high',
    '2': 'medium',
    '3': 'low',
  };
  const priority = priorityMap[priorityInput] || 'medium';

  // 4. 分类
  const category = await question('分类（如：工作/生活/学习，可选）: ');

  // 5. 循环规则
  console.log('\n循环规则示例:');
  console.log('  - 不循环');
  console.log('  - 每天');
  console.log('  - 每周二四');
  console.log('  - 工作日');
  console.log('  - 每月15号');
  console.log('  - 每月第一个周一');
  console.log('  - 每年3月15日');

  const recurrenceInput = await question('\n请输入循环规则: ');
  const recurrence = parseRecurrence(recurrenceInput);
  console.log(`识别为: ${describeRecurrence(recurrence)}`);

  // 6. 日期
  const dueDate = await question('\n截止日期（格式: 2026-05-10，可选）: ');
  const startDate = await question('开始日期（格式: 2026-05-10，可选）: ');

  // 7. 时间
  const startTime = await question('开始时间（格式: 09:00，可选）: ');
  const endTime = await question('结束时间（格式: 10:00，可选）: ');

  // 确认
  console.log('\n=== 任务预览 ===');
  console.log(`标题: ${title}`);
  if (description) console.log(`描述: ${description}`);
  console.log(`优先级: ${priority}`);
  if (category) console.log(`分类: ${category}`);
  console.log(`循环: ${describeRecurrence(recurrence)}`);
  if (dueDate) console.log(`截止日期: ${dueDate}`);
  if (startDate) console.log(`开始日期: ${startDate}`);
  if (startTime) console.log(`开始时间: ${startTime}`);
  if (endTime) console.log(`结束时间: ${endTime}`);

  const confirm = await question('\n确认创建？(y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('已取消');
    rl.close();
    return;
  }

  // 创建任务
  const result = await taskService.create({
    title,
    description: description || undefined,
    priority,
    category: category || undefined,
    due_date: dueDate || undefined,
    start_date: startDate || undefined,
    start_time: startTime || undefined,
    end_time: endTime || undefined,
    ...recurrence,
  });

  if (result.success) {
    console.log('\n✅ 任务创建成功！');
    console.log(`ID: ${result.data.id}`);
  } else {
    console.log('\n❌ 创建失败:', result.error?.message);
  }

  rl.close();
}

main().catch((err) => {
  console.error('错误:', err);
  rl.close();
  process.exit(1);
});
