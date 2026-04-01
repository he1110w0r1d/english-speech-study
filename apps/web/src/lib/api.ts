/**
 * WebSocket client for real-time communication with backend
 */

import { io, Socket } from 'socket.io-client';
import { ServerEvent, ClientEvent } from '@students-talk/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export class WebSocketClient {
  private socket: Socket | null = null;
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>();

  connect() {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected');
      return;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: false, // Don't auto-reconnect for practice sessions
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      // this.socket?.emit('server:error') doesn't make sense since socket is disconnected,
      // but if the developer intended to trigger local handlers:
      this.triggerLocalEvent('server:error', { code: 'DISCONNECTED', message: 'Connection lost' });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.triggerLocalEvent('server:error', { code: 'CONNECT_ERROR', message: error.message });
    });

    // Register event listeners
    this.registerEvent('server:session_ready');
    this.registerEvent('server:user_transcript_delta');
    this.registerEvent('server:assistant_text_delta');
    this.registerEvent('server:assistant_audio_chunk');
    this.registerEvent('server:report_ready');
    this.registerEvent('server:error');
    this.registerEvent('server:turn_start');
    this.registerEvent('server:turn_end');
    this.registerEvent('server:pong');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private registerEvent(eventType: string) {
    this.socket?.on(eventType, (payload: unknown) => {
      this.triggerLocalEvent(eventType, payload);
    });
  }

  private triggerLocalEvent(eventType: string, payload: unknown) {
    const handlers = this.eventHandlers.get(eventType);
    handlers?.forEach(handler => handler(payload));
  }

  on<T extends ServerEvent['type']>(
    event: T,
    handler: (payload: Extract<ServerEvent, { type: T }>['payload']) => void
  ) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as (payload: unknown) => void);
  }

  off<T extends ServerEvent['type']>(
    event: T,
    handler: (payload: Extract<ServerEvent, { type: T }>['payload']) => void
  ) {
    this.eventHandlers.get(event)?.delete(handler as (payload: unknown) => void);
  }

  emit<T extends ClientEvent['type']>(
    event: T,
    payload?: Extract<ClientEvent, { type: T }>['payload']
  ) {
    this.socket?.emit(event, payload);
  }

  startSession(payload: Extract<ClientEvent, { type: 'client:start_session' }>['payload']) {
    this.emit('client:start_session', payload);
  }

  sendAudioChunk(audio: string) {
    this.emit('client:audio_chunk', { audio, timestamp: Date.now() });
  }

  commitAudio(triggerResponse = true) {
    this.emit('client:commit_audio', { triggerResponse });
  }

  endSession(reason: 'completed' | 'error' | 'timeout' = 'completed') {
    this.emit('client:end_session', { reason });
  }

  ping() {
    this.emit('client:ping', { timestamp: Date.now() });
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

/**
 * REST API client
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `API error: ${response.status}`);
  }

  return data.data;
}

export const api = {
  // Sessions
  createSession: (data: { mode: string; topic?: string; level?: string; scenario?: string }) =>
    fetchApi('/sessions', { method: 'POST', body: JSON.stringify(data) }),

  startSession: (id: string) =>
    fetchApi(`/sessions/${id}/start`, { method: 'POST' }),

  endSession: (id: string) =>
    fetchApi(`/sessions/${id}/end`, { method: 'POST' }),

  getSession: (id: string) =>
    fetchApi(`/sessions/${id}`),

  getSessionReport: (id: string) =>
    fetchApi(`/sessions/${id}/report`),

  // History
  getHistory: () =>
    fetchApi('/history'),

  // Presets
  getPresets: () =>
    fetchApi('/presets'),
};
