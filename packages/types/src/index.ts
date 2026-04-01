// Practice modes
export type PracticeMode = 'FREE_TALK' | 'ROLE_PLAY' | 'REPEAT';

export type Speaker = 'STUDENT' | 'AI';

export type SessionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EVALUATED';

// WebSocket event types - Client to Server
export type ClientEvent =
  | { type: 'client:start_session'; payload: StartSessionPayload }
  | { type: 'client:audio_chunk'; payload: AudioChunkPayload }
  | { type: 'client:commit_audio'; payload?: CommitAudioPayload }
  | { type: 'client:end_session'; payload?: EndSessionPayload }
  | { type: 'client:ping'; payload?: { timestamp: number } };

// WebSocket event types - Server to Client
export type ServerEvent =
  | { type: 'server:session_ready'; payload: SessionReadyPayload }
  | { type: 'server:user_transcript_delta'; payload: TranscriptDeltaPayload }
  | { type: 'server:assistant_text_delta'; payload: TextDeltaPayload }
  | { type: 'server:assistant_audio_chunk'; payload: AudioChunkServerPayload }
  | { type: 'server:report_ready'; payload: ReportReadyPayload }
  | { type: 'server:error'; payload: ErrorPayload }
  | { type: 'server:pong'; payload?: { timestamp: number } }
  | { type: 'server:turn_start'; payload: TurnStartPayload }
  | { type: 'server:turn_end'; payload: TurnEndPayload };

// Payloads
export interface StartSessionPayload {
  mode: PracticeMode;
  topic?: string;
  language?: string;
  level?: string;
  scenario?: string; // For role play
}

export interface AudioChunkPayload {
  audio: string; // Base64 encoded PCM data
  timestamp: number;
}

export interface CommitAudioPayload {
  triggerResponse?: boolean;
}

export interface EndSessionPayload {
  reason?: 'completed' | 'error' | 'timeout';
}

export interface SessionReadyPayload {
  sessionId: string;
  status: 'connected';
}

export interface TranscriptDeltaPayload {
  turnId: string;
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
  sequenceNumber?: number;
}

export interface TextDeltaPayload {
  turnId: string;
  text: string;
  isFinal: boolean;
  timestamp?: number;
  sequenceNumber?: number;
}

export interface AudioChunkServerPayload {
  audio: string; // Base64 encoded PCM data
  turnId: string;
}

export interface ReportReadyPayload {
  sessionId: string;
  report: EvaluationReport;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface TurnStartPayload {
  turnId: string;
  speaker: Speaker;
  timestamp?: number;
  sequenceNumber?: number;
}

export interface TurnEndPayload {
  turnId: string;
  speaker: Speaker;
  duration: number;
}

// Evaluation Report
export interface EvaluationReport {
  pronunciationScore: number;
  fluencyScore: number;
  grammarScore: number;
  vocabularyScore: number;
  taskCompletionScore: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  errorTags: string[];
  suggestedExpressions: string[];
  nextStepAdvice: string[];
  rawLlmOutput?: string;
}

// Database types (matching Prisma schema)
export interface PracticeSession {
  id: string;
  userId: string | null;
  mode: PracticeMode;
  topic: string | null;
  language: string;
  level: string;
  scenario: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeTurn {
  id: string;
  sessionId: string;
  turnIndex: number;
  speaker: Speaker;
  transcript: string | null;
  audioUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateSessionResponse {
  session: PracticeSession;
}

export interface SessionDetailResponse {
  session: PracticeSession & {
    turns: PracticeTurn[];
    report?: EvaluationReportData;
  };
}

export interface EvaluationReportData {
  id: string;
  sessionId: string;
  pronunciationScore: number | null;
  fluencyScore: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  taskCompletionScore: number | null;
  overallScore: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  errorTags: string[] | null;
  suggestedExpressions: string[] | null;
  nextStepAdvice: string[] | null;
  createdAt: Date;
}

export interface HistoryResponse {
  sessions: Array<{
    id: string;
    mode: PracticeMode;
    topic: string | null;
    language: string;
    level: string;
    startedAt: Date;
    durationSeconds: number | null;
    overallScore: number | null;
  }>;
}

export interface PresetResponse {
  modes: Array<{
    id: PracticeMode;
    name: string;
    description: string;
  }>;
  topics: Array<{
    id: string;
    mode: PracticeMode;
    name: string;
    description: string;
  }>;
  scenarios: Array<{
    id: string;
    name: string;
    description: string;
    roleInstructions: string;
  }>;
  levels: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}
