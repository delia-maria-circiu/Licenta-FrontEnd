import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, interval } from 'rxjs';
import { WebSocketService, ArduinoData } from '../../../../core/services/websocket.service';
import { SensorService } from '../../../../core/services/sensor.service';
import { AuthService } from '../../../../core/services/auth.service';

type StressLevel = 'Relaxat' | 'Moderat' | 'Stresat';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit, OnDestroy {
  user = signal<any>(null);
  bpm = signal<number | null>(null);
  gsr = signal<number | null>(null);
  finger = signal(false);
  stressScore = signal(0);
  stressLevel = signal<StressLevel>('Relaxat');
  gaugePercentage = signal(0);
private userId: number | null = null;
   mlStressLevel = signal<'Relaxat' | 'Stresat' | '—'>('—'); 

  // Status bar
  currentStatus = signal('No data');
  since = signal('');

  // SVG gauge
  readonly circumference = 2 * Math.PI * 52;

  private sub = new Subscription();
  private bpmWindow: number[] = [];
  private gsrWindow: number[] = [];
  private prevSmoothed = 0;

  // Pentru trend
  private lastScores: number[] = [];

  // Sesiune pasivă
  private passiveSessionId: number | null = null;
  private sessionStartTime: Date | null = null;
  private timerSub: any;

  constructor(
    private auth: AuthService,
    private ws: WebSocketService,
    private sensorService: SensorService
  ) {
    const currentUser = this.auth.getCurrentUser();
    this.userId = currentUser?.id ?? null;
    this.user.set(currentUser);
  }

  ngOnInit(): void {
    this.ws.connect('ws://172.20.10.10:81');
    this.startPassiveSession();
    this.sub.add(
      this.ws.data$.subscribe(data => data && this.processData(data))
    );
  }

  ngOnDestroy(): void {
    this.stopPassiveSession();
    this.sub.unsubscribe();
    this.ws.disconnect();
  }

  private async startPassiveSession(): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) return;

    try {
      const sid = await this.sensorService.startSession({ label: -1, userId: uid }).toPromise();
      // toPromise e deprecated, mai bine subscribe:
    } catch (e) { /* ignore */ }
    // Implementare corectă cu subscribe:
    this.sensorService.startSession({ label: -1, userId: uid }).subscribe({
      next: (sid) => {
        this.passiveSessionId = sid;
        this.sessionStartTime = new Date();
        this.updateSince();
        this.timerSub = setInterval(() => this.updateSince(), 10000); // la fiecare 10s
        console.log('Passive session started, id:', sid);
      },
      error: () => console.warn('Could not start passive session')
    });
  }

  private stopPassiveSession(): void {
    if (this.timerSub) clearInterval(this.timerSub);
    if (this.passiveSessionId) {
      this.sensorService.stopSession(this.passiveSessionId).subscribe({
        next: () => console.log('Passive session stopped'),
        error: () => {}
      });
    }
  }

  private updateSince(): void {
    if (!this.sessionStartTime) return;
    const diff = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);
    if (diff < 60) this.since.set(`${diff} seconds ago`);
    else if (diff < 3600) this.since.set(`${Math.floor(diff / 60)} minutes ago`);
    else this.since.set(`${Math.floor(diff / 3600)} hours ago`);
  }

  private processData(data: ArduinoData): void {
    const bpm = this.safeNum(data.bpm);
    const gsr = this.safeNum(data.gsr);
    const temp = this.safeNum(data.temp);
    const fingerDetected = data.finger;
    this.finger.set(fingerDetected);

    if (!fingerDetected || bpm === 0) {
      this.bpm.set(null);
      this.gsr.set(null);
      return;
    }

    const filteredBpm = this.iqrFilter(this.bpmWindow, bpm);
    const filteredGsr = this.iqrFilter(this.gsrWindow, gsr);
    this.bpm.set(filteredBpm);
    this.gsr.set(filteredGsr);

    const bpmScore = filteredBpm < 75 ? 0 : filteredBpm <= 95 ? 50 : 100;
    const gsrScore = gsr > 120 ? 0 : gsr >= 80 ? 50 : 100;
    const tempScore = temp < 37 ? 0 : temp <= 37.5 ? 50 : 100;
    const rawScore = bpmScore * 0.5 + gsrScore * 0.4 + tempScore * 0.1;
    const smoothed = this.prevSmoothed + 0.15 * (rawScore - this.prevSmoothed);
    this.prevSmoothed = smoothed;
    const rounded = Math.round(smoothed);
    const level: StressLevel = rounded < 35 ? 'Relaxat' : rounded <= 65 ? 'Moderat' : 'Stresat';

    this.stressScore.set(rounded);
    this.stressLevel.set(level);
    this.gaugePercentage.set(rounded);

    // Actualizează trendul
    this.updateStatus(rounded);
    if (this.userId) {
      this.sensorService.predictStress(this.userId, [filteredBpm, data.ibi, filteredGsr, temp])
        .subscribe({
          next: (response) => {
            this.mlStressLevel.set(response.stress_level === 0 ? 'Relaxat' : 'Stresat');
          },
          error: (err) => {
            console.warn('ML prediction failed', err);
            this.mlStressLevel.set('—');
          }
        });
    }
  }



  private updateStatus(score: number): void {
    this.lastScores.push(score);
    if (this.lastScores.length > 5) this.lastScores.shift();

    if (this.lastScores.length < 2) {
      this.currentStatus.set('Gathering data...');
      return;
    }

    const first = this.lastScores[0];
    const last = this.lastScores[this.lastScores.length - 1];
    if (last < first - 2) this.currentStatus.set('Stress levels decreasing');
    else if (last > first + 2) this.currentStatus.set('Stress levels increasing');
    else this.currentStatus.set('Stress levels stable');
  }

  private iqrFilter(window: number[], val: number): number {
    window.push(val);
    if (window.length > 10) window.shift();
    if (window.length < 4) return val;
    const sorted = [...window].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n / 4)];
    const q3 = sorted[Math.floor(3 * n / 4)];
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    if (val < low || val > high) return sorted[Math.floor(n / 2)];
    return val;
  }

  private safeNum(v: any): number {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  getStatusLabel(): string {
    return this.stressLevel();
  }

  getStressMessage(): string {
    const s = this.stressScore();
    if (s < 35) return 'Your stress levels are low. Great job staying calm!';
    if (s <= 65) return 'Moderate stress detected. Consider taking a short break.';
    return 'High stress detected. Try breathing exercises.';
  }

  get dashOffset(): number {
    const progress = this.gaugePercentage() / 100;
    return this.circumference * (1 - progress);
  }
}