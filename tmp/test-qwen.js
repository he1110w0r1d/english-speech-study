const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 手动读取项目根目录下的 .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/QWEN_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

async function testQwenMax() {
  console.log('--- Qwen-Max Connection Test ---');
  if (!apiKey) {
    console.error('ERROR: QWEN_API_KEY not found in .env file!');
    process.exit(1);
  }
  console.log(`Using API Key: ...${apiKey.slice(-5)}`);

  try {
    console.log('Sending test request to DashScope...');
    const response = await axios.post(
      apiUrl,
      {
        model: 'qwen-max',
        messages: [
          { role: 'user', content: 'Say hello world' }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    console.log('✅ SUCCESS!');
    console.log('Result:', response.data.choices[0].message.content);
  } catch (error) {
    console.error('❌ FAILED!');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

testQwenMax();
