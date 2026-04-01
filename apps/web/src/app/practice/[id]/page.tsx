'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { wsClient, api } from '@/lib/api';
import { AudioRecorder, AudioPlayer, floatTo16BitPCM, int16ToBase64 } from '@/lib/audio';
import { PracticeMode } from '@students-talk/types';

export default function PracticeRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    mode,
    topic,
    selectedScenario: scenario,
    selectedLevel: level,
    messages,
    addMessage,
    updateMessage,
    appendMessageText,
    setStatus,
    setConnectionState,
    setIsRecording,
    setIsSpeaking,
    elapsedSeconds,
    incrementElapsed,
    resetSession,
  } = useStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wsHandlersRef = useRef<{ remove: () => void }[]>([]);
  const initializedRef = useRef(false);
  const realSessionIdRef = useRef<string>(sessionId); // Track the real session ID from WebSocket

  // Initialize practice room
  useEffect(() => {
    initializeSession();

    return () => {
      cleanup();
    };
  }, []);

  // Timer for elapsed seconds
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        incrementElapsed();
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected]);

  const initializeSession = async () => {
    setStatus('connecting');
    setConnectionState('connecting');

    try {
      // Initialize audio devices
      audioRecorderRef.current = new AudioRecorder();
      audioPlayerRef.current = new AudioPlayer();

      // Connect WebSocket
      wsClient.connect();

      // Set up event handlers and store for cleanup
      const handlers = setupWebSocketHandlers();
      wsHandlersRef.current = handlers;

      // Start session via WebSocket
      const practiceMode = (mode || 'FREE_TALK') as PracticeMode;
      wsClient.startSession({
        mode: practiceMode,
        topic: topic || undefined,
        level: level,
        scenario: scenario || undefined,
      });

      setIsManualMode(practiceMode === 'REPEAT');
    } catch (error) {
      console.error('Failed to initialize:', error);
      setStatus('error');
      setConnectionState('error');
    }
  };

  const setupWebSocketHandlers = () => {
    const handlers: Array<{ remove: () => void }> = [];

    const sessionReadyHandler = (payload: unknown) => {
      const { sessionId: wsSessionId } = payload as { sessionId: string; status: string };
      console.log('Session ready:', payload);
      // Store the REAL session ID from the WebSocket (this is where turns/data are stored)
      if (wsSessionId) {
        realSessionIdRef.current = wsSessionId;
      }
      setIsConnected(true);
      setStatus('active');
      setConnectionState('connected');
      startRecording();
    };
    wsClient.on('server:session_ready', sessionReadyHandler);
    handlers.push({ remove: () => wsClient.off('server:session_ready', sessionReadyHandler) });

    const userTranscriptHandler = (payload: unknown) => {
      const { turnId, transcript, isFinal, sequenceNumber } = payload as {
        turnId: string;
        transcript: string;
        isFinal: boolean;
        sequenceNumber?: number;
      };
      appendMessageText(turnId, transcript, 'STUDENT', isFinal, sequenceNumber);
    };
    wsClient.on('server:user_transcript_delta', userTranscriptHandler);
    handlers.push({ remove: () => wsClient.off('server:user_transcript_delta', userTranscriptHandler) });

    const assistantTextHandler = (payload: unknown) => {
      const { turnId, text, isFinal, sequenceNumber } = payload as {
        turnId: string;
        text: string;
        isFinal: boolean;
        sequenceNumber?: number;
      };
      appendMessageText(turnId, text, 'AI', isFinal, sequenceNumber);
    };
    wsClient.on('server:assistant_text_delta', assistantTextHandler);
    handlers.push({ remove: () => wsClient.off('server:assistant_text_delta', assistantTextHandler) });

    const assistantAudioHandler = (payload: unknown) => {
      const { audio, turnId } = payload as { audio: string; turnId: string };
      console.log('Received server:assistant_audio_chunk, audio length:', audio?.length, 'turnId:', turnId);
      setIsSpeaking(true);
      audioPlayerRef.current?.play(audio, () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
      });
    };
    wsClient.on('server:assistant_audio_chunk', assistantAudioHandler);
    handlers.push({ remove: () => wsClient.off('server:assistant_audio_chunk', assistantAudioHandler) });

    const errorHandler = (payload: unknown) => {
      console.error('WebSocket error:', payload);
      setStatus('error');
    };
    wsClient.on('server:error', errorHandler);
    handlers.push({ remove: () => wsClient.off('server:error', errorHandler) });

    const turnStartHandler = (payload: unknown) => {
      const { speaker } = payload as { turnId: string; speaker: 'STUDENT' | 'AI' };
      if (speaker === 'STUDENT') {
        setIsRecording(true);
      }
    };
    wsClient.on('server:turn_start', turnStartHandler);
    handlers.push({ remove: () => wsClient.off('server:turn_start', turnStartHandler) });

    const turnEndHandler = (payload: unknown) => {
      const { speaker } = payload as { turnId: string; speaker: 'STUDENT' | 'AI' };
      if (speaker === 'STUDENT') {
        setIsRecording(false);
        audioRecorderRef.current?.stop();
      }
    };
    wsClient.on('server:turn_end', turnEndHandler);
    handlers.push({ remove: () => wsClient.off('server:turn_end', turnEndHandler) });

    return handlers;
  };

  const startRecording = async () => {
    try {
      await audioRecorderRef.current?.start((audioData) => {
        // Convert audio data and send to server
        const int16Data = floatTo16BitPCM(audioData);
        const base64Data = int16ToBase64(int16Data);
        wsClient.sendAudioChunk(base64Data);
      });

      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handlePushToTalk = () => {
    if (isManualMode && !countdown) {
      // Start recording
      setCountdown(3);
      startRecording();

      // Countdown then commit
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            setCountdown(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleReleaseToTalk = () => {
    if (isManualMode && audioRecorderRef.current?.getIsRecording()) {
      // Stop recording and commit
      audioRecorderRef.current.stop();
      setIsRecording(false);
      wsClient.commitAudio(true);
    }
  };

  const handleEndSession = async () => {
    setStatus('ending');

    // Stop recording
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
    }

    // End WebSocket session
    wsClient.endSession('completed');

    // End session via API
    try {
      await api.endSession(sessionId);
    } catch (error) {
      console.error('Failed to end session:', error);
    }

    // Navigate to report page using the REAL session ID from WebSocket
    router.push(`/report/${realSessionIdRef.current}`);
  };

  const cleanup = () => {
    // Remove all WebSocket event handlers
    wsHandlersRef.current.forEach(handler => handler.remove());
    wsHandlersRef.current = [];
    
    wsClient.disconnect();
    audioRecorderRef.current?.release();
    audioPlayerRef.current?.release();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-white font-semibold">
                {mode === 'FREE_TALK' && '自由对话'}
                {mode === 'ROLE_PLAY' && `情景：${scenario || '角色扮演'}`}
                {mode === 'REPEAT' && '跟读练习'}
              </h1>
              {topic && <p className="text-sm text-gray-400">话题：{topic}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="text-white font-mono text-lg">{formatTime(elapsedSeconds)}</div>

            {/* Connection Status */}
            <div className={`px-3 py-1 rounded-full text-sm ${
              isConnected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {isConnected ? '已连接' : '连接中...'}
            </div>

            {/* End Button */}
            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              结束练习
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Message List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="container mx-auto max-w-3xl">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p>正在建立连接...</p>
                <p className="text-sm mt-2">请允许麦克风权限并开始说话</p>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-4">
        <div className="container mx-auto flex items-center justify-center gap-4">
          {/* Recording Indicator */}
          <div className={`w-4 h-4 rounded-full ${
            useStore.getState().isRecording
              ? 'bg-red-500 animate-pulse'
              : 'bg-gray-600'
          }`} />

          {/* Speaking Indicator */}
          <div className={`w-4 h-4 rounded-full ${
            useStore.getState().isSpeaking
              ? 'bg-blue-500 animate-pulse'
              : 'bg-gray-600'
          }`} />

          {/* Push-to-Talk Button (Manual Mode) */}
          {isManualMode ? (
            <button
              onMouseDown={handlePushToTalk}
              onMouseUp={handleReleaseToTalk}
              onTouchStart={handlePushToTalk}
              onTouchEnd={handleReleaseToTalk}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition-all ${
                countdown
                  ? 'bg-yellow-500 text-white'
                  : useStore.getState().isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {countdown ? `${countdown}...` : '按住说话'}
            </button>
          ) : (
            <div className="text-gray-400">
              {useStore.getState().isRecording ? '正在录音...' : '请开始说话'}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-400 ml-4">
            <span className="w-3 h-3 rounded-full bg-red-500" /> 录音
            <span className="w-3 h-3 rounded-full bg-blue-500 ml-2" /> AI 发言
          </div>
        </div>
      </footer>
    </main>
  );
}

function MessageBubble({ message }: { message: { id: string; speaker: 'STUDENT' | 'AI'; text: string; isFinal: boolean; timestamp: number; sequenceNumber: number } }) {
  const isStudent = message.speaker === 'STUDENT';

  return (
    <div className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isStudent
            ? 'bg-primary-500 text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        <p className="text-sm opacity-70 mb-1">
          {isStudent ? '你' : 'AI'}
        </p>
        <div className="text-lg whitespace-pre-wrap break-words">
          {message.text}
          {!message.isFinal && (
            <span className="inline-block w-1.5 h-5 bg-current ml-1 align-middle animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
