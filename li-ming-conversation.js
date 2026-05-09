/**
 * 秘书 · 李明3日对话流测试
 * 模拟李明与秘书的完整对话
 */

const http = require('http');
const fs = require('fs');

const PORT = 3000;
const HOST = '127.0.0.1';

// 对话记录
const conversationLog = [];

function postRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ raw: responseData });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

function log(message, role = 'system') {
  conversationLog.push({ role, message, timestamp: new Date().toISOString() });
  const prefix = role === 'user' ? '👤 李明' : role === 'system' ? '🤖 秘书' : '📝 系统';
  console.log(`${prefix}: ${message}`);
}

function formatResult(result) {
  if (result.confirmationQuestion) {
    let output = `[需要确认] ${result.confirmationQuestion}`;
    if (result.confirmationOptions) {
      output += '\n选项:';
      result.confirmationOptions.forEach((opt, i) => {
        output += `\n  ${i + 1}. ${opt.label}`;
      });
    }
    if (result.openOption) {
      output += `\n  0. ${result.openOption.label}`;
    }
    return output;
  }
  if (result.message) return result.message;
  if (result.result?.action) return `[执行成功] ${result.result.action}`;
  return JSON.stringify(result, null, 2);
}

async function understand(text) {
  log(text, 'user');
  try {
    const result = await postRequest('/api/semantic/understand', { text });
    const output = formatResult(result);
    log(output, 'system');
    return result;
  } catch (error) {
    log(`❌ 请求失败: ${error.message}`, 'system');
    return null;
  }
}

async function confirm(contextId, selectedOption, openText = null) {
  const body = { contextId, selectedOption };
  if (openText) body.openText = openText;

  try {
    const result = await postRequest('/api/semantic/confirm', body);
    const output = formatResult(result);
    log(output, 'system');
    return result;
  } catch (error) {
    log(`❌ 确认失败: ${error.message}`, 'system');
    return null;
  }
}

// ==================== 对话流程 ====================

