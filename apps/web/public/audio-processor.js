/**
 * AudioWorklet processor for real-time audio capture
 * Outputs 16kHz mono PCM audio data
 */

class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;
    this.isRecording = true;

    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this.isRecording = false;
        // Send remaining buffer
        if (this.bufferIndex > 0) {
          this.sendBuffer();
        }
      }
    };
  }

  process(inputs) {
    if (!this.isRecording) {
      return false;
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    // Mix down to mono if multiple channels
    const channel0 = input[0];
    if (!channel0) return true;

    for (let i = 0; i < channel0.length; i++) {
      if (this.bufferIndex >= this.chunkSize) {
        this.sendBuffer();
        this.bufferIndex = 0;
      }
      this.buffer[this.bufferIndex++] = channel0[i];
    }

    return true;
  }

  sendBuffer() {
    this.port.postMessage({
      audioData: this.buffer.slice(0, this.bufferIndex),
    });
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
