import type { ServerToClientMessage, SessionEndReason, CaseContext, AnimationType } from '../types';
import { DeepgramSession } from '../stt/deepgramClient';
import { synthesize } from '../tts/rumikClient';
import { WitnessAgent } from '../agents/witness';
import { JudgeAgent } from '../agents/judge';
import { evaluateQuestion } from '../agents/lawyerCoach';
import { getSession, updateSession } from '../store/sessionStore';
import { appendEntry } from '../transcript/transcriptLogger';

type SendFn = (msg: ServerToClientMessage) => void;

export class VoicePipelineOrchestrator {
  private deepgramSession: DeepgramSession;
  private witnessAgent: WitnessAgent;
  private judgeAgent: JudgeAgent;
  private caseContext: CaseContext;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private ttsPlaying = false;
  private currentSampleRate = 48000;
  private processing = false;
  private deepgramStarted = false;

  constructor(
    private readonly sessionId: string,
    private readonly send: SendFn,
    private readonly onSessionEnd: (reason: SessionEndReason) => void
  ) {
    const session = getSession(sessionId)!;
    this.caseContext = session.caseContext;
    this.witnessAgent = new WitnessAgent(session.caseContext);
    this.judgeAgent = new JudgeAgent(session.caseContext);
    this.deepgramSession = new DeepgramSession(
      sessionId,
      send,
      (text) => { void this.handleFinalTranscript(text); }
    );
  }

  start(): void {
    // Deepgram is started lazily on first audio chunk so we have the real sample rate
    this.startTimer();

    appendEntry(this.sessionId, 'system', 'Session started. Cross-examination in progress.');

    const session = getSession(this.sessionId)!;
    this.send({ type: 'SESSION_READY', sessionId: this.sessionId, expiresAt: session.expiresAt });

    // Judge delivers courtroom opening statement
    void this.playOpeningStatement();
  }

