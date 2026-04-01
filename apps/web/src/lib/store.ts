/**
 * Global state store using Zustand
 * Manages session state, audio state, and UI state
 */

import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import { PracticeMode, SessionStatus, PracticeTurn, EvaluationReport } from '@students-talk/types';

interface Message {
  id: string;
  speaker: 'STUDENT' | 'AI';
  text: string;
  isFinal: boolean;
  timestamp: number;
  sequenceNumber: number;
  audioUrl?: string;
}

interface SessionState {
  // Session info
  sessionId: string | null;
  mode: PracticeMode | null;
  topic: string | null;
  status: SessionStatus | 'idle' | 'connecting' | 'active' | 'ending' | 'error';

  // Real-time state
  messages: Message[];
  currentTurnId: string | null;
  isRecording: boolean;
  isSpeaking: boolean; // AI is speaking
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Timing
  sessionStartTime: number | null;
  elapsedSeconds: number;

  // Settings
  selectedMode: PracticeMode;
  selectedTopic: string | null;
  selectedLevel: string;
  selectedScenario: string | null;

  // Evaluation
  report: EvaluationReport | null;

  // Actions
  setSessionId: (id: string) => void;
  setMode: (mode: PracticeMode) => void;
  setTopic: (topic: string | null) => void;
  setLevel: (level: string) => void;
  setScenario: (scenario: string | null) => void;
  setStatus: (status: SessionState['status']) => void;
  setConnectionState: (state: SessionState['connectionState']) => void;
  addMessage: (message: Partial<Message>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  appendMessageText: (id: string, text: string, speaker: 'AI' | 'STUDENT', isFinal: boolean) => void;
  setCurrentTurnId: (id: string | null) => void;
  setIsRecording: (recording: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setReport: (report: EvaluationReport | null) => void;
  resetSession: () => void;
  incrementElapsed: () => void;
}

export const useStore = create<SessionState>((set, get) => ({
  // Initial state
  sessionId: null,
  mode: null,
  topic: null,
  status: 'idle',
  messages: [],
  currentTurnId: null,
  isRecording: false,
  isSpeaking: false,
  connectionState: 'disconnected',
  sessionStartTime: null,
  elapsedSeconds: 0,
  selectedMode: 'FREE_TALK',
  selectedTopic: null,
  selectedLevel: 'intermediate',
  selectedScenario: null,
  report: null,

  setSessionId: (id) => set({ sessionId: id }),
  setMode: (mode) => set({ mode, selectedMode: mode }),
  setTopic: (topic) => set({ topic, selectedTopic: topic }),
  setLevel: (level) => set({ selectedLevel: level }),
  setScenario: (scenario) => set({ selectedScenario: scenario }),
  setStatus: (status) => set({ status }),
  setConnectionState: (state) => set({ connectionState: state }),

  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, {
      id: message.id || crypto.randomUUID(),
      speaker: message.speaker || 'STUDENT',
      text: message.text || '',
      isFinal: message.isFinal ?? false,
      timestamp: message.timestamp || Date.now(),
      sequenceNumber: message.sequenceNumber || 0,
      audioUrl: message.audioUrl,
    }];
    return { messages: newMessages.sort((a, b) => (a.sequenceNumber - b.sequenceNumber) || (a.timestamp - b.timestamp)) };
  }),

  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m),
  })),

  appendMessageText: (id, text, speaker, isFinal, sequenceNumber) => set((state) => {
    const existingIndex = state.messages.findIndex(m => m.id === id && m.speaker === speaker);
    if (existingIndex !== -1) {
      const newMessages = [...state.messages];
      newMessages[existingIndex] = {
        ...newMessages[existingIndex],
        text: newMessages[existingIndex].text + text,
        isFinal,
        sequenceNumber: sequenceNumber ?? newMessages[existingIndex].sequenceNumber
      };
      return { messages: newMessages.sort((a, b) => (a.sequenceNumber - b.sequenceNumber) || (a.timestamp - b.timestamp)) };
    } else {
      const newMessages = [...state.messages, {
        id,
        speaker,
        text,
        isFinal,
        timestamp: Date.now(),
        sequenceNumber: sequenceNumber || 0,
      }];
      return { messages: newMessages.sort((a, b) => (a.sequenceNumber - b.sequenceNumber) || (a.timestamp - b.timestamp)) };
    }
  }),

  setCurrentTurnId: (id) => set({ currentTurnId: id }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setReport: (report) => set({ report }),

  resetSession: () => set({
    sessionId: null,
    mode: get().selectedMode,
    topic: null,
    status: 'idle',
    messages: [],
    currentTurnId: null,
    isRecording: false,
    isSpeaking: false,
    connectionState: 'disconnected',
    sessionStartTime: null,
    elapsedSeconds: 0,
    report: null,
  }),

  incrementElapsed: () => set((state) => ({
    elapsedSeconds: state.elapsedSeconds + 1,
  })),
}));
