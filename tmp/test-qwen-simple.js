const https = require('https');
const fs = require('fs');
const path = require('path');

// 读取环境变量
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/QWEN_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!apiKey) {
  console.error('ERROR: QWEN_API_KEY not found!');
  process.exit(1);
}

const data = JSON.stringify({
  model: 'qwen-max',
  messages: [{ role: 'user', content: 'Say hello world' }],
  max_tokens: 10
});

const options = {
  hostname: 'dashscope.aliyuncs.com',
  port: 443,
  path: '/compatible-mode/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Content-Length': data.length
  },
  timeout: 10000
};

console.log('--- Zero-Dependency Qwen-Max Test ---');
console.log(`Key: ...${apiKey.slice(-5)}`);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS!');
      const json = JSON.parse(body);
      console.log('Result:', json.choices[0].message.content);
    } else {
      console.error(`❌ FAILED! Status: ${res.statusCode}`);
      console.error('Body:', body);
    }
  });
});

req.on('error', (e) => console.error(`ERROR: ${e.message}`));
req.write(data);
req.end();