  private async playOpeningStatement(): Promise<void> {
    const { caseId, summary } = this.caseContext;
    const brief = summary.length > 120 ? summary.slice(0, 117) + '...' : summary;
    const intro = `All rise. This court is now in session. We are here today in the matter of case ${caseId}. ${brief}. The witness has been sworn in and is called to the stand for cross-examination. Counsel, you may proceed when ready.`;

    console.log(`[Pipeline:${this.sessionId}] Judge opening statement`);
    appendEntry(this.sessionId, 'judge', intro);
    this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: intro });
    await this.playJudgeTts(intro, 'talking', 50);
  }

  // Plays judge TTS with animation; intensity drives the emotion tag in rumikClient
  private async playJudgeTts(text: string, animation: AnimationType, intensity: number): Promise<void> {
    this.send({ type: 'ANIMATION_CMD', target: 'judge', animation });
    this.ttsPlaying = true;
    await synthesize(
      text,
      'judge',
      (chunk) => this.send({ type: 'AUDIO_CHUNK', data: chunk, speaker: 'judge' }),
      () => {
        this.ttsPlaying = false;
        this.send({ type: 'ANIMATION_CMD', target: 'judge', animation: 'idle' });
      },
      intensity
    );
  }

  handleAudioChunk(base64Pcm: string, sampleRate: number): void {
    if (!this.deepgramStarted) {
      this.currentSampleRate = sampleRate;
      this.deepgramStarted = true;
      console.log(`[Pipeline:${this.sessionId}] First audio chunk — starting Deepgram at ${sampleRate} Hz`);
      this.deepgramSession.start(sampleRate);
    } else if (sampleRate !== this.currentSampleRate) {
      // Sample rate changed mid-session — restart with new rate
      console.log(`[Pipeline:${this.sessionId}] Sample rate changed ${this.currentSampleRate} → ${sampleRate} Hz, restarting Deepgram`);
      this.currentSampleRate = sampleRate;
      this.deepgramSession.stop();
      this.deepgramSession = new DeepgramSession(
        this.sessionId,
        this.send,
        (text) => { void this.handleFinalTranscript(text); }
      );
      this.deepgramSession.start(sampleRate);
    }

    if (this.ttsPlaying) {
      this.send({ type: 'VAD_INTERRUPT' });
      this.ttsPlaying = false;
    }

    const pcmBuffer = Buffer.from(base64Pcm, 'base64');
    this.deepgramSession.sendAudio(pcmBuffer);
  }

  endSession(reason: SessionEndReason): void {
    this.cleanup();
    this.onSessionEnd(reason);
  }

  private async handleFinalTranscript(question: string): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const session = getSession(this.sessionId);
      if (!session || session.status !== 'active') return;

      console.log(`[Pipeline:${this.sessionId}] Lawyer: "${question}"`);
      appendEntry(this.sessionId, 'lawyer', question);

      // Dispatch coaching and witness concurrently
      const [coachingHint, witnessResponse] = await Promise.all([
        evaluateQuestion(question, session.caseContext, 'pre-turn'),
        this.witnessAgent.respond(question, session.agentState),
      ]);

      console.log(`[Pipeline:${this.sessionId}] Witness: "${witnessResponse.text.slice(0, 80)}…" stress=${witnessResponse.stressLevel}${witnessResponse.objection ? ` OBJECTION: ${witnessResponse.objection}` : ''}`);
      if (coachingHint) {
        console.log(`[Pipeline:${this.sessionId}] Coach hint: [${coachingHint.strength}] ${coachingHint.suggestion}`);
        this.send({ type: 'COACHING_HINT', hint: coachingHint });
      }

      // Judge evaluates witness objection
      const judgeResponse = await this.judgeAgent.rule(
        witnessResponse.objection,
        question,
        session.agentState
      );

      // Refresh session after async calls
      const currentSession = getSession(this.sessionId);
      if (!currentSession) return;

      let { judgePatience, sustainedObjectionsInARow } = currentSession.agentState;
      const newStress = witnessResponse.stressLevel;

      if (judgeResponse.ruling === 'sustained') {
        sustainedObjectionsInARow += 1;
        judgePatience = Math.max(0, judgePatience - 10);
      } else if (judgeResponse.ruling === 'overruled') {
        sustainedObjectionsInARow = 0;
        judgePatience = Math.min(100, judgePatience + 5);
      }

      updateSession(this.sessionId, {
        agentState: { witnessStress: newStress, judgePatience, sustainedObjectionsInARow },
      });

      // Stress animations
      if (newStress >= 80) {
        this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'very-stressed' });
      } else if (newStress >= 60) {
        this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'stressed' });
      }

      console.log(`[Pipeline:${this.sessionId}] Judge ruling: ${judgeResponse.ruling} — "${judgeResponse.text.slice(0, 80)}"`);

      // Contempt — judge delivers verdict, then session ends
      if (judgeResponse.ruling === 'contempt' || judgePatience <= 0) {
        appendEntry(this.sessionId, 'judge', judgeResponse.text);
        this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
        await this.playJudgeTts(judgeResponse.text, 'contempt', 100); // maximum anger
        this.endSession('contempt');
        return;
      }

      // Warning — judge speaks with anger, witness still answers after
      if (judgeResponse.ruling === 'warning') {
        appendEntry(this.sessionId, 'judge', judgeResponse.text);
        this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
        await this.playJudgeTts(judgeResponse.text, 'gavel-slam', 80); // stern anger
      }

      // Sustained — judge rules, blocks witness
      if (judgeResponse.ruling === 'sustained') {
        appendEntry(this.sessionId, 'judge', judgeResponse.text);
        this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
        await this.playJudgeTts(judgeResponse.text, 'gavel-slam', 60); // firm
        this.send({
          type: 'ERROR',
          code: 'OBJECTION_SUSTAINED',
          message: 'Objection sustained. Please rephrase your question.',
        });
        return;
      }

      // Overruled — witness speaks first, judge optionally comments after
      appendEntry(this.sessionId, 'witness', witnessResponse.text);
      this.send({ type: 'AGENT_RESPONSE', speaker: 'witness', text: witnessResponse.text });
      this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'talking' });

      console.log(`[Pipeline:${this.sessionId}] TTS → witness (stress=${newStress})`);
      this.ttsPlaying = true;
      await synthesize(
        witnessResponse.text,
        'witness',
        (chunk) => this.send({ type: 'AUDIO_CHUNK', data: chunk, speaker: 'witness' }),
        () => {
          console.log(`[Pipeline:${this.sessionId}] TTS done — witness idle`);
          this.ttsPlaying = false;
          this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'idle' });
        },
        newStress
      );

      // Judge speaks after witness (skip if judge chose to stay silent this turn)
      if (judgeResponse.ruling !== 'none' && judgeResponse.text) {
        appendEntry(this.sessionId, 'judge', judgeResponse.text);
        this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
        await this.playJudgeTts(judgeResponse.text, 'talking', 50); // measured
      }
    } finally {
      this.processing = false;
    }
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      const session = getSession(this.sessionId);
      if (!session) return;

      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        this.endSession('timeout');
        return;
      }
      this.send({ type: 'TIMER_UPDATE', remainingMs: remaining });
    }, 1000);
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.deepgramSession.stop();
  }
}
