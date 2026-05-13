import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';

export interface ArduinoData {
  bpm: number;
  ibi: number;
  gsr: number;
  temp: number;
  finger: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private readonly dataSubject = new BehaviorSubject<ArduinoData | null>(null);
  public readonly data$ = this.dataSubject.asObservable();
private readonly statusSubject = new BehaviorSubject<'connected' | 'disconnected' | 'error'>('disconnected');
public readonly status$ = this.statusSubject.asObservable();
  private reconnectTimer: any;
  private url = '';

  constructor(private zone: NgZone) {}

  connect(url: string = 'ws://172.20.10.10:81'): void {
    this.url = url;
    this.disconnect();
    this.attemptConnection();
  }

  private attemptConnection(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.zone.run(() => this.statusSubject.next('connected'));
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };
    this.ws.onclose = (ev) => {
      this.zone.run(() => this.statusSubject.next('disconnected'));
      this.scheduleReconnect();
    };
    this.ws.onerror = () => this.zone.run(() => this.statusSubject.next('error'));
    this.ws.onmessage = (ev) => {
      this.zone.run(() => {
        try {
          const data: ArduinoData = JSON.parse(ev.data);
          this.dataSubject.next(data);
        } catch {
          // ignore malformed messages
        }
      });
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnection();
    }, 3000);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null; // avoid reconnection loop
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}