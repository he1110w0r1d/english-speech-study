'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Students Talk
          </h1>
          <p className="text-xl text-primary-200 mb-2">
            AI 驱动的实时口语练习伙伴
          </p>
          <p className="text-lg text-primary-300">
            基于 Qwen-Omni-Realtime 技术，提供自然流畅的英语对话体验
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          <FeatureCard
            icon="💬"
            title="自由对话"
            description="与 AI 进行自然的日常对话练习，AI 会主动提问引导你多说"
          />
          <FeatureCard
            icon="🎭"
            title="情景角色扮演"
            description="模拟餐厅、面试、机场等真实场景，实战演练"
          />
          <FeatureCard
            icon="📚"
            title="跟读复述"
            description="跟读 AI 示范句，系统评估发音和流利度"
          />
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Link
            href="/practice"
            className="inline-flex items-center px-8 py-4 bg-white text-primary-700 font-semibold rounded-full hover:bg-primary-50 transition-colors text-lg shadow-lg"
          >
            开始练习
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* Additional Info */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">为什么选择 Students Talk?</h2>
            <ul className="space-y-3 text-primary-100">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>实时语音交互，延迟低至毫秒级</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>智能评估系统，精准反馈发音、流利度、语法</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>多种练习模式，满足不同学习需求</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>历史记录追踪，清晰看到进步轨迹</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white hover:bg-white/20 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-primary-200">{description}</p>
    </div>
  );
}
