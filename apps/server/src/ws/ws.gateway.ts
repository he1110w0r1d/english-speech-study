/**
 * WebSocket Gateway - 处理前端与服务器之间的实时通信
 *
 * 协议设计:
 * - 前端通过 WebSocket 连接到服务器
 * - 服务器代理转发到 Qwen-Omni-Realtime
 * - 同时记录对话内容用于后续评估
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Server, Socket } from 'socket.io';
import { ServerEvent, ClientEvent, PracticeMode } from '@students-talk/types';
import { QwenOmniService, QwenSessionConfig } from '../qwen-omni/qwen-omni.service';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { v4 as uuidv4 } from 'uuid';
import { getSystemPrompt } from '@students-talk/prompts';

interface SessionState {
  sessionId: string;
  mode: PracticeMode;
  topic?: string;
  language: string;
  level: string;
  scenario?: string;
  turnCount: number;
  currentStudentTurnId?: string;
  currentStudentTurnStartTime?: number;
  currentAiTurnId?: string;
  currentAiTurnStartTime?: number;
  isRecording: boolean;
  startTime: number;
  messageCount: number;
  currentTranscriptText?: string;
  currentAiTranscriptText?: string;
  audioChunks: Buffer[];
  transcript: Array<{ speaker: 'STUDENT' | 'AI'; text: string; timestamp: number; sequenceNumber: number }>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'ws',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WsGateway.name);
  private sessions = new Map<string, SessionState>();

  constructor(
    private readonly qwenService: QwenOmniService,
    private readonly prisma: PrismaService,
    private readonly evaluationService: EvaluationService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // 清理未结束的会话
    for (const [sessionId, state] of this.sessions.entries()) {
      if (state.startTime > 0) {
        await this.endSessionInternal(sessionId, 'error');
      }
    }
  }

  @SubscribeMessage('client:start_session')
  async handleStartSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.log(`Starting session: ${JSON.stringify(payload)}`);

    try {
      // 创建会话记录
      const session = await this.prisma.practiceSession.create({
        data: {
          mode: payload.mode,
          topic: payload.topic,
          language: payload.language || 'en',
          level: payload.level || 'intermediate',
          scenario: payload.scenario,
          status: 'ACTIVE',
        },
      });

      // 初始化会话状态
      const state: SessionState = {
        sessionId: session.id,
        mode: payload.mode,
        topic: payload.topic,
        language: payload.language || 'en',
        level: payload.level || 'intermediate',
        scenario: payload.scenario,
        turnCount: 0,
        isRecording: false,
        startTime: Date.now(),
        messageCount: 0,
        audioChunks: [],
        transcript: [],
      };
      this.sessions.set(session.id, state);

      // 构建 Qwen session 配置
      const systemPrompt = this.buildSystemPrompt(payload.mode, payload);
      const config: QwenSessionConfig = {
        modalities: ['audio', 'text'],
        instructions: systemPrompt,
        input_audio_format: 'pcm',
        output_audio_format: 'pcm',
        // Manual 模式用于 REPEAT，server_vad 用于其他
        turn_detection: payload.mode === 'REPEAT' ? null : {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000,
        },
      };

      // 连接到 Qwen-Omni
      await this.qwenService.connect(config, {
        onConnected: () => {
          this.logger.log('Connected to Qwen-Omni');
        },
        onDisconnected: () => {
          this.logger.warn('Disconnected from Qwen-Omni');
          this.emitEvent(client, 'server:error', {
            code: 'MODEL_DISCONNECT',
            message: 'Lost connection to AI model',
          });
        },
        onError: (error) => {
          this.logger.error(`Qwen error: ${error.message}`);
          this.emitEvent(client, 'server:error', {
            code: 'MODEL_ERROR',
            message: error.message,
          });
        },
        onMessage: (msg) => {},
        onAudioData: (audioBase64) => {
          // 转发音频给前端
          this.emitEvent(client, 'server:assistant_audio_chunk', {
            audio: audioBase64,
            turnId: state.currentAiTurnId || 'unknown',
          });
        },
        onTranscriptDelta: (transcript, isFinal) => {
          // 学生语音转写
          if (!state.currentStudentTurnId) {
            state.turnCount++; // Increment turn for every new student interaction
            state.currentStudentTurnId = `student-${uuidv4()}`;
            state.currentStudentTurnStartTime = Date.now();
            this.emitEvent(client, 'server:turn_start', {
              turnId: state.currentStudentTurnId,
              speaker: 'STUDENT',
              timestamp: state.currentStudentTurnStartTime,
              sequenceNumber: state.turnCount * 10,
            });
          }
          this.emitEvent(client, 'server:user_transcript_delta', {
            turnId: state.currentStudentTurnId,
            transcript,
            isFinal,
            timestamp: state.currentStudentTurnStartTime,
            sequenceNumber: state.turnCount * 10,
          });

          // 实时更新当前 Turn 的文字，以防未完成就被挂断
          state.currentTranscriptText = transcript;

          if (isFinal) {
            this.logger.debug(`Final student transcript: ${transcript}`);
            state.transcript.push({
              speaker: 'STUDENT',
              text: transcript,
              timestamp: state.currentStudentTurnStartTime || Date.now(),
              sequenceNumber: state.turnCount * 10,
            });
            state.currentStudentTurnId = undefined;
            state.currentStudentTurnStartTime = undefined;
            state.currentTranscriptText = '';
          }
        },
        onAssistantTextDelta: (text, isFinal) => {
          // AI 文本回复
          if (!state.currentAiTurnId) {
            state.currentAiTurnId = `ai-${uuidv4()}`;
            state.currentAiTurnStartTime = Date.now();
            this.emitEvent(client, 'server:turn_start', {
              turnId: state.currentAiTurnId,
              speaker: 'AI',
              timestamp: state.currentAiTurnStartTime,
              sequenceNumber: state.turnCount * 10 + 5,
            });
          }
          this.emitEvent(client, 'server:assistant_text_delta', {
            turnId: state.currentAiTurnId,
            text,
            isFinal,
            timestamp: state.currentAiTurnStartTime,
            sequenceNumber: state.turnCount * 10 + 5,
          });

          // 实时更新当前 AI 的文字
          state.currentAiTranscriptText = text;

          if (isFinal) {
            const finalStartTime = state.currentAiTurnStartTime || Date.now();
            const finalSeq = state.turnCount * 10 + 5;
            this.logger.debug(`Final AI transcript: ${text}`);
            state.transcript.push({
              speaker: 'AI',
              text,
              timestamp: finalStartTime,
              sequenceNumber: finalSeq,
            });
            state.currentAiTurnId = undefined;
            state.currentAiTurnStartTime = undefined;
            state.currentAiTranscriptText = '';
          }
        },
        onResponseStart: () => {
          this.logger.debug('AI response started');
        },
        onResponseEnd: () => {
          this.logger.debug('AI response ended');
        },
      });

      // 通知前端会话已就绪
      this.emitEvent(client, 'server:session_ready', {
        sessionId: session.id,
        status: 'connected',
      });

    } catch (error: any) {
      this.logger.error(`Failed to start session: ${error}`);
      this.emitEvent(client, 'server:error', {
        code: 'SESSION_START_FAILED',
        message: error.message || 'Failed to start session',
      });
    }
  }

  @SubscribeMessage('client:audio_chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    // 转发音频到 Qwen-Omni (manual 模式)
    const session = Array.from(this.sessions.values()).find(
      s => s.startTime > 0 && !this.sessions.get(s.sessionId)?.isRecording
    );
    if (session) {
      // 收集音频分片用于持久化
      const audioBuffer = Buffer.from(payload.audio, 'base64');
      session.audioChunks.push(audioBuffer);
      this.logger.debug(`Received audio chunk for ${session.sessionId}: ${audioBuffer.length} bytes. Total: ${session.audioChunks.length}`);
      
      this.qwenService.sendAudioChunk(payload.audio);
    }
  }

  @SubscribeMessage('client:commit_audio')
  handleCommitAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: any,
  ) {
    // Manual 模式下提交音频并触发响应
    this.qwenService.commitAudio();
    if (payload?.triggerResponse) {
      this.qwenService.triggerResponse();
    }
  }

  @SubscribeMessage('client:end_session')
  async handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: any,
  ) {
    const sessionIds = Array.from(this.sessions.keys());
    this.logger.log(`ENDING SESSIONS: ${sessionIds.join(', ')}`);

    for (const sessionId of sessionIds) {
      try {
        await this.endSessionInternal(sessionId, payload?.reason || 'completed');
        
        // 立即触发真实评估
        this.logger.log(`TRIGGERING EVALUATION FOR: ${sessionId}`);
        const report = await this.evaluationService.generateEvaluation(sessionId);
        
        if (report) {
          this.logger.log(`EVALUATION SUCCESS: ${sessionId}`);
          this.emitEvent(client, 'server:report_ready', {
            sessionId,
            report,
          });
        }
      } catch (err: any) {
        this.logger.error(`CRITICAL: End session/Evaluation failed for ${sessionId}: ${err.message}`);
      }
    }
  }

  @SubscribeMessage('client:ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.emitEvent(client, 'server:pong', { timestamp: Date.now() });
  }

  private emitEvent<T extends ServerEvent['type']>(
    client: Socket,
    type: T,
    payload: Extract<ServerEvent, { type: T }>['payload'],
  ) {
    client.emit(type, payload);
  }

  private async endSessionInternal(sessionId: string, reason: 'completed' | 'error' | 'timeout') {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - state.startTime) / 1000);

    // 强制截回正在进行但未完成的话
    if (state.currentStudentTurnId && state.currentTranscriptText) {
      this.logger.log(`Force-committing partial student turn for ${sessionId}`);
      state.transcript.push({
        speaker: 'STUDENT',
        text: state.currentTranscriptText,
        timestamp: state.currentStudentTurnStartTime || Date.now(),
        sequenceNumber: state.turnCount * 10,
      });
    }
    if (state.currentAiTurnId && state.currentAiTranscriptText) {
      this.logger.log(`Force-committing partial AI turn for ${sessionId}`);
      state.transcript.push({
        speaker: 'AI',
        text: state.currentAiTranscriptText,
        timestamp: state.currentAiTurnStartTime || Date.now(),
        sequenceNumber: state.turnCount * 10 + 5,
      });
    }

    this.logger.log(`Session ${sessionId} persistence: Found ${state.transcript.length} turns to save.`);

    // 批量保存对话 turns
    if (state.transcript.length > 0) {
      await this.prisma.practiceTurn.createMany({
        data: state.transcript.map((item, index) => ({
          sessionId,
          turnIndex: index,
          speaker: item.speaker,
          transcript: item.text,
          metadata: { timestamp: item.timestamp, sequenceNumber: item.sequenceNumber },
        })),
      });
    }

    // 保存录音文件 (PCM 格式)
    if (state.audioChunks && state.audioChunks.length > 0) {
      try {
        const fullAudio = Buffer.concat(state.audioChunks);
        const fileName = `${sessionId}.pcm`;
        
        // 确保使用相对于项目根目录的绝对路径
        const baseDir = process.cwd();
        const uploadDir = path.join(baseDir, 'uploads/recordings');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          this.logger.log(`Created recordings directory: ${uploadDir}`);
        }
        
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, fullAudio);
        this.logger.log(`SUCCESS: Physical audio file saved at: ${filePath} (${fullAudio.length} bytes)`);
        
        // 更新会话的 audioUrl
        const audioUrl = `/uploads/recordings/${fileName}`;
        await this.prisma.practiceSession.update({
          where: { id: sessionId },
          data: { audioUrl },
        });
      } catch (err: any) {
        this.logger.error(`CRITICAL: Failed to save physical audio file: ${err.message}`);
      }
    } else {
      this.logger.warn(`No audio chunks collected for session ${sessionId}, skipping file save.`);
    }

    // 清理状态
    this.sessions.delete(sessionId);
    this.qwenService.endSession();
    this.qwenService.disconnect();

    this.logger.log(`Session ${sessionId} ended. Duration: ${durationSeconds}s, Turns: ${state.turnCount}`);
  }

  private buildSystemPrompt(mode: PracticeMode, payload: {
    topic?: string;
    language?: string;
    level?: string;
    scenario?: string;
  }): string {
    const variables = {
      student_level: payload.level || 'intermediate',
      lesson_mode: mode.toLowerCase(),
      topic: payload.topic || 'general conversation',
      target_language: payload.language || 'en',
      correction_style: 'minimal',
      scenario: payload.scenario || '',
      role_instructions: this.getRoleInstructions(payload.scenario),
    };
    return getSystemPrompt(mode, variables as any);
  }

  private getRoleInstructions(scenario?: string): string {
    const scenarios: Record<string, string> = {
      restaurant:
        "You are a friendly waiter/waitress at a restaurant. Take the customer's order, answer questions about the menu, and handle any requests politely.",
      interview:
        "You are a hiring manager conducting a job interview. Ask professional questions about the candidate's experience and qualifications.",
      airport: 'You are an airline check-in agent. Help the passenger check in for their flight and handle baggage.',
      hotel: 'You are a hotel receptionist. Help the guest check in and answer questions about hotel amenities.',
    };
    return scenarios[scenario || ''] || 'You are a helpful person in a service role.';
  }
}
