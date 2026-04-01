import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getEvaluationPrompt } from '@students-talk/prompts';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.apiKey = process.env.QWEN_API_KEY || '';
    // 使用 DashScope 的标准 Chat Completion 接口
    this.apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  }

  /**
   * 为指定会话生成真实的 AI 评估报告
   */
  async generateEvaluation(sessionId: string) {
    this.logger.log(`Starting real-time evaluation for session: ${sessionId}`);

    try {
      // 1. 获取会话信息和对话记录
      const session = await this.prisma.practiceSession.findUnique({
        where: { id: sessionId },
        include: { turns: { orderBy: { turnIndex: 'asc' } } },
      });

      if (!session) {
        this.logger.error(`Evaluation failed: Session ${sessionId} not found`);
        throw new Error('Session not found');
      }

      if (!session.turns || session.turns.length === 0) {
        this.logger.warn(`Evaluation abort: Session ${sessionId} has no transcripts yet.`);
        return null; // Return null instead of error to tell controller it's not ready yet
      }

      this.logger.debug(`Found ${session.turns.length} turns for session ${sessionId}`);

      // 2. 格式化对话文本
      const conversationTranscript = session.turns
        .map((t) => `${t.speaker === 'STUDENT' ? 'Student' : 'AI'}: ${t.transcript || '(audio only)'}`)
        .join('\n');

      // 3. 准备 Prompt
      const prompt = getEvaluationPrompt({
        student_level: session.level,
        lesson_mode: session.mode,
        topic: session.topic || 'General conversation',
        target_language: session.language,
        conversation_transcript: conversationTranscript,
      });

      this.logger.log(`Evaluation Prompt prepared (length: ${prompt.length})`);
      this.logger.debug(`PROMPT CONTENT PREVIEW: ${prompt.slice(0, 200)}...`);
      this.logger.log(`CONVERSATION DATA SENDING: \n${conversationTranscript.slice(0, 500)}`);

      // 4. 处理音频数据 (如果存在)
      let audioBase64 = '';
      if (session.audioUrl) {
        try {
          const pcmPath = path.resolve(process.cwd(), session.audioUrl.startsWith('/') ? session.audioUrl.slice(1) : session.audioUrl);
          if (fs.existsSync(pcmPath)) {
            const pcmBuffer = fs.readFileSync(pcmPath);
            // 给 PCM 加上 WAV 头 (16k, 16bit, mono)
            const wavBuffer = this.addWavHeader(pcmBuffer, 16000, 16, 1);
            audioBase64 = wavBuffer.toString('base64');
            this.logger.log(`Audio attached to evaluation: ${wavBuffer.length} bytes`);
          }
        } catch (audioErr: any) {
          this.logger.error(`Failed to attach audio: ${audioErr.message}`);
        }
      }

      // 5. 调用 Qwen3-Omni-Flash 全模态模型
      if (!this.apiKey) {
        this.logger.error('QWEN_API_KEY is not set in environment variables!');
        throw new Error('API Key missing');
      }

      this.logger.log('Calling Qwen3-Omni-Flash API (streaming, multimodal)...');

      const userContent: any[] = [
        { type: 'text', text: prompt + '\n\n请用中文输出所有评估内容（strengths, weaknesses, error_tags, suggested_expressions, next_step_advice 的值都用中文）。输出必须是合法的 JSON 格式。' }
      ];

      // 如果有音频录音，附加到请求中（需要 data:;base64, 前缀）
      if (audioBase64) {
        userContent.unshift({
          type: 'input_audio',
          input_audio: {
            data: `data:;base64,${audioBase64}`,
            format: 'wav'
          }
        });
        this.logger.log('Audio data attached to multimodal request');
      }

      const messages: any[] = [
        { role: 'system', content: '你是一位专业的英语口语教学评估专家。请仔细分析学生的对话记录和音频录音，从发音、流利度、语法、词汇等多个维度给出详细的中文评估报告。所有评分、优点、缺点、建议等内容必须使用中文书写。' },
        { role: 'user', content: userContent }
      ];

      // Qwen-Omni 要求必须使用流式输出 (stream=true)
      let fullContent = '';
      try {
        const response = await axios.post(
          this.apiUrl,
          {
            model: 'qwen3-omni-flash',
            messages,
            modalities: ['text'],
            stream: true,
            stream_options: { include_usage: true },
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
            responseType: 'stream',
          }
        );

        // 解析 SSE 流式响应
        fullContent = await new Promise<string>((resolve, reject) => {
          let content = '';
          let buffer = '';

          response.data.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留不完整的行

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const jsonStr = trimmed.slice(6); // 去掉 "data: "
              if (jsonStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.choices?.[0]?.delta?.content) {
                  content += parsed.choices[0].delta.content;
                }
              } catch (e) {
                // 忽略解析失败的行
              }
            }
          });

          response.data.on('end', () => {
            // 处理缓冲区中剩余的数据
            if (buffer.trim().startsWith('data: ')) {
              const jsonStr = buffer.trim().slice(6);
              if (jsonStr !== '[DONE]') {
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.choices?.[0]?.delta?.content) {
                    content += parsed.choices[0].delta.content;
                  }
                } catch (e) {}
              }
            }
            resolve(content);
          });

          response.data.on('error', (err: Error) => reject(err));
        });
      } catch (apiErr: any) {
        if (apiErr.response) {
          // 流式错误时尝试读取响应体
          let errBody = '';
          if (typeof apiErr.response.data?.on === 'function') {
            errBody = await new Promise<string>((resolve) => {
              let d = '';
              apiErr.response.data.on('data', (c: Buffer) => d += c.toString());
              apiErr.response.data.on('end', () => resolve(d));
            });
          } else {
            errBody = JSON.stringify(apiErr.response.data);
          }
          this.logger.error(`API Response Status: ${apiErr.response.status}`);
          this.logger.error(`API Response Body: ${errBody}`);
        }
        throw apiErr;
      }

      this.logger.log('--- API RECEIVED RESPONSE ---');
      this.logger.debug(`Raw result from AI: ${fullContent.slice(0, 200)}...`);

      // 从返回内容中提取 JSON（可能包含 markdown 代码块）
      let jsonStr = fullContent;
      const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // 尝试找到第一个 { 和最后一个 }
        const firstBrace = fullContent.indexOf('{');
        const lastBrace = fullContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = fullContent.slice(firstBrace, lastBrace + 1);
        }
      }

      const result = JSON.parse(jsonStr);
      
      // 映射到小驼峰以匹配数据库和前端类型
      const normalizedResult = {
        pronunciationScore: result.pronunciation_score || 0,
        fluencyScore: result.fluency_score || 0,
        grammarScore: result.grammar_score || 0,
        vocabularyScore: result.vocabulary_score || 0,
        taskCompletionScore: result.task_completion_score || 0,
        overallScore: result.overall_score || 0,
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        errorTags: result.error_tags || [],
        suggestedExpressions: result.suggested_expressions || [],
        nextStepAdvice: result.next_step_advice || [],
      };

      this.logger.log(`Evaluation generated successfully for ${sessionId}`);

      // 5. 保存结果到数据库
      this.logger.log(`Persisting report to database for session ${sessionId}...`);
      const report = await this.prisma.evaluationReport.upsert({
        where: { sessionId },
        update: {
          pronunciationScore: normalizedResult.pronunciationScore,
          fluencyScore: normalizedResult.fluencyScore,
          grammarScore: normalizedResult.grammarScore,
          vocabularyScore: normalizedResult.vocabularyScore,
          taskCompletionScore: normalizedResult.taskCompletionScore,
          overallScore: normalizedResult.overallScore,
          strengthsJson: normalizedResult.strengths,
          weaknessesJson: normalizedResult.weaknesses,
          errorTagsJson: normalizedResult.errorTags,
          suggestedExpressionsJson: normalizedResult.suggestedExpressions,
          nextStepAdviceJson: normalizedResult.nextStepAdvice,
          rawLlmOutput: JSON.stringify(result),
        },
        create: {
          sessionId,
          pronunciationScore: normalizedResult.pronunciationScore,
          fluencyScore: normalizedResult.fluencyScore,
          grammarScore: normalizedResult.grammarScore,
          vocabularyScore: normalizedResult.vocabularyScore,
          taskCompletionScore: normalizedResult.taskCompletionScore,
          overallScore: normalizedResult.overallScore,
          strengthsJson: normalizedResult.strengths,
          weaknessesJson: normalizedResult.weaknesses,
          errorTagsJson: normalizedResult.errorTags,
          suggestedExpressionsJson: normalizedResult.suggestedExpressions,
          nextStepAdviceJson: normalizedResult.nextStepAdvice,
          rawLlmOutput: JSON.stringify(result),
        },
      });

      this.logger.log(`SUCCESS: Report saved (ID: ${report.id})`);

      return {
        ...normalizedResult,
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate evaluation: ${error.message}`, error.stack);
      throw error;
    }
  }

  private formatReportResponse(report: any) {
    return {
      ...report,
      strengths: report.strengthsJson,
      weaknesses: report.weaknessesJson,
      errorTags: report.errorTagsJson,
      suggestedExpressions: report.suggestedExpressionsJson,
      nextStepAdvice: report.nextStepAdviceJson,
    };
  }

  /**
   * 为 PCM 音频添加 WAV 头
   */
  private addWavHeader(pcmBuffer: Buffer, sampleRate: number, bitsPerSample: number, channels: number): Buffer {
    const header = Buffer.alloc(44);
    const dataSize = pcmBuffer.length;

    header.write('RIFF', 0);
    header.writeUInt32LE(dataSize + 36, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }
}
