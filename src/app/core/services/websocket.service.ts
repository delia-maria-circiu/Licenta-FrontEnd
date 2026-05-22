import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ArduinoData {
  bpm: number;
  ibi: number;
  gsr: number;
  temp: number;
  finger: boolean;
}

export type WsStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;

  private readonly dataSubject   = new BehaviorSubject<ArduinoData | null>(null);
  private readonly statusSubject = new BehaviorSubject<WsStatus>('disconnected');

  public readonly data$   = this.dataSubject.asObservable();
  public readonly status$ = this.statusSubject.asObservable();

  private reconnectTimer: any;
  private url = '';
  private intentionalClose = false;

  constructor(private zone: NgZone) {}

  connect(url: string = 'ws://172.20.10.10:81'): void {
    this.url = url;
    this.intentionalClose = false;
    this.disconnect();
    this.attemptConnection();
  }

  private attemptConnection(): void {
    this.zone.run(() => this.statusSubject.next('connecting'));

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.zone.run(() => this.statusSubject.next('connected'));
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      this.zone.run(() => this.statusSubject.next('disconnected'));
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    // Suprima eroarea din consolă — onerror e suficient pentru a ști că a picat
    this.ws.onerror = () => {
      this.zone.run(() => this.statusSubject.next('error'));
      // Nu loga nimic — onclose va fi apelat automat după onerror
    };

    this.ws.onmessage = (ev) => {
      this.zone.run(() => {
        try {
          const data: ArduinoData = JSON.parse(ev.data);
          this.dataSubject.next(data);
        } catch {
          // ignoră mesaje malformate
        }
      });
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) this.attemptConnection();
    }, 3000);
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.statusSubject.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}