import { NetMessage, OnlineRole } from './protocol';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function encodeSignal(value: unknown): string {
  return btoa(JSON.stringify(value));
}

function decodeSignal<T>(value: string): T {
  return JSON.parse(atob(value)) as T;
}

function parseSessionDescriptionPayload(encoded: string, label: 'Offer' | 'Answer'): RTCSessionDescriptionInit {
  const trimmed = encoded.trim();
  if (!trimmed) {
    throw new Error(`${label} payload is empty.`);
  }

  let parsed: unknown;
  try {
    parsed = decodeSignal<unknown>(trimmed);
  } catch {
    throw new Error(`${label} payload is malformed.`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${label} payload is missing.`);
  }

  const desc = parsed as RTCSessionDescriptionInit;
  if (!desc.type || !desc.sdp) {
    throw new Error(`${label} payload is invalid.`);
  }

  return desc;
}

async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return;
  }

  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }, 3000);
  });
}

type Listener = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: NetMessage) => void;
};

export class WebRtcManualTransport {
  private readonly role: OnlineRole;
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private listener: Listener = {};

  constructor(role: OnlineRole) {
    this.role = role;
  }

  setListener(listener: Listener): void {
    this.listener = listener;
  }

  async createOffer(): Promise<string> {
    this.ensureDestroyed();
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = this.pc.createDataChannel('dou-shou-qi');
    this.bindChannel(channel);
    this.channel = channel;

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);
    const localDescription = this.pc.localDescription;
    if (!localDescription || !localDescription.type || !localDescription.sdp) {
      throw new Error('Offer generation failed.');
    }
    return encodeSignal(localDescription);
  }

  async acceptOfferAndCreateAnswer(encodedOffer: string): Promise<string> {
    this.ensureDestroyed();
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ondatachannel = (event) => {
      this.channel = event.channel;
      this.bindChannel(event.channel);
    };
    const offer = parseSessionDescriptionPayload(encodedOffer, 'Offer');
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceGathering(this.pc);
    const localDescription = this.pc.localDescription;
    if (!localDescription || !localDescription.type || !localDescription.sdp) {
      throw new Error('Answer generation failed.');
    }
    return encodeSignal(localDescription);
  }

  async acceptAnswer(encodedAnswer: string): Promise<void> {
    if (!this.pc) {
      throw new Error('Peer connection is not initialized.');
    }
    const answer = parseSessionDescriptionPayload(encodedAnswer, 'Answer');
    await this.pc.setRemoteDescription(answer);
  }

  send(message: NetMessage): boolean {
    if (!this.channel || this.channel.readyState !== 'open') {
      return false;
    }
    this.channel.send(JSON.stringify(message));
    return true;
  }

  isConnected(): boolean {
    return this.channel?.readyState === 'open';
  }

  destroy(): void {
    this.channel?.close();
    this.channel = null;
    this.pc?.close();
    this.pc = null;
  }

  private ensureDestroyed(): void {
    if (this.pc || this.channel) {
      this.destroy();
    }
  }

  private bindChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.listener.onOpen?.();
    };
    channel.onclose = () => {
      this.listener.onClose?.();
    };
    channel.onerror = () => {
      this.listener.onClose?.();
    };
    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as NetMessage;
        this.listener.onMessage?.(parsed);
      } catch {
        // Ignore malformed payloads in MVP transport
      }
    };
  }

  getRole(): OnlineRole {
    return this.role;
  }
}
