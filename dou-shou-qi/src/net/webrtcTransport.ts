import { NetMessage, OnlineRole } from './protocol';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function encodeSignal(value: unknown): string {
  return btoa(JSON.stringify(value));
}

function decodeSignal<T>(value: string): T {
  return JSON.parse(atob(value)) as T;
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
    return encodeSignal(this.pc.localDescription);
  }

  async acceptOfferAndCreateAnswer(encodedOffer: string): Promise<string> {
    this.ensureDestroyed();
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.ondatachannel = (event) => {
      this.channel = event.channel;
      this.bindChannel(event.channel);
    };
    const offer = decodeSignal<RTCSessionDescriptionInit>(encodedOffer);
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceGathering(this.pc);
    return encodeSignal(this.pc.localDescription);
  }

  async acceptAnswer(encodedAnswer: string): Promise<void> {
    if (!this.pc) {
      throw new Error('Peer connection is not initialized.');
    }
    const answer = decodeSignal<RTCSessionDescriptionInit>(encodedAnswer);
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
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

