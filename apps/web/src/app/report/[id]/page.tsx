'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EvaluationReport, SessionDetailResponse } from '@students-talk/types';

interface SessionDetail {
  id: string;
  mode: string;
  topic: string | null;
  language: string;
  level: string;
  durationSeconds: number | null;
  startedAt: string | Date;
  turns: Array<{ speaker: string; transcript: string | null }>;
  report: EvaluationReport | null;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    async function fetchData() {
      try {
        const sessionData = await api.getSession(sessionId) as SessionDetailResponse;
        setSession(sessionData.session as any);

        try {
          const response = await api.getSessionReport(sessionId) as any;
          
          if (response && response.report) {
            setReport(response.report);
            setIsEvaluating(false);
            if (pollInterval) clearInterval(pollInterval);
          } else if (response && response.status) {
            // Still in progress (PENDING_TRANSCRIPT or EVALUATING)
            setIsEvaluating(true);
            console.log('Report status:', response.message);
          }
        } catch (reportErr: any) {
          // If real error, show it
          if (!reportErr.message?.includes('404')) {
             console.error('Report error:', reportErr);
          }
          setIsEvaluating(true);
        }
      } catch (err) {
        console.error('Session error:', err);
        setError('无法加载练习会话信息');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();

    // Start polling if not ready
    pollInterval = setInterval(() => {
      if (!report && !error) {
        fetchData();
      }
    }, 3000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId, !!report, !!error]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white text-xl">正在获取数据...</div>
      </div>
    );
  }

  if (isEvaluating && !report) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
        </div>
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold mb-2">AI 老师正在认真批阅中...</h2>
          <p className="text-gray-400">请保持页面开启，报告通常在 10-15 秒内生成</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">无法加载报告</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/history')}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回历史记录
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">练习报告</h1>
          <p className="text-gray-400">
            {session?.mode === 'FREE_TALK' && '自由对话'}
            {session?.mode === 'ROLE_PLAY' && '情景角色扮演'}
            {session?.mode === 'REPEAT' && '跟读练习'}
            {' · '}
            {session?.durationSeconds ? `${Math.floor(session.durationSeconds / 60)}分${session.durationSeconds % 60}秒` : ''}
          </p>
        </div>

        {/* Overall Score */}
        <div className="bg-gradient-to-r from-primary-500/20 to-primary-600/20 rounded-2xl p-8 mb-8 border border-primary-500/30">
          <div className="text-center">
            <div className="text-6xl font-bold text-white mb-2">{report.overallScore}</div>
            <div className="text-primary-300 text-lg">综合评分</div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <ScoreCard label="发音" score={report.pronunciationScore} color="red" />
          <ScoreCard label="流利度" score={report.fluencyScore} color="yellow" />
          <ScoreCard label="语法" score={report.grammarScore} color="green" />
          <ScoreCard label="词汇" score={report.vocabularyScore} color="blue" />
          <ScoreCard label="完成度" score={report.taskCompletionScore} color="purple" />
        </div>

        {/* Strengths */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">✨</span>
            本次亮点
          </h2>
          <ul className="space-y-2">
            {report.strengths.map((strength, index) => (
              <li key={index} className="text-green-100 flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">📌</span>
            需要改进
          </h2>
          <ul className="space-y-2">
            {report.weaknesses.map((weakness, index) => (
              <li key={index} className="text-yellow-100 flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                {weakness}
              </li>
            ))}
          </ul>
        </div>

        {/* Error Tags */}
        {report.errorTags && report.errorTags.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">高频问题</h2>
            <div className="flex flex-wrap gap-2">
              {report.errorTags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Expressions */}
        {report.suggestedExpressions && report.suggestedExpressions.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              推荐表达
            </h2>
            <ul className="space-y-2">
              {report.suggestedExpressions.map((expr, index) => (
                <li key={index} className="text-blue-100 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">→</span>
                  {expr}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-purple-400 mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            下一步建议
          </h2>
          <ul className="space-y-2">
            {report.nextStepAdvice.map((advice, index) => (
              <li key={index} className="text-purple-100 flex items-start gap-2">
                <span className="text-purple-400 mt-1">▸</span>
                {advice}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push('/practice')}
            className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-semibold transition-colors"
          >
            继续练习
          </button>
          <button
            onClick={() => router.push('/history')}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold transition-colors"
          >
            查看历史
          </button>
        </div>
      </div>
    </main>
  );
}

function ScoreCard({ label, score, color }: { label: string; score: number; color: string }) {
  const colorClasses: Record<string, string> = {
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    green: 'from-green-500 to-green-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const scoreColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${scoreColor} mb-1`}>{score}</div>
      <div className="text-gray-400 text-sm">{label}</div>
      <div className={`h-1 w-full mt-2 rounded-full bg-gradient-to-r ${colorClasses[color]}`} />
    </div>
  );
}
