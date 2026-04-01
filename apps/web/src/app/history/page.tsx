'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { HistoryResponse } from '@students-talk/types';

const getModeName = (mode: string) => {
  switch (mode) {
    case 'FREE_TALK': return '自由对话';
    case 'ROLE_PLAY': return '情景扮演';
    case 'REPEAT': return '跟读练习';
    default: return mode;
  }
};

const getScoreColor = (score: number | null) => {
  if (!score) return 'text-gray-500';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
};

interface Session {
  id: string;
  mode: string;
  topic: string | null;
  language: string;
  level: string;
  startedAt: string | Date;
  durationSeconds: number | null;
  overallScore: number | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await api.getHistory() as HistoryResponse;
        setSessions(data.sessions || []);
      } catch (error) {
        console.error('Failed to load history:', error);
      }
      setIsLoading(false);
    }

    loadHistory();
  }, []);

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">练习历史</h1>
            <p className="text-gray-400">查看过往练习记录和报告</p>
          </div>
          <button
            onClick={() => router.push('/practice')}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-semibold transition-colors"
          >
            新练习
          </button>
        </div>

        {/* Sessions List */}
        {isLoading ? (
          <div className="text-center text-gray-500 py-12">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>暂无练习记录</p>
            <button
              onClick={() => router.push('/practice')}
              className="mt-4 text-primary-400 hover:text-primary-300"
            >
              开始第一次练习 →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => router.push(`/report/${session.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 bg-primary-500/20 text-primary-300 rounded text-sm">
              {getModeName(session.mode)}
            </span>
            {session.topic && (
              <span className="text-gray-400 text-sm">{session.topic}</span>
            )}
          </div>
          <div className="text-gray-500 text-sm">
            {format(new Date(session.startedAt), 'yyyy 年 M 月 d 日 HH:mm', { locale: zhCN })}
            {' · '}
            {formatDuration(session.durationSeconds)}
            {' · '}
            {session.level}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${getScoreColor(session.overallScore)}`}>
            {session.overallScore ?? '--'}
          </div>
          <div className="text-gray-500 text-sm">综合评分</div>
        </div>
      </div>
    </button>
  );
}
