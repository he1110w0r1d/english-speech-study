const WebSocket = require('ws');
require('dotenv').config({ path: '.env' });

const apiKey = process.env.QWEN_API_KEY;
const model = process.env.QWEN_MODEL || 'qwen-omni-flash-realtime';

console.log('Testing Realtime OpenAI API endpoint...');
const ws = new WebSocket(`wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`, {
  headers: {
    'Authorization': 'Bearer ' + apiKey
  }
});

ws.on('open', () => {
  console.log('Realtime WS connected successfully!');
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['audio', 'text']
    }
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
});

ws.on('unexpected-response', (request, response) => {
  console.error('WS unexpected response:', response.statusCode);
});
