import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetMessage, OnlineRole } from './protocol';

type TransportListener = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: NetMessage) => void;
};

const transportInstances: MockTransport[] = [];

class MockTransport {
  private readonly role: OnlineRole;
  private listener: TransportListener = {};

  constructor(role: OnlineRole) {
    this.role = role;
    transportInstances.push(this);
  }

  setListener(listener: TransportListener): void {
    this.listener = listener;
  }

  async createOffer(): Promise<string> {
    return `offer-${this.role}`;
  }

  async acceptOfferAndCreateAnswer(): Promise<string> {
    return `answer-${this.role}`;
  }

  async acceptAnswer(): Promise<void> {
    return;
  }

  send(): boolean {
    return true;
  }

  destroy(): void {
    return;
  }

  getRole(): OnlineRole {
    return this.role;
  }

  emitOpen(): void {
    this.listener.onOpen?.();
  }

  emitMessage(message: NetMessage): void {
    this.listener.onMessage?.(message);
  }
}

vi.mock('./webrtcTransport', () => ({
  WebRtcManualTransport: MockTransport
}));

describe('onlineSession reconnect lifecycle', () => {
  beforeEach(() => {
    transportInstances.length = 0;
    vi.resetModules();
  });

  it('host reconnect keeps host role and restarts signaling', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.host('Alice');

    const offer = await onlineSession.reconnectHost();

    expect(offer).toBe('offer-host');
    expect(onlineSession.getRole()).toBe('host');
    expect(onlineSession.getStatus()).toBe('signaling');
  });

  it('guest reconnect keeps guest role and restarts signaling', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.join('Bob', 'initial-offer');

    const answer = await onlineSession.reconnectGuest('reconnect-offer');

    expect(answer).toBe('answer-guest');
    expect(onlineSession.getRole()).toBe('guest');
    expect(onlineSession.getStatus()).toBe('signaling');
  });

  it('updates status and remote name when transport emits events', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.host('Alice');

    const transport = transportInstances.at(-1);
    expect(transport).toBeTruthy();

    transport!.emitOpen();
    expect(onlineSession.getStatus()).toBe('connected');

    transport!.emitMessage({
      type: 'hello',
      payload: { name: 'Bob', role: 'guest' }
    });
    expect(onlineSession.getRemoteName()).toBe('Bob');
  });
});
