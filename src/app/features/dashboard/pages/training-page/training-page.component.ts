import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { WebSocketService, ArduinoData } from '../../../../core/services/websocket.service';
import { SensorService } from '../../../../core/services/sensor.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-training-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './training-page.component.html',
  styleUrls: ['./training-page.component.scss']
})
export class TrainingPageComponent implements OnInit, OnDestroy {
  sessionActive = signal(false);
  sessionId = signal<number | null>(null);
  sessionLabel = signal<'relaxed' | 'stressed' | null>(null);

  seconds = signal(0);
  timerDisplay = signal('00:00');
  dataPoints = signal(0);

  statusMessage = signal('');
  fingerDetected = signal(false);

  private intervalRef?: any;
  private websocketSub?: Subscription;
  private currentUserId: number | null = null;

  constructor(
    private auth: AuthService,
    private sensorService: SensorService,
    private wsService: WebSocketService
  ) {
    const user = this.auth.getCurrentUser();
    this.currentUserId = user ? user.id : null;
  }

  ngOnInit(): void {
    this.wsService.connect('ws://172.20.10.10:81');
    this.websocketSub = this.wsService.data$.subscribe((data: ArduinoData | null) => {
      if (data) {
        this.fingerDetected.set(data.finger);
        if (data.finger && data.bpm > 0 && this.sessionActive() && this.currentUserId && this.sessionId()) {
          const reading = {
            bpm: data.bpm,
            ibi: data.ibi,
            gsr: data.gsr,
            temp: data.temp,
            finger: data.finger,
            label: this.sessionLabel() === 'relaxed' ? 0 : 1,
            userId: this.currentUserId,
            sessionId: this.sessionId()!
          };
          this.sensorService.saveReading(reading).subscribe({
            error: (err) => console.error('Save failed', err)
          });
          this.dataPoints.update(n => n + 1);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.websocketSub?.unsubscribe();
    this.wsService.disconnect();
  }

  private get userId(): number | null {
    const user = this.auth.getCurrentUser();
    return user ? user.id : null;
  }

  startRelaxed(): void {
    if (!this.userId || this.sessionActive()) return;
    this.startSession(0);
    this.sessionLabel.set('relaxed');
  }

  startStressed(): void {
    if (!this.userId || this.sessionActive()) return;
    this.startSession(1);
    this.sessionLabel.set('stressed');
  }

  private startSession(label: 0 | 1): void {
    const uid = this.userId!;
    this.sensorService.startSession({ label, userId: uid }).subscribe({
      next: (sid) => {
        this.sessionId.set(sid);
        this.sessionActive.set(true);
        this.dataPoints.set(0);
        this.seconds.set(0);
        this.startTimer();
        this.statusMessage.set('Session started.');
      },
      error: (err) => this.statusMessage.set('Error: ' + err.message)
    });
  }

  stopSession(): void {
    if (!this.sessionId() || !this.sessionActive()) return;
    this.sensorService.stopSession(this.sessionId()!).subscribe({
      next: () => {
        this.sessionActive.set(false);
        this.sessionId.set(null);
        this.sessionLabel.set(null);
        this.stopTimer();
        this.statusMessage.set('Session stopped.');
      },
      error: (err) => this.statusMessage.set('Error: ' + err.message)
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.intervalRef = setInterval(() => {
      this.seconds.update(s => s + 1);
      this.updateTimerDisplay();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private updateTimerDisplay(): void {
    const mins = Math.floor(this.seconds() / 60);
    const secs = this.seconds() % 60;
    this.timerDisplay.set(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
  }

  get sessionDurationDisplay(): string {
    return this.timerDisplay();
  }
}