/**
 * Audio processing utilities
 * Handles 16kHz PCM audio capture using AudioWorklet
 */

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
};

/**
 * AudioRecorder class for capturing 16kHz PCM audio
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private isRecording = false;
  private onAudioData: ((chunk: Float32Array) => void) | null = null;

  async initialize(): Promise<void> {
    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  async start(onData: (chunk: Float32Array) => void): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    this.onAudioData = onData;

    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: DEFAULT_CONFIG.sampleRate });
    }

    if (!this.mediaStream) {
      await this.initialize();
    }

    // Load the audio worklet processor
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');

    // Create nodes
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream!);
    this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor');

    // Handle audio data from worklet
    this.audioWorkletNode.port.onmessage = (event) => {
      if (this.onAudioData && event.data?.audioData) {
        this.onAudioData(event.data.audioData);
      }
    };

    // Connect nodes
    this.sourceNode.connect(this.audioWorkletNode);

    this.isRecording = true;
  }

  stop(): void {
    if (!this.isRecording) return;

    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ command: 'stop' });
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.isRecording = false;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  release(): void {
    this.stop();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}

/**
 * AudioPlayer class for playing PCM audio chunks
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private queue: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;
  private outputSampleRate = 24000;

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.outputSampleRate });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async play(pcmBase64: string, onEnded?: () => void): Promise<void> {
    console.log('AudioPlayer.play called, pcmBase64 length:', pcmBase64?.length);
    
    if (!this.audioContext) {
      console.log('Creating new AudioContext');
      this.audioContext = new AudioContext({ sampleRate: this.outputSampleRate });
    }
    console.log('AudioContext state:', this.audioContext.state);
    if (this.audioContext.state === 'suspended') {
      console.log('Resuming suspended AudioContext');
      await this.audioContext.resume();
    }

    try {
      const binaryString = atob(pcmBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const samples = new Float32Array(len / 2);
      for (let i = 0; i < len / 2; i++) {
        const int16 = new DataView(bytes.buffer, i * 2).getInt16(0, true);
        samples[i] = int16 / 32768.0;
      }

      const audioBuffer = this.audioContext!.createBuffer(1, samples.length, this.outputSampleRate);
      audioBuffer.getChannelData(0).set(samples);

      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext!.destination);

      const currentTime = this.audioContext!.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);

      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      if (onEnded) {
        source.onended = onEnded;
      }

      this.queue.push(source);
      this.isPlaying = true;
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  stop(): void {
    this.queue.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.queue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  release(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * Convert Float32Array audio data to Int16Array (16-bit PCM)
 */
export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

/**
 * Convert Int16Array to base64 for WebSocket transmission
 */
export function int16ToBase64(int16Array: Int16Array): string {
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}
