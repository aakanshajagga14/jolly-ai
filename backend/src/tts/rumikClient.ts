import type { AgentSpeaker } from '../types';

// 20 ms of Int16 PCM at 24 kHz mono = 960 samples × 2 bytes
const CHUNK_BYTES = 960 * 2;
const TTS_TIMEOUT_MS = 12_000; // mulberry can take a few seconds per response

export type AudioChunkCallback = (base64Chunk: string) => void;
export type TtsDoneCallback = () => void;

// Scan the WAV buffer for the "data" sub-chunk and return the PCM start offset
function findPcmOffset(buf: Buffer): number {
  for (let i = 12; i < Math.min(buf.length - 8, 256); i += 1) {
    if (
      buf[i] === 0x64 &&
      buf[i + 1] === 0x61 &&
      buf[i + 2] === 0x74 &&
      buf[i + 3] === 0x61
    ) {
      return i + 8; // skip "data" + 4-byte chunk-size field
    }
  }
  return 44; // standard WAV header fallback
}

// --- Voice descriptions (mulberry description-steered model) ---
//
// Witness: nervous civilian under oath. Voice shifts with stress level.
// Guide vocabulary used: age, accent, pitch, pacing, emotion, register, role.
const WITNESS_BASE_DESCRIPTION =
  'a nervous 30s american voice, conversational pacing, normal pitch, sounds like a pressured reluctant witness on the stand during cross-examination';

const WITNESS_STRESSED_DESCRIPTION =
  'a shaky stressed 30s american voice, brisk pacing, slightly high pitch, emotional, sounds like a witness cracking under intense questioning';

const WITNESS_BREAKING_DESCRIPTION =
  'a desperate breaking 30s american voice, fast pacing, high pitch, angry and defensive, sounds like a witness cornered and losing composure on the stand';

// Judge: authoritative presiding judge, stays consistent.
const JUDGE_DESCRIPTION =
  'a deep gravelly 50s american voice, conversational pacing, formal register, dramatic narrator, sounds like a stern authoritative courtroom judge commanding the room';

const JUDGE_ANGRY_DESCRIPTION =
  'a deep gravelly 50s american voice, brisk pacing, formal register, intense and angry, sounds like a courtroom judge losing patience and about to hold counsel in contempt';

// --- Inline emotion tags injected at the start of text ---
//
// Tags are dropped into the transcript and the model performs them.
// Full tag list: <laugh> <sigh> <chuckle> <gasp> <angry> <whisper> <cry> <scream> <excited> <sarcastic> <curious>

function witnessEmotion(stress: number): { tag: string; description: string } {
  if (stress >= 80) return { tag: '<angry>', description: WITNESS_BREAKING_DESCRIPTION };
  if (stress >= 60) return { tag: '<sigh>',  description: WITNESS_STRESSED_DESCRIPTION };
  return { tag: '', description: WITNESS_BASE_DESCRIPTION };
}

function judgeEmotion(intensity: number): { tag: string; description: string } {
  if (intensity >= 80) return { tag: '<angry>', description: JUDGE_ANGRY_DESCRIPTION };
  return { tag: '', description: JUDGE_DESCRIPTION };
}

// ---

export async function synthesize(
  text: string,
  speaker: AgentSpeaker,
  onChunk: AudioChunkCallback,
  onDone: TtsDoneCallback,
  intensity = 50  // witness: stress 0-100 | judge: emotional intensity 0-100
): Promise<void> {
  const baseUrl = process.env.RUMIK_BASE_URL;
  const apiKey  = process.env.RUMIK_API_KEY;

  if (!baseUrl || !apiKey) {
    // TTS not configured — text-only fallback
    onDone();
    return;
  }

  const isWitness = speaker === 'witness';
  const { tag, description } = isWitness
    ? witnessEmotion(intensity)
    : judgeEmotion(intensity);

  const speakerId = isWitness
    ? (process.env.RUMIK_WITNESS_SPEAKER ?? 'speaker_2')
    : (process.env.RUMIK_JUDGE_SPEAKER   ?? 'speaker_1');

  const taggedText = tag ? `${tag} ${text}` : text;

  const body = {
    model: 'mulberry',
    text: taggedText,
    description,
    speaker: speakerId,
  };

  console.log(`[TTS:${speaker}] intensity=${intensity} speaker=${speakerId} → "${taggedText.slice(0, 70)}…"`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v1/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      console.error(`[TTS:${speaker}] request failed — HTTP ${response.status}: ${errText}`);
      onDone();
      return;
    }

    const wav = Buffer.from(await response.arrayBuffer());
    console.log(`[TTS:${speaker}] WAV received — ${wav.length} bytes`);

    const pcmStart = findPcmOffset(wav);
    const pcm = wav.subarray(pcmStart);

    // Emit in 20 ms chunks (960 Int16 samples at 24 kHz)
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
      onChunk(pcm.subarray(offset, offset + CHUNK_BYTES).toString('base64'));
    }
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[TTS:${speaker}] error:`, err);
  }

  onDone();
}
