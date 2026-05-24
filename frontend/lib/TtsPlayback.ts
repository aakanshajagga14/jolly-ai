import type { AgentSpeaker } from '@/types';
import { base64ToInt16, int16ToFloat32 } from '@/lib/audioUtils';

interface ActiveSource {
  speaker: AgentSpeaker;
  source: AudioBufferSourceNode;
}

export class TtsPlayback {
  private context: AudioContext | null = null;
  private activeSources: ActiveSource[] = [];
  private queue: Array<{ speaker: AgentSpeaker; pcm: Int16Array; sampleRate: number }> = [];
  private playing = false;

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    return this.context;
  }

  async enqueueChunk(
    base64Pcm: string,
    speaker: AgentSpeaker,
    sampleRate = 24000
  ): Promise<void> {
    const pcm = base64ToInt16(base64Pcm);
    this.queue.push({ speaker, pcm, sampleRate });
    if (!this.playing) {
      await this.drainQueue();
    }
  }

  stopAll(): void {
    this.queue = [];
    this.playing = false;
    this.activeSources.forEach(({ source }) => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    });
    this.activeSources = [];
  }

  destroy(): void {
    this.stopAll();
    void this.context?.close();
    this.context = null;
  }

  private async drainQueue(): Promise<void> {
    this.playing = true;
    while (this.queue.length > 0) {
      const chunk = this.queue.shift();
      if (!chunk) break;
      await this.playChunk(chunk.pcm, chunk.sampleRate, chunk.speaker);
    }
    this.playing = false;
  }

  private async playChunk(
    pcm: Int16Array,
    sampleRate: number,
    speaker: AgentSpeaker
  ): Promise<void> {
    const context = await this.ensureContext();
    const floatSamples = int16ToFloat32(pcm);
    const channelData = new Float32Array(floatSamples);
    const buffer = context.createBuffer(1, channelData.length, sampleRate);
    buffer.copyToChannel(channelData, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const active: ActiveSource = { speaker, source };
    this.activeSources.push(active);

    await new Promise<void>((resolve) => {
      source.onended = () => {
        this.activeSources = this.activeSources.filter((entry) => entry.source !== source);
        resolve();
      };
      source.start();
    });
  }
}