async function runConversation() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           秘书 · 李明3日对话流                          ║');
  console.log('║           2026年5月11日-13日                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ========== 第一日：标准工作日 ==========
  log('='.repeat(50), 'system');
  log('第一日：标准工作日 (2026年5月11日 周一)', 'system');
  log('='.repeat(50), 'system');

  // --- 场景1：早安查询 ---
  log('--- 场景1：早安查询 (7:30) ---', 'system');
  await understand('早上好，今天有什么安排？');
  console.log();

  // --- 场景2：快速添加任务 ---
  log('--- 场景2：快速添加任务 (7:45) ---', 'system');
  const r2 = await understand('提醒我今天下班去超市买牛奶和鸡蛋');
  if (r2?.intent?.id) {
    // 选择18:00作为提醒时间
    await confirm(r2.intent.id, 'opt_1');
  }
  console.log();

  // --- 场景3：临时插入会议 ---
  log('--- 场景3：临时插入会议 (8:15) ---', 'system');
  await understand('上午11点要见一下王总，补一下上周没谈完的合同');
  console.log('   (注：用户已口头确认地点在自己办公室，此处简化处理)');
  console.log();

  // --- 场景4：会议前上下文延续 ---
  log('--- 场景4：会议前上下文延续 (10:55) ---', 'system');
  await understand('我现在在会议室，等王总来');
  console.log();

  // --- 场景5：会议中快速记录 ---
  log('--- 场景5：会议中快速记录 (11:30) ---', 'system');
  await understand('合同的事先暂停，对方说要内部讨论一下');
  console.log();

  // --- 场景6：午休时间轻松对话 ---
  log('--- 场景6：午休轻松对话 (12:30) ---', 'system');
  await understand('中午吃什么好？');
  console.log('   (注：秘书不具备餐厅推荐能力，返回其他需求)');
  console.log();

  // --- 场景7：下午日程变更 ---
  log('--- 场景7：下午日程变更 (13:40) ---', 'system');
  const r7 = await understand('下午的投资人电话会议改到明天上午10点行吗？');
  if (r7?.intent?.id) {
    // 选择方案B：改到明天下午2点
    await confirm(r7.intent.id, 'opt_2', '明天下午2点');
  }
  console.log();

  // --- 场景8：下班前日程确认 ---
  log('--- 场景8：下班前日程确认 (17:50) ---', 'system');
  await understand('帮我看看今晚和明天的安排');
  console.log();

  // --- 场景9：晚间任务完成反馈 ---
  log('--- 场景9：晚间任务完成反馈 (18:30) ---', 'system');
  const r9 = await understand('买完了，在回家路上');
  if (r9?.intent?.id) {
    await confirm(r9.intent.id, 'open', '下班买牛奶鸡蛋');
  }
  console.log();

  // ========== 第二日：出差日 ==========
  log('='.repeat(50), 'system');
  log('第二日：出差日 (2026年5月12日 周二)', 'system');
  log('='.repeat(50), 'system');

  // --- 场景10：出差准备 ---
  log('--- 场景10：出差准备 (6:30) ---', 'system');
  await understand('早上好，今天什么安排？');
  console.log();

  // --- 场景11：机场天气查询 ---
  log('--- 场景11：机场天气查询 (8:45) ---', 'system');
  log('(跳过：秘书暂不支持天气查询功能)', 'system');
  console.log();

  // --- 场景12：到达后餐厅预订 ---
  log('--- 场景12：到达后餐厅预订 (13:00) ---', 'system');
  const r12 = await understand('帮我订个今晚的位子，要安静点的');
  if (r12?.intent?.id) {
    await confirm(r12.intent.id, 'opt_2', '帮我推荐一个安静的');
  }
  console.log();

  // --- 场景13：会议中临时变更 ---
  log('--- 场景13：会议中临时变更 (14:30) ---', 'system');
  const r13 = await understand('明天的客户拜访改到周三上午');
  if (r13?.intent?.id) {
    await confirm(r13.intent.id, 'open', '改到周三上午9点');
  }
  console.log();

  // --- 场景14：商务宴请记录 ---
  log('--- 场景14：商务宴请记录 (19:30) ---', 'system');
  const r14 = await understand('帮我记一下，今天和王总聊了三个要点');
  if (r14?.intent?.id) {
    await confirm(r14.intent.id, 'open', '客户对价格还是有顾虑，交期可以接受，想独家合作三个月试运行');
  }
  console.log();

  // ========== 第三日：本地工作日+家庭日 ==========
  log('='.repeat(50), 'system');
  log('第三日：本地工作日+家庭日 (2026年5月13日 周三)', 'system');
  log('='.repeat(50), 'system');

  // --- 场景15：今日概览 ---
  log('--- 场景15：今日概览 (7:00) ---', 'system');
  await understand('今天怎么样？');
  console.log();

  // --- 场景16：客户来访准备 ---
  log('--- 场景16：客户来访准备 (8:50) ---', 'system');
  const r16 = await understand('客户快到了，准备一下会议室');
  if (r16?.intent?.id) {
    await confirm(r16.intent.id, 'opt_1');
  }
  console.log();

  // --- 场景17：签约成功 ---
  log('--- 场景17：签约成功 (11:30) ---', 'system');
  const r17 = await understand('谈成了！帮我记录一下');
  if (r17?.intent?.id) {
    await confirm(r17.intent.id, 'open', '深圳客户合同签署成功，金额280万，交付周期6个月');
  }
  console.log();

  // --- 场景18：家长会记录 ---
  log('--- 场景18：家长会记录 (14:00) ---', 'system');
  const r18 = await understand('帮我记一下，老师说的暑假安排');
  if (r18?.intent?.id) {
    await confirm(r18.intent.id, 'open', '暑假7月5日到8月31日，作业7月15日前交，返校日8月30日');
  }
  console.log();

  // --- 场景19：家长会后 ---
  log('--- 场景19：家长会后 (16:00) ---', 'system');
  await understand('家长会结束了，接下来没什么事了吧？');
  console.log();

  // --- 场景20：一周复盘 ---
  log('--- 场景20：一周复盘 (20:30) ---', 'system');
  const r20 = await understand('这周忙完了，帮我总结一下');
  if (r20?.intent?.id) {
    await confirm(r20.intent.id, 'opt_1');
  }
  console.log();

  // ========== 保存对话记录 ==========
  saveConversationLog();
}

function saveConversationLog() {
  const outputPath = 'docs/li-ming-conversation-log.md';

  let markdown = `# 李明与秘书对话记录

**日期**: 2026年5月11日-13日
**用户**: 李明（38岁，科技创业公司联合创始人）

---

## 对话摘要

| 场景 | 时间 | 对话内容 | 结果 |
|------|------|----------|------|
`;

  conversationLog.forEach(entry => {
    const prefix = entry.role === 'user' ? '👤' : entry.role === 'system' ? '🤖' : '📝';
    markdown += `${prefix} **${entry.role}**: ${entry.message}\n`;
  });

  markdown += `\n---\n\n## 附录：原始对话数据\n\n\`\`\`json\n${JSON.stringify(conversationLog, null, 2)}\n\`\`\`\n`;

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`\n📝 对话记录已保存到: ${outputPath}`);
}

// 运行对话
runConversation().catch(error => {
  console.error('对话执行失败:', error);
  saveConversationLog(); // 保存已完成的对话
});
