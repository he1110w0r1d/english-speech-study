const WebSocket = require('ws');
require('dotenv').config({ path: '.env' });

const apiKey = process.env.QWEN_API_KEY;
const model = process.env.QWEN_MODEL || 'qwen-omni-flash-realtime';

console.log('Testing session.update payload (with demo params)...');
const ws = new WebSocket(`wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`, {
  headers: {
    'Authorization': 'Bearer ' + apiKey
  }
});

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      voice: 'Cherry',
      instructions: '你是一个友好的AI助手。',
      input_audio_format: 'pcm',
      output_audio_format: 'pcm',
      input_audio_transcription: {
        model: 'gummy-realtime-v1'
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        silence_duration_ms: 800
      }
    }
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} ${reason.toString()}`);
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
});
