/**
 * Qwen-Omni-Realtime WebSocket Service
 *
 * 负责与阿里云 Qwen-Omni-Realtime 建立和管理 WebSocket 连接
 *
 * 事件流程：
 * 1. 建立 WebSocket 连接
 * 2. 发送 session.update 配置会话
 * 3. 接收/转发音频流和文本
 * 4. 处理 server_vad 或 manual 模式
 */

import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { ServerEvent, ClientEvent } from '@students-talk/types';

export interface QwenSessionConfig {
  modalities: string[];
  instructions: string;
  input_audio_format: string;
  output_audio_format: string;
  turn_detection: {
    type: 'server_vad' | null;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
}

export interface QwenSessionCallbacks {
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
  onMessage: (event: Record<string, unknown>) => void;
  onAudioData: (audioBase64: string) => void;
  onTranscriptDelta: (transcript: string, isFinal: boolean) => void;
  onAssistantTextDelta: (text: string, isFinal: boolean) => void;
  onResponseStart: () => void;
  onResponseEnd: () => void;
}

@Injectable()
export class QwenOmniService {
  private readonly logger = new Logger(QwenOmniService.name);
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected = false;

  private apiKey: string;
  private model: string;
  private wsUrl: string;

  constructor() {
    this.apiKey = process.env.QWEN_API_KEY || '';
    this.model = process.env.QWEN_MODEL || 'qwen-omni-flash-realtime';
    this.wsUrl = process.env.QWEN_WS_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  }

  /**
   * 连接到 Qwen-Omni-Realtime WebSocket
   */
private sessionConfig: QwenSessionConfig | null = null;
  private pendingCallbacks: QwenSessionCallbacks | null = null;
  
  async connect(config: QwenSessionConfig, callbacks: QwenSessionCallbacks): Promise<void> {
    this.sessionConfig = config;
    this.pendingCallbacks = callbacks;
    
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.wsUrl}?model=${this.model}`;

        this.logger.log(`Connecting to Qwen-Omni at ${url}`);

        this.ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        this.ws.on('open', () => {
          this.logger.log('WebSocket connected to Qwen-Omni');
          this.isConnected = true;
          callbacks.onConnected();
          resolve();
        });

        this.ws.on('open', () => {
          this.logger.log('WebSocket connected to Qwen-Omni');
          this.isConnected = true;
          callbacks.onConnected();
          resolve();
        });

        this.ws.on('close', () => {
          this.logger.log('WebSocket closed');
          this.isConnected = false;
          callbacks.onDisconnected();
        });

        this.ws.on('error', (error) => {
          this.logger.error(`WebSocket error: ${error.message}`);
          this.isConnected = false;
          callbacks.onError(error);
          reject(error);
        });

        this.ws.on('unexpected-response', (request, response) => {
          this.logger.error(`WebSocket unexpected response: ${response.statusCode} - Connection failed. Maybe invalid API Key or endpoint?`);
          this.isConnected = false;
          const error = new Error(`Unexpected server response: ${response.statusCode}`);
          callbacks.onError(error);
          reject(error);
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message, callbacks);
          } catch (error) {
            this.logger.error(`Failed to parse message: ${error}`);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

/**
    * 处理来自 Qwen 的消息
    */
  private handleMessage(message: Record<string, unknown>, callbacks: QwenSessionCallbacks) {
    const eventType = message.type as string;
    this.logger.debug(`[QWEN EVENT] ${eventType}`);

    switch (eventType) {
      case 'session.created':
        this.sessionId = message.session?.id as string || null;
        this.logger.log(`Session created: ${this.sessionId}`);
        if (this.sessionConfig) {
          this.sendSessionUpdate(this.sessionConfig);
        }
        break;

      case 'session.updated':
        this.logger.log('Session updated successfully');
        break;

      case 'response.audio.delta':
        const audioData = message.delta as unknown as string;
        if (audioData && callbacks) {
          callbacks.onAudioData(audioData);
        }
        break;

      case 'response.audio_transcript.delta':
        const transcriptDeltaData = message.delta as unknown as string;
        if (transcriptDeltaData && callbacks) {
          callbacks.onAssistantTextDelta(transcriptDeltaData, false);
        }
        break;

      case 'response.audio_transcript.done':
        if (this.pendingCallbacks) {
          callbacks.onAssistantTextDelta('', true);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.logger.log(`[USER TRANSCRIPT EVENT] Full message: ${JSON.stringify(message)}`);
        const userTranscript = (message.transcript as string) || (message.content_part?.transcript as string);
        if (userTranscript) {
          this.logger.log(`[USER TRANSCRIPT] "${userTranscript}"`);
          callbacks.onTranscriptDelta(userTranscript, true);
        } else {
          this.logger.warn(`[USER TRANSCRIPT] Event received but transcript field is empty/missing`);
        }
        break;

      case 'input_audio_buffer.speech_started':
        this.logger.debug('Speech started detected');
        callbacks.onResponseStart();
        break;

      case 'input_audio_buffer.speech_stopped':
        this.logger.debug('Speech stopped detected');
        callbacks.onResponseEnd();
        break;

      case 'input_audio_buffer.committed':
        this.logger.debug('Audio buffer committed');
        break;

      case 'response.done':
        this.logger.debug('Response completed');
        break;

      case 'error':
        this.logger.error(`Qwen API error: ${JSON.stringify(message)}`);
        callbacks.onError(new Error(message.message as string || 'Unknown error'));
        break;

      default:
        this.logger.log(`[UNHANDLED EVENT] ${eventType}: ${JSON.stringify(message).slice(0, 300)}`);
    }

    callbacks.onMessage(message);
  }

private sendSessionUpdate(config: QwenSessionConfig) {
    const message = {
      type: 'session.update',
      session: {
        modalities: config.modalities,
        voice: 'Cherry',
        instructions: config.instructions,
        input_audio_format: config.input_audio_format,
        output_audio_format: config.output_audio_format,
        input_audio_transcription: {
          model: 'gummy-realtime-v1'
        },
        turn_detection: config.turn_detection,
      },
    };
    this.send(message);
  }

  /**
   * 发送音频数据 (用于 manual 模式)
   */
  sendAudioChunk(audioBase64: string) {
    const message = {
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    };
    this.send(message);
  }

  /**
   * 提交音频缓冲区并触发响应 (manual 模式)
   */
  commitAudio() {
    const message = {
      type: 'input_audio_buffer.commit',
    };
    this.send(message);
  }

  /**
   * 显式触发 AI 响应 (manual 模式)
   */
  triggerResponse() {
    const message = {
      type: 'response.create',
    };
    this.send(message);
  }

  /**
   * 结束当前会话
   */
  endSession() {
    const message = {
      type: 'session.end',
    };
    this.send(message);
  }

  /**
   * 关闭 WebSocket 连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * 发送消息的通用方法
   */
  private send(message: Record<string, unknown>) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.logger.warn('Cannot send message: WebSocket not connected');
    }
  }

  /**
   * 检查连接状态
   */
  is_connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
