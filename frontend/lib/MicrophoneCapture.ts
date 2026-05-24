import { float32ToInt16, frameSizeForSampleRate, int16ToBase64 } from '@/lib/audioUtils';
import type { EventBus, MicrophoneCaptureOptions, MicrophoneCaptureState } from '@/types';

const MOCK_PULSE_MS = 8000;

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mockInterval: ReturnType<typeof setInterval> | null = null;
  private eventBus: EventBus | null = null;
  private onPcmFrame: ((data: string, sampleRate: number) => void) | null = null;
  private state: MicrophoneCaptureState = 'idle';
  private onStateChange: ((state: MicrophoneCaptureState) => void) | null = null;

  async start(
    options: MicrophoneCaptureOptions,
    onStateChange?: (state: MicrophoneCaptureState) => void
  ): Promise<void> {
    this.stop();
    this.eventBus = options.eventBus;
    this.onPcmFrame = options.onPcmFrame;
    this.onStateChange = onStateChange ?? null;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.startMockCapture();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext();
      const sampleRate = this.audioContext.sampleRate;
      await this.audioContext.audioWorklet.addModule('/audio/pcm-capture-processor.js');

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor', {
        processorOptions: { sampleRate },
      });

      this.workletNode.port.onmessage = (event: MessageEvent<{ type: string; samples: Float32Array }>) => {
        if (event.data.type !== 'pcm' || !this.onPcmFrame) {
          return;
        }

        const pcm = float32ToInt16(event.data.samples);
        const base64 = int16ToBase64(pcm);
        this.onPcmFrame(base64, sampleRate);
        this.eventBus?.emit('mic_active', { active: true });
      };

      source.connect(this.workletNode);
      this.setState('active');
    } catch (err) {
      console.error(
        '[MicrophoneCapture] Microphone access failed — falling back to SILENT mock mode. Speech will NOT be transcribed.',
        err
      );
      this.startMockCapture();
    }
  }

  stop(): void {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }

    this.workletNode?.disconnect();
    this.workletNode = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    void this.audioContext?.close();
    this.audioContext = null;

    this.eventBus?.emit('mic_active', { active: false });
    this.eventBus = null;
    this.onPcmFrame = null;
    this.setState('idle');
  }

  getState(): MicrophoneCaptureState {
    return this.state;
  }

  private startMockCapture(): void {
    this.setState('mock');
    this.mockInterval = setInterval(() => {
      if (!this.onPcmFrame || !this.eventBus) {
        return;
      }

      const sampleRate = 48000;
      const frameSize = frameSizeForSampleRate(sampleRate);
      const silence = new Float32Array(frameSize);
      const pcm = float32ToInt16(silence);
      this.onPcmFrame(int16ToBase64(pcm), sampleRate);
      this.eventBus.emit('mic_active', { active: true });
      setTimeout(() => {
        this.eventBus?.emit('mic_active', { active: false });
      }, 1500);
    }, MOCK_PULSE_MS);
  }

  private setState(state: MicrophoneCaptureState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
