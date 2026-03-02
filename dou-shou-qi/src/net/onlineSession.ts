import { GameState, PlayerTurn } from '../data/types';
import { NetMessage, OnlineActionRequest, OnlineRole } from './protocol';
import { WebRtcManualTransport } from './webrtcTransport';

export interface OnlineSnapshot {
  state: GameState;
  hostName: string;
  guestName: string;
}

export type SessionStatus = 'offline' | 'signaling' | 'connected' | 'disconnected';

type SessionListener = {
  onStatus?: (status: SessionStatus) => void;
  onMessage?: (message: NetMessage) => void;
};

class OnlineSession {
  private transport: WebRtcManualTransport | null = null;
  private listener: SessionListener = {};
  private role: OnlineRole | null = null;
  private localName = 'Guest';
  private remoteName = 'Opponent';
  private status: SessionStatus = 'offline';

  setListener(listener: SessionListener): void {
    this.listener = listener;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getRole(): OnlineRole | null {
    return this.role;
  }

  getLocalName(): string {
    return this.localName;
  }

  getRemoteName(): string {
    return this.remoteName;
  }

  localTurn(): PlayerTurn {
    return this.role === 'host' ? 'player1' : 'player2';
  }

  remoteTurn(): PlayerTurn {
    return this.role === 'host' ? 'player2' : 'player1';
  }

  private applyStatus(next: SessionStatus): void {
    this.status = next;
    this.listener.onStatus?.(next);
  }

  private bindTransport(transport: WebRtcManualTransport): void {
    transport.setListener({
      onOpen: () => {
        this.applyStatus('connected');
        this.send({ type: 'hello', payload: { name: this.localName, role: this.role ?? 'guest' } });
      },
      onClose: () => {
        this.applyStatus('disconnected');
      },
      onMessage: (message) => {
        if (message.type === 'hello') {
          this.remoteName = message.payload.name;
        }
        if (message.type === 'ping') {
          this.send({ type: 'pong', payload: { at: message.payload.at } });
        }
        this.listener.onMessage?.(message);
      }
    });
  }

  async host(localName: string): Promise<string> {
    this.reset();
    this.localName = localName;
    this.remoteName = 'Opponent';
    this.role = 'host';
    this.applyStatus('signaling');
    const transport = new WebRtcManualTransport('host');
    this.transport = transport;
    this.bindTransport(transport);
    return transport.createOffer();
  }

  async reconnectHost(): Promise<string> {
    if (this.role !== 'host') {
      throw new Error('Reconnect host is only available for host role.');
    }
    this.transport?.destroy();
    this.transport = null;
    this.remoteName = 'Opponent';
    this.applyStatus('signaling');
    const transport = new WebRtcManualTransport('host');
    this.transport = transport;
    this.bindTransport(transport);
    return transport.createOffer();
  }

  async hostAcceptAnswer(answerCode: string): Promise<void> {
    if (!this.transport || this.transport.getRole() !== 'host') {
      throw new Error('Host session is not initialized.');
    }
    await this.transport.acceptAnswer(answerCode);
  }

  async join(localName: string, offerCode: string): Promise<string> {
    this.reset();
    this.localName = localName;
    this.remoteName = 'Host';
    this.role = 'guest';
    this.applyStatus('signaling');
    const transport = new WebRtcManualTransport('guest');
    this.transport = transport;
    this.bindTransport(transport);
    return transport.acceptOfferAndCreateAnswer(offerCode);
  }

  async reconnectGuest(offerCode: string): Promise<string> {
    if (this.role !== 'guest') {
      throw new Error('Reconnect join is only available for guest role.');
    }
    this.transport?.destroy();
    this.transport = null;
    this.remoteName = 'Host';
    this.applyStatus('signaling');
    const transport = new WebRtcManualTransport('guest');
    this.transport = transport;
    this.bindTransport(transport);
    return transport.acceptOfferAndCreateAnswer(offerCode);
  }

  send(message: NetMessage): boolean {
    if (!this.transport) {
      return false;
    }
    return this.transport.send(message);
  }

  requestAction(action: OnlineActionRequest): boolean {
    return this.send({ type: 'actionRequest', payload: action });
  }

  sendSnapshot(snapshot: OnlineSnapshot): boolean {
    return this.send({ type: 'stateSnapshot', payload: snapshot });
  }

  ping(): void {
    this.send({ type: 'ping', payload: { at: Date.now() } });
  }

  reset(): void {
    this.transport?.destroy();
    this.transport = null;
    this.role = null;
    this.applyStatus('offline');
  }
}

export const onlineSession = new OnlineSession();
