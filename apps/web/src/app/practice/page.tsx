'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PracticeMode } from '@students-talk/types';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

interface Presets {
  modes: Array<{ id: PracticeMode; name: string; description: string }>;
  topics: Array<{ id: string; mode: PracticeMode; name: string; description: string }>;
  scenarios: Array<{ id: string; name: string; description: string; roleInstructions: string }>;
  levels: Array<{ id: string; name: string; description: string }>;
}

export default function PracticePage() {
  const router = useRouter();
  const {
    selectedMode,
    selectedTopic,
    selectedLevel,
    selectedScenario,
    setMode,
    setTopic,
    setLevel,
    setScenario,
  } = useStore();

  const [presets, setPresets] = useState<Presets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPresets() {
      try {
        const data = await api.getPresets();
        setPresets(data);
      } catch (err) {
        // Use mock data if API fails
        setPresets({
          modes: [
            { id: 'FREE_TALK', name: '自由对话', description: '日常口语陪练，AI 主动提问引导' },
            { id: 'ROLE_PLAY', name: '情景角色扮演', description: '模拟真实场景对话' },
            { id: 'REPEAT', name: '跟读/复述', description: '跟读 AI 示范句，练习发音' },
          ],
          topics: [
            { id: 'daily-life', mode: 'FREE_TALK', name: '日常生活', description: 'Daily Life' },
            { id: 'work', mode: 'FREE_TALK', name: '工作职业', description: 'Work & Career' },
            { id: 'travel', mode: 'FREE_TALK', name: '旅行话题', description: 'Travel' },
            { id: 'hobbies', mode: 'FREE_TALK', name: '爱好兴趣', description: 'Hobbies' },
          ],
          scenarios: [
            { id: 'restaurant', name: '餐厅点餐', description: 'Restaurant', roleInstructions: 'Waiter' },
            { id: 'interview', name: '求职面试', description: 'Job Interview', roleInstructions: 'Manager' },
            { id: 'airport', name: '机场值机', description: 'Airport Check-in', roleInstructions: 'Agent' },
            { id: 'hotel', name: '酒店入住', description: 'Hotel Check-in', roleInstructions: 'Receptionist' },
          ],
          levels: [
            { id: 'beginner', name: '初级', description: '简单词汇和句型' },
            { id: 'intermediate', name: '中级', description: '日常交流水平' },
            { id: 'advanced', name: '高级', description: '流利表达' },
          ],
        });
      }
      setIsLoading(false);
    }
    loadPresets();
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      // Create session
      const sessionData = await api.createSession({
        mode: selectedMode,
        topic: selectedTopic || undefined,
        level: selectedLevel,
        scenario: selectedScenario || undefined,
      });

      // Store session info
      useStore.getState().setSessionId(sessionData.session.id);

      // Navigate to practice room
      router.push(`/practice/${sessionData.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setIsStarting(false);
    }
  };

  const getFilteredTopics = () => {
    if (!presets) return [];
    return presets.topics.filter(t => t.mode === selectedMode || t.mode === 'FREE_TALK');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">选择练习模式</h1>
          <p className="text-gray-400">配置你的口语练习参数</p>
        </div>

        {/* Mode Selection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">1. 练习模式</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {presets?.modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setMode(mode.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedMode === mode.id
                    ? 'border-primary-500 bg-primary-500/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-semibold mb-1">{mode.name}</div>
                <div className="text-sm text-gray-400">{mode.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Level Selection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">2. 难度级别</h2>
          <div className="flex gap-4">
            {presets?.levels.map((level) => (
              <button
                key={level.id}
                onClick={() => setLevel(level.id)}
                className={`px-6 py-3 rounded-xl border-2 transition-all ${
                  selectedLevel === level.id
                    ? 'border-primary-500 bg-primary-500/20 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {level.name}
              </button>
            ))}
          </div>
        </section>

        {/* Topic/Scenario Selection */}
        {selectedMode === 'ROLE_PLAY' ? (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">3. 选择情景</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {presets?.scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setScenario(scenario.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedScenario === scenario.id
                      ? 'border-primary-500 bg-primary-500/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="text-white font-semibold mb-1">{scenario.name}</div>
                  <div className="text-sm text-gray-400">{scenario.description}</div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedMode === 'REPEAT' ? '3. 选择话题' : '3. 选择话题 (可选)'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setTopic(null)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedTopic === null
                    ? 'border-primary-500 bg-primary-500/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-semibold mb-1">自由话题</div>
                <div className="text-sm text-gray-400">不指定具体话题</div>
              </button>
              {getFilteredTopics().map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setTopic(topic.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTopic === topic.id
                      ? 'border-primary-500 bg-primary-500/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="text-white font-semibold mb-1">{topic.name}</div>
                  <div className="text-sm text-gray-400">{topic.description}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* Start Button */}
        <div className="flex justify-center">
          <button
            onClick={handleStart}
            disabled={isStarting}
            className={`px-12 py-4 rounded-full font-semibold text-lg transition-all ${
              isStarting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {isStarting ? '正在启动...' : '开始练习'}
          </button>
        </div>
      </div>
    </main>
  );
}
