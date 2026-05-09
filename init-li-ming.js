/**
 * 初始化李明的日程
 * 基于文档中的人物状态初始化
 */

const http = require('http');

const PORT = 3000;
const HOST = '127.0.0.1';

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
      timeout: 30000
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

// 李明的日程初始化数据（2026年5月11日 周一）
const events = [
  {
    title: '管理层周会',
    start_date: '2026-05-11',
    start_time: '09:00',
    end_time: '10:00',
    location: '会议室A',
    category: '工作'
  },
  {
    title: '产品进度汇报',
    start_date: '2026-05-11',
    start_time: '10:30',
    end_time: '11:30',
    location: '会议室B',
    category: '工作'
  },
  {
    title: '投资人电话会议',
    start_date: '2026-05-11',
    start_time: '14:00',
    end_time: '15:00',
    location: '线上',
    category: '工作'
  },
  {
    title: '产品评审会',
    start_date: '2026-05-11',
    start_time: '17:00',
    end_time: '18:00',
    location: '会议室A',
    category: '工作'
  },
  {
    title: '客户拜访（深圳）',
    start_date: '2026-05-12',
    start_time: '10:00',
    end_time: '11:00',
    location: '深圳',
    category: '工作'
  },
  {
    title: '孩子家长会',
    start_date: '2026-05-13',
    start_time: '14:00',
    end_time: '16:00',
    location: '儿子学校（三年级2班）',
    category: '家庭'
  }
];

async function initSchedule() {
  console.log('📅 初始化李明的日程...\n');

  for (const event of events) {
    console.log(`创建: ${event.title} (${event.start_date} ${event.start_time}-${event.end_time})`);
    try {
      const result = await postRequest('/api/events', event);
      if (result.success) {
        console.log(`   ✅ 成功创建`);
      } else {
        console.log(`   ❌ 失败: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ 错误: ${error.message}`);
    }
  }

  console.log('\n📋 日程初始化完成！');
}

initSchedule().catch(console.error);
