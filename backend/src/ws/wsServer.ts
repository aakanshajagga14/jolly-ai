import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { parse as parseUrl } from 'url';
import { verifyToken } from '../auth/jwt';
import { createSession, destroySession, getSession } from '../store/sessionStore';
import { VoicePipelineOrchestrator } from '../pipeline/VoicePipelineOrchestrator';
import type { ClientToServerMessage, ServerToClientMessage, SessionEndReason } from '../types';

const orchestrators = new Map<string, VoicePipelineOrchestrator>();

function sendTo(ws: WebSocket, message: ServerToClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const query = parseUrl(req.url ?? '', true).query;
    const token = typeof query.token === 'string' ? query.token : null;

    if (!token) {
      console.warn('[WS] Connection rejected — missing token');
      ws.close(4001, 'Missing token');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.warn('[WS] Connection rejected — invalid or expired token');
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const { sessionId, caseContext } = payload;
    console.log(`[WS] ✓ Client connected — session: ${sessionId}, case: ${caseContext.caseId}`);

    createSession(sessionId, caseContext, (id) => {
      console.log(`[Session] ⏱  Session ${id} expired (10-min timeout)`);
      handleSessionEnd(id, ws, 'timeout');
    });

    const orchestrator = new VoicePipelineOrchestrator(
      sessionId,
      (msg) => sendTo(ws, msg),
      (reason) => handleSessionEnd(sessionId, ws, reason)
    );

    orchestrators.set(sessionId, orchestrator);
    orchestrator.start();
    console.log(`[Session] Pipeline started for ${sessionId}`);

    ws.on('message', (raw) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(String(raw)) as ClientToServerMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'AUTH':
          // Token already validated on connection — no-op
          break;

        case 'AUDIO_CHUNK':
          orchestrator.handleAudioChunk(message.data, message.sampleRate);
          break;

        case 'SESSION_END_REQUEST':
          orchestrator.endSession('user');
          break;

        default:
          break;
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected — session: ${sessionId}`);
      const session = getSession(sessionId);
      if (session?.status === 'active') {
        orchestrators.get(sessionId)?.endSession('user');
      }
      orchestrators.delete(sessionId);
    });

    ws.on('error', () => {
      ws.close();
    });
  });
}

function handleSessionEnd(sessionId: string, ws: WebSocket, reason: SessionEndReason): void {
  const session = getSession(sessionId);
  if (!session) return;

  sendTo(ws, {
    type: 'SESSION_END',
    reason,
    transcript: session.transcript,
  });

  orchestrators.delete(sessionId);
  destroySession(sessionId);

  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Session ended');
    }
  }, 500);
}
