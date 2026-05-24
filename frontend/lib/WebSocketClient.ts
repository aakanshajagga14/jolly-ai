import { startMockSession } from '@/lib/mockSession';
import type {
  ClientToServerMessage,
  EventBus,
  ServerToClientMessage,
  WebSocketClientOptions,
  WebSocketConnectionState,
} from '@/types';

type MessageHandler = (message: ServerToClientMessage) => void;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

function shouldUseMock(options: WebSocketClientOptions): boolean {
  if (options.useMock !== undefined) {
    return options.useMock;
  }
  return process.env.NEXT_PUBLIC_USE_MOCK_WS !== 'false';
}

function buildWsUrl(wsUrl: string, token: string): string {
  const separator = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
}

export class WebSocketClient {
  private eventBus: EventBus | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private ws: WebSocket | null = null;
  private wsUrl = '';
  private token = '';
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopMock: (() => void) | null = null;
  private intentionalClose = false;
  private onConnectionChange: ((state: WebSocketConnectionState) => void) | null = null;
  private mockActive = false;

  connect(options: WebSocketClientOptions): void {
    this.disconnect(false);
    this.eventBus = options.eventBus;
    this.wsUrl = options.wsUrl;
    this.token = options.token;
    this.onConnectionChange = options.onConnectionChange ?? null;
    this.intentionalClose = false;
    this.retryCount = 0;

    if (shouldUseMock(options)) {
      this.startMockTransport();
      return;
    }

    this.openSocket();
  }

  send(message: ClientToServerMessage): void {
    if (this.mockActive) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: ServerToClientMessage['type'], handler: MessageHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  disconnect(intentional = true): void {
    this.intentionalClose = intentional;
    this.mockActive = false;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.stopMock?.();
    this.stopMock = null;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.handlers.clear();
    this.eventBus = null;
    this.setConnectionState('disconnected');
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    this.onConnectionChange?.(state);
  }

  private startMockTransport(): void {
    this.mockActive = true;
    this.setConnectionState('mock');
    const sessionStartMs = Date.now();
    this.stopMock = startMockSession((message) => this.dispatch(message), sessionStartMs);
  }

  private openSocket(): void {
    this.setConnectionState(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(buildWsUrl(this.wsUrl, this.token));
    } catch {
      this.handleConnectionFailure();
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.setConnectionState('connected');
      this.send({ type: 'AUTH', token: this.token });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerToClientMessage;
        this.dispatch(message);
      } catch {
        this.dispatch({
          type: 'ERROR',
          code: 'PARSE_ERROR',
          message: 'Received malformed WebSocket payload.',
        });
      }
    };

    this.ws.onerror = () => {
      this.handleConnectionFailure();
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) {
        this.setConnectionState('disconnected');
        return;
      }
      this.handleConnectionFailure();
    };
  }

  private handleConnectionFailure(): void {
    if (this.intentionalClose) {
      return;
    }

    if (this.retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * 2 ** this.retryCount;
      this.retryCount += 1;
      this.setConnectionState('reconnecting');
      this.retryTimer = setTimeout(() => this.openSocket(), delay);
      return;
    }

    this.startMockTransport();
  }

  private dispatch(message: ServerToClientMessage): void {
    this.eventBus?.emit('ws_message', message);

    const handlers = this.handlers.get(message.type) ?? [];
    handlers.forEach((handler) => handler(message));

    switch (message.type) {
      case 'ANIMATION_CMD':
        this.eventBus?.emit('animation_cmd', message);
        break;
      case 'COACHING_HINT':
        this.eventBus?.emit('coaching_hint', message);
        break;
      case 'AGENT_RESPONSE':
        this.eventBus?.emit('agent_response', message);
        break;
      case 'STT_PARTIAL':
        this.eventBus?.emit('stt_partial', message);
        break;
      case 'STT_FINAL':
        this.eventBus?.emit('stt_final', message);
        break;
      case 'SESSION_READY':
        this.eventBus?.emit('session_ready', message);
        break;
      case 'SESSION_END':
        this.eventBus?.emit('session_end', message);
        break;
      case 'TIMER_UPDATE':
        this.eventBus?.emit('timer_update', message);
        break;
      case 'VAD_INTERRUPT':
        this.eventBus?.emit('vad_interrupt', message);
        break;
      case 'ERROR':
        this.eventBus?.emit('error', message);
        break;
      default:
        break;
    }
  }
}
