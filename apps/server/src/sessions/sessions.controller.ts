/**
 * Sessions REST API Controller
 *
 * 提供练习会话的 CRUD 操作和评估报告查询
 */

import { Controller, Get, Post, Body, Param, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { PracticeMode } from '@prisma/client';

interface CreateSessionDto {
  mode: PracticeMode;
  topic?: string;
  language?: string;
  level?: string;
  scenario?: string;
}

@Controller('api')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: EvaluationService,
  ) {}

  /**
   * POST /api/sessions
   * 创建练习会话
   */
  @Post('sessions')
  async createSession(@Body() body: CreateSessionDto) {
    this.logger.log(`Creating session: ${JSON.stringify(body)}`);

    const session = await this.prisma.practiceSession.create({
      data: {
        mode: body.mode,
        topic: body.topic,
        language: body.language || 'en',
        level: body.level || 'intermediate',
        scenario: body.scenario,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      data: { session },
    };
  }

  /**
   * POST /api/sessions/:id/start
   * 开始练习 (更新状态)
   */
  @Post('sessions/:id/start')
  async startSession(@Param('id') id: string) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const updated = await this.prisma.practiceSession.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    return {
      success: true,
      data: { session: updated },
    };
  }

  /**
   * POST /api/sessions/:id/end
   * 结束练习并触发评分
   */
  @Post('sessions/:id/end')
  async endSession(@Param('id') id: string) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const durationSeconds = session.startedAt
      ? Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
      : 0;

    const updated = await this.prisma.practiceSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        durationSeconds,
      },
    });

    // 生成评估报告（调用真实的 EvaluationService）
    this.evaluationService.generateEvaluation(id).catch(err => {
      this.logger.error(`Failed to generate evaluation: ${err.message}`);
    });

    return {
      success: true,
      data: { session: updated },
    };
  }

  /**
   * GET /api/sessions/:id
   * 获取会话详情
   */
  @Get('sessions/:id')
  async getSessionDetail(@Param('id') id: string) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { turnIndex: 'asc' },
        },
        report: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      success: true,
      data: { session },
    };
  }

  /**
   * GET /api/sessions/:id/report
   * 获取评分报告
   */
  @Get('sessions/:id/report')
  async getSessionReport(@Param('id') id: string) {
    let report = await this.prisma.evaluationReport.findUnique({
      where: { sessionId: id },
    });

    if (!report) {
      // 检查是否具备评估条件（是否有对话记录）
      const session = await this.prisma.practiceSession.findUnique({
        where: { id },
        include: { _count: { select: { turns: true } } },
      });

      if (!session) throw new NotFoundException('Session not found');
      
      // 如果还没有 turns，说明正在存入数据库中，让前端稍后重试
      if (session._count.turns === 0) {
        return {
          success: true,
          data: { status: 'PENDING_TRANSCRIPT', message: 'Waiting for transcripts to save...' },
        };
      }

      // 触发真实评估服务
      try {
        const result = await this.evaluationService.generateEvaluation(id);
        if (!result) {
          return {
            success: true,
            data: { status: 'EVALUATING', message: 'AI is thinking...' },
          };
        }
        return {
          success: true,
          data: { report: result },
        };
      } catch (err: any) {
        this.logger.error(`Evaluation trigger failed: ${err.message}`);
        return {
          success: false,
          error: { code: 'EVALUATION_FAILED', message: err.message },
        };
      }
    }

    return {
      success: true,
      data: { report: this.formatReport(report) },
    };
  }

  /**
   * GET /api/history
   * 获取历史记录
   */
  @Get('history')
  async getHistory() {
    const sessions = await this.prisma.practiceSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        report: {
          select: {
            overallScore: true,
          },
        },
      },
    });

    const formatted = sessions.map(s => ({
      id: s.id,
      mode: s.mode,
      topic: s.topic,
      language: s.language,
      level: s.level,
      startedAt: s.startedAt,
      durationSeconds: s.durationSeconds,
      overallScore: s.report?.overallScore,
    }));

    return {
      success: true,
      data: { sessions: formatted },
    };
  }

  /**
   * GET /api/presets
   * 获取练习模式和预设话题
   */
  @Get('presets')
  async getPresets() {
    return {
      success: true,
      data: {
        modes: [
          { id: 'FREE_TALK', name: 'Free Talk', description: '日常自由对话练习' },
          { id: 'ROLE_PLAY', name: 'Role Play', description: '情景角色扮演' },
          { id: 'REPEAT', name: 'Repeat', description: '跟读/复述练习' },
        ],
        topics: [
          { id: 'daily-life', mode: 'FREE_TALK', name: 'Daily Life', description: '日常生活话题' },
          { id: 'work', mode: 'FREE_TALK', name: 'Work & Career', description: '工作与职业' },
          { id: 'travel', mode: 'FREE_TALK', name: 'Travel', description: '旅行相关' },
          { id: 'hobbies', mode: 'FREE_TALK', name: 'Hobbies', description: '爱好与兴趣' },
        ],
        scenarios: [
          { id: 'restaurant', name: 'Restaurant', description: '餐厅点餐', roleInstructions: 'Waiter/Waitress' },
          { id: 'interview', name: 'Job Interview', description: '求职面试', roleInstructions: 'Hiring Manager' },
          { id: 'airport', name: 'Airport Check-in', description: '机场值机', roleInstructions: 'Airline Agent' },
          { id: 'hotel', name: 'Hotel Check-in', description: '酒店入住', roleInstructions: 'Hotel Receptionist' },
        ],
        levels: [
          { id: 'beginner', name: 'Beginner', description: '初级 - 简单词汇和句型' },
          { id: 'intermediate', name: 'Intermediate', description: '中级 - 日常交流水平' },
          { id: 'advanced', name: 'Advanced', description: '高级 - 流利表达' },
        ],
      },
    };
  }

  /**
   * 将数据库中的 JSON 字段名转换回前端期望的名称
   */
  private formatReport(report: any) {
    if (!report) return null;
    return {
      id: report.id,
      sessionId: report.sessionId,
      overallScore: report.overallScore,
      pronunciationScore: report.pronunciationScore,
      fluencyScore: report.fluencyScore,
      grammarScore: report.grammarScore,
      vocabularyScore: report.vocabularyScore,
      taskCompletionScore: report.taskCompletionScore,
      strengths: report.strengthsJson,
      weaknesses: report.weaknessesJson,
      errorTags: report.errorTagsJson,
      suggestedExpressions: report.suggestedExpressionsJson,
      nextStepAdvice: report.nextStepAdviceJson,
      rawLlmOutput: report.rawLlmOutput,
      createdAt: report.createdAt,
    };
  }
}
