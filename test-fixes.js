const http = require('http');

async function test(text) {
  const data = JSON.stringify({ text });
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/semantic/understand',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== 测试修复 ===\n');

  // 测试1: "今天怎么样" 应该识别为 query_events
  console.log('测试1: "今天怎么样？"');
  let result = await test('今天怎么样？');
  console.log('  Intent:', result.intent?.intent);
  console.log('  Reasoning:', result.intent?.reasoning);
  console.log('  RawInput:', result.intent?.rawInput);
  console.log('  Success:', result.success);
  if (result.error) console.log('  Error:', result.error);
  console.log();

  // 测试2: 日期解析 - "今天"
  console.log('测试2: "提醒我今天下午3点开会"');
  result = await test('提醒我今天下午3点开会');
  console.log('  Intent:', result.intent?.intent);
  console.log('  Start Date:', result.intent?.parameters?.start_date);
  console.log('  Success:', result.success);
  if (result.error) console.log('  Error:', result.error);
  console.log();

  // 测试3: "上午11点要见一下王总"
  console.log('测试3: "上午11点要见一下王总"');
  result = await test('上午11点要见一下王总');
  console.log('  Intent:', result.intent?.intent);
  console.log('  Start Date:', result.intent?.parameters?.start_date);
  console.log('  Success:', result.success);
  if (result.error) console.log('  Error:', result.error);
}

main().catch(console.error);
