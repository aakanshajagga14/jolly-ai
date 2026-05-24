import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ServerToClientMessage } from '../types';

type SendFn = (msg: ServerToClientMessage) => void;

export class DeepgramSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connection: any = null;
  private open = false;
  private stopped = false;
  private currentSampleRate = 48000;
  // Buffer chunks that arrive before the WS connection opens
  private pendingChunks: Buffer[] = [];
  private chunksSent = 0;

  constructor(
    private readonly sessionId: string,
    private readonly send: SendFn,
    private readonly onFinalTranscript: (text: string) => void
  ) {}

  start(sampleRate: number): void {
    if (this.stopped) return;
    this.open = false;
    this.currentSampleRate = sampleRate;

    const apiKey = process.env.DEEPGRAM_API_KEY ?? '';
    console.log(`[Deepgram:${this.sessionId}] Connecting at ${sampleRate} Hz (key: ${apiKey.slice(0, 8)}…)`);

    const deepgram = createClient(apiKey);
    const conn = deepgram.listen.live({
      encoding: 'linear16',
      sample_rate: sampleRate,
      channels: 1,
      model: 'nova-2',
      interim_results: true,
      smart_format: true,
      endpointing: 300,       // finalize after 300 ms of silence
      utterance_end_ms: 1000, // fire UtteranceEnd after 1 s of silence
    });

    conn.on(LiveTranscriptionEvents.Open, () => {
      if (this.stopped) { conn.finish?.(); return; }
      this.open = true;
      this.chunksSent = 0;
      console.log(`[Deepgram:${this.sessionId}] ✓ Connected — flushing ${this.pendingChunks.length} buffered chunk(s)`);
      for (const chunk of this.pendingChunks) {
        conn.send(chunk);
        this.chunksSent++;
      }
      this.pendingChunks = [];
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conn.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const alt = data?.channel?.alternatives?.[0];

      // Log every transcript event so we can see if Deepgram is responding at all
      if (data?.is_final !== undefined) {
        const preview = alt?.transcript ? `"${alt.transcript.slice(0, 60)}"` : '(empty)';
        console.log(`[Deepgram:${this.sessionId}] transcript is_final=${String(data.is_final)} speech_final=${String(data.speech_final)} ${preview}`);
      }

      if (!alt?.transcript) return;

      if (data.is_final) {
        this.send({ type: 'STT_FINAL', text: alt.transcript });
        this.onFinalTranscript(alt.transcript);
      } else {
        this.send({ type: 'STT_PARTIAL', text: alt.transcript });
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conn.on(LiveTranscriptionEvents.UtteranceEnd, (data: any) => {
      console.log(`[Deepgram:${this.sessionId}] UtteranceEnd`, data);
    });

    conn.on(LiveTranscriptionEvents.Error, (err: unknown) => {
      console.error(`[Deepgram:${this.sessionId}] Error:`, err);
      this.open = false;
      this.send({ type: 'ERROR', code: 'STT_ERROR', message: 'Speech recognition disconnected. Reconnecting…' });
      if (!this.stopped) {
        setTimeout(() => this.start(this.currentSampleRate), 2000);
      }
    });

    conn.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[Deepgram:${this.sessionId}] Connection closed`);
      this.open = false;
    });

    this.connection = conn;
  }

  sendAudio(pcmBuffer: Buffer): void {
    if (this.stopped) return;
    if (!this.open) {
      this.pendingChunks.push(pcmBuffer);
      return;
    }
    this.connection.send(pcmBuffer);
    this.chunksSent++;
    // Log periodically so we can confirm audio is flowing
    if (this.chunksSent === 1 || this.chunksSent % 100 === 0) {
      console.log(`[Deepgram:${this.sessionId}] Audio flowing — chunk #${this.chunksSent} (${pcmBuffer.length} bytes)`);
    }
  }

  stop(): void {
    this.stopped = true;
    this.open = false;
    this.pendingChunks = [];
    try { this.connection?.finish?.(); } catch { /* ignore */ }
    this.connection = null;
    console.log(`[Deepgram:${this.sessionId}] Stopped`);
  }
}
