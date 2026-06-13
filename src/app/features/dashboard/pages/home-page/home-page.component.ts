import {
  Component, OnDestroy, OnInit, signal,
  ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { WebSocketService, ArduinoData, WsStatus } from '../../../../core/services/websocket.service';
import { SensorService, SensorHistoryEntry } from '../../../../core/services/sensor.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { Router } from '@angular/router';

type StressLevel = 'Relaxed' | 'Moderate' | 'Stressed';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  user            = signal<any>(null);
  bpm             = signal<number | null>(null);
  gsr             = signal<number | null>(null);
  ibi             = signal<number | null>(null);
  temp            = signal<number | null>(null);
  finger          = signal(false);
  stressScore     = signal(0);
  stressLevel     = signal<StressLevel>('Relaxed');
  gaugePercentage = signal(0);
  private userId: number | null = null;

  svmScore      = signal<number | null>(null);
  mlStressLevel = signal<'Relaxed' | 'Stressed' | '—'>('—');
  currentStatus = signal('No data');
  since         = signal('');

  readonly circumference = 2 * Math.PI * 52;

  private sub = new Subscription();
  private bpmWindow:  number[] = [];
  private gsrWindow:  number[] = [];
  private lastScores: number[] = [];

  // Smoothing RF
  private smoothedMlScore             = 50;
  private readonly ML_SMOOTHING_ALPHA = 0.4;

  // Smoothing SVM — alpha mai mare = puțin mai reactiv decât RF
  private smoothedSvmScore              = 50;
  private readonly SVM_SMOOTHING_ALPHA  = 0.45;

  private passiveSessionId: number | null = null;

  private lastReadingTime: Date | null = null;
  private sinceIntervalId: any        = null;

  private bpmHistory:  number[] = [];
  private gsrHistory:  number[] = [];
  private ibiHistory:  number[] = [];
  private tempHistory: number[] = [];
  private readonly HISTORY_LENGTH = 30;

  dbHistory      = signal<SensorHistoryEntry[]>([]);
  historyLoading = signal(false);
  expandedCard   = signal<'bpm' | 'gsr' | 'ibi' | 'temp' | null>(null);
  wsStatus       = signal<WsStatus>('disconnected');

  private router = inject(Router);

  @ViewChild('bpmCanvas')  bpmCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('gsrCanvas')  gsrCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('ibiCanvas')  ibiCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('tempCanvas') tempCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild('bpmExpandedCanvas')  bpmExpandedCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('gsrExpandedCanvas')  gsrExpandedCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('ibiExpandedCanvas')  ibiExpandedCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('tempExpandedCanvas') tempExpandedCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly COLORS = {
    bpm:  '#e05c5c',
    gsr:  '#5c8ae0',
    ibi:  '#27a060',
    temp: '#d4853a'
  };

  constructor(
    private auth: AuthService,
    private ws: WebSocketService,
    private sensorService: SensorService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private userService: UserService
  ) {
    const currentUser = this.auth.getCurrentUser();
    this.userId = currentUser?.id ?? null;
    this.user.set(currentUser);
  }

  ngOnInit(): void {
    this.ws.connect('ws://172.20.10.10:81');
    this.startPassiveSession();
    this.loadLastActivity();
    this.loadUserProfile();
    this.loadHistoryFromDb();
    this.startSinceTimer();
    this.sub.add(
      this.ws.data$.subscribe(data => data && this.processData(data))
    );
    this.sub.add(
      this.ws.status$.subscribe(s => this.wsStatus.set(s))
    );
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  // ─── Gauge color ─────────────────────────────────────────────────────────────

  gaugeColor(): string {
    const s = this.gaugePercentage();
    if (s < 35)  return '#27a060';
    if (s <= 65) return '#d4853a';
    return '#e05c5c';
  }

  // ─── Since timer ─────────────────────────────────────────────────────────────

  private startSinceTimer(): void {
    this.sinceIntervalId = setInterval(() => {
      if (this.lastReadingTime && !this.finger()) {
        this.since.set(this.formatSince(this.lastReadingTime));
      }
    }, 30_000);
  }

  private formatSince(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  // ─── Profile & History ───────────────────────────────────────────────────────

  private loadUserProfile(): void {
    const uid = this.auth.getCurrentUser()?.id;
    if (!uid) return;
    this.userService.getProfile(uid).subscribe({
      next: (profile) => { this.user.set(profile); this.auth.updateCurrentUser(profile); },
      error: () => {}
    });
  }

  private loadHistoryFromDb(): void {
    const uid = this.auth.getCurrentUser()?.id;
    if (!uid) return;
    this.historyLoading.set(true);
    this.sensorService.getHistory(uid).subscribe({
      next: (data) => {
        this.dbHistory.set(data);
        this.historyLoading.set(false);
        if (data.length > 0 && !this.lastReadingTime) {
          this.lastReadingTime = new Date(data[0].timestamp);
          this.since.set(this.formatSince(this.lastReadingTime));
        }
      },
      error: () => this.historyLoading.set(false)
    });
  }

  private pushToHistory(entry: SensorHistoryEntry): void {
    this.dbHistory.set([entry, ...this.dbHistory()].slice(0, 10));
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  getInitials(): string {
    const name = this.user()?.name || this.user()?.username || 'U';
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map((w: string) => w[0].toUpperCase()).join('');
  }

  toggleExpand(card: 'bpm' | 'gsr' | 'ibi' | 'temp'): void {
    this.expandedCard.set(this.expandedCard() === card ? null : card);
    setTimeout(() => this.redrawAllGraphs(), 50);
  }

  isExpanded(card: 'bpm' | 'gsr' | 'ibi' | 'temp'): boolean {
    return this.expandedCard() === card;
  }

  formatTimestamp(ts: string): string {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${date} ${time}`;
  }

  // ─── Canvas ──────────────────────────────────────────────────────────────────

  private redrawAllGraphs(): void {
    const exp = this.expandedCard();
    this.drawGraph(
      exp === 'bpm'  ? this.bpmExpandedCanvas  : this.bpmCanvas,
      this.bpmHistory, this.COLORS.bpm
    );
    this.drawGraph(
      exp === 'gsr'  ? this.gsrExpandedCanvas  : this.gsrCanvas,
      this.gsrHistory, this.COLORS.gsr
    );
    this.drawGraph(
      exp === 'ibi'  ? this.ibiExpandedCanvas  : this.ibiCanvas,
      this.ibiHistory, this.COLORS.ibi
    );
    this.drawGraph(
      exp === 'temp' ? this.tempExpandedCanvas : this.tempCanvas,
      this.tempHistory, this.COLORS.temp
    );
  }

  private updateBpmGraph(v: number): void {
    this.bpmHistory.push(v);
    if (this.bpmHistory.length > this.HISTORY_LENGTH) this.bpmHistory.shift();
    this.drawGraph(
      this.expandedCard() === 'bpm' ? this.bpmExpandedCanvas : this.bpmCanvas,
      this.bpmHistory, this.COLORS.bpm
    );
  }

  private updateGsrGraph(v: number): void {
    this.gsrHistory.push(v);
    if (this.gsrHistory.length > this.HISTORY_LENGTH) this.gsrHistory.shift();
    this.drawGraph(
      this.expandedCard() === 'gsr' ? this.gsrExpandedCanvas : this.gsrCanvas,
      this.gsrHistory, this.COLORS.gsr
    );
  }

  private updateIbiGraph(v: number): void {
    this.ibiHistory.push(v);
    if (this.ibiHistory.length > this.HISTORY_LENGTH) this.ibiHistory.shift();
    this.drawGraph(
      this.expandedCard() === 'ibi' ? this.ibiExpandedCanvas : this.ibiCanvas,
      this.ibiHistory, this.COLORS.ibi
    );
  }

  private updateTempGraph(v: number): void {
    this.tempHistory.push(v);
    if (this.tempHistory.length > this.HISTORY_LENGTH) this.tempHistory.shift();
    this.drawGraph(
      this.expandedCard() === 'temp' ? this.tempExpandedCanvas : this.tempCanvas,
      this.tempHistory, this.COLORS.temp
    );
  }

  private drawGraph(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined,
    data: number[],
    color: string
  ): void {
    if (!canvasRef?.nativeElement || data.length < 2) return;
    const canvas = canvasRef.nativeElement;
    const ctx    = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    let minY = Math.min(...data);
    let maxY = Math.max(...data);
    const pad = (maxY - minY) * 0.15 || 1;
    minY -= pad; maxY += pad;
    const range = maxY - minY;
    const stepX = w / (data.length - 1);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = h - ((data[i] - minY) / range) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo((data.length - 1) * stepX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = h - ((data[i] - minY) / range) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();
  }

  // ─── Session ─────────────────────────────────────────────────────────────────

  private startPassiveSession(): void {
    const uid = this.user()?.id;
    if (!uid) return;
    this.sensorService.startSession({ label: -1, userId: uid }).subscribe({
      next: (sid) => { this.passiveSessionId = sid; },
      error: () => console.warn('Could not start passive session')
    });
  }

  private stopPassiveSession(): void {
    if (this.passiveSessionId) {
      this.sensorService.stopSession(this.passiveSessionId).subscribe({ error: () => {} });
    }
  }

  private loadLastActivity(): void {
    const userId = this.auth.getCurrentUser()?.id;
    if (!userId) return;
    this.http.get(`http://localhost:8080/api/stress/last-activity?userId=${userId}`)
      .subscribe({
        next: (res: any) => {
          if (res.exists) {
            this.currentStatus.set(res.currentStatus);
            this.since.set(res.since);
            if (this.stressScore() === 0 && res.lastStressScore !== undefined) {
              this.stressScore.set(res.lastStressScore);
              this.gaugePercentage.set(res.lastStressScore);
              const s = res.lastStressScore;
              const level: StressLevel = s < 35 ? 'Relaxed' : s <= 65 ? 'Moderate' : 'Stressed';
              this.stressLevel.set(level);
              this.mlStressLevel.set(level === 'Relaxed' ? 'Relaxed' : 'Stressed');
            }
          } else {
            this.currentStatus.set('No data yet');
            this.since.set('Start a session');
          }
        },
        error: (err) => console.warn('Could not load last activity', err)
      });
  }

  // ─── Core data processing ────────────────────────────────────────────────────

  private processData(data: ArduinoData): void {
    const bpm  = this.safeNum(data.bpm);
    const gsr  = this.safeNum(data.gsr);
    const temp = this.safeNum(data.temp);
    const ibi  = this.safeNum(data.ibi);
    const fingerDetected = data.finger;
    this.finger.set(fingerDetected);

    if (!fingerDetected || bpm === 0) {
      this.bpm.set(null); this.gsr.set(null);
      this.ibi.set(null); this.temp.set(null);
      this.mlStressLevel.set('—');
      if (this.lastReadingTime) {
        this.since.set(this.formatSince(this.lastReadingTime));
      }
      return;
    }

    const filteredBpm = this.iqrFilter(this.bpmWindow, bpm);
    const filteredGsr = this.iqrFilter(this.gsrWindow, gsr);

    this.bpm.set(filteredBpm);
    this.gsr.set(filteredGsr);
    this.ibi.set(ibi);
    this.temp.set(temp);

    this.updateBpmGraph(filteredBpm);
    this.updateGsrGraph(filteredGsr);
    this.updateIbiGraph(ibi);
    this.updateTempGraph(temp);

    if (!this.userId || !this.passiveSessionId) return;

    this.sensorService.predictStress(this.userId, [filteredBpm, ibi, filteredGsr, temp])
      .subscribe({
        next: (response: any) => {
          // ── RF smoothing ────────────────────────────────────────────────────
          let rawRf = response.stress_score
            ?? Math.round((response.stress_probability ?? 0) * 100);
          rawRf = Number(rawRf);
          if (isNaN(rawRf)) return;

          this.smoothedMlScore = this.ML_SMOOTHING_ALPHA * rawRf
            + (1 - this.ML_SMOOTHING_ALPHA) * this.smoothedMlScore;
          const finalScore = Math.round(this.smoothedMlScore);

          this.stressScore.set(finalScore);
          this.gaugePercentage.set(finalScore);

          const level: StressLevel = finalScore < 35 ? 'Relaxed'
            : finalScore <= 65 ? 'Moderate' : 'Stressed';
          this.stressLevel.set(level);
          this.mlStressLevel.set(level === 'Relaxed' ? 'Relaxed' : 'Stressed');

          // ── SVM smoothing ───────────────────────────────────────────────────
          if (response.svm_score !== null && response.svm_score !== undefined) {
            const rawSvm = Number(response.svm_score);
            if (!isNaN(rawSvm)) {
              this.smoothedSvmScore = this.SVM_SMOOTHING_ALPHA * rawSvm
                + (1 - this.SVM_SMOOTHING_ALPHA) * this.smoothedSvmScore;
              this.svmScore.set(Math.round(this.smoothedSvmScore));
            }
          }

          this.updateStatus(finalScore);

          // ── Salvare în BD ───────────────────────────────────────────────────
          this.sensorService.saveReading({
            bpm: filteredBpm,
            ibi,
            gsr: filteredGsr,
            temp,
            finger: true,
            label: -1,
            userId: this.userId!,
            sessionId: this.passiveSessionId!,
            stressScore: finalScore
          }).subscribe({
            next: () => {
              this.lastReadingTime = new Date();
              this.since.set('Just now');
              this.pushToHistory({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                bpm: filteredBpm,
                ibi,
                gsr: filteredGsr,
                temp,
                stressScore: finalScore
              });
            },
            error: (err) => console.warn('Could not save reading', err)
          });
        },
        error: () => this.mlStressLevel.set('—')
      });
  }

  private updateStatus(score: number): void {
    this.lastScores.push(score);
    if (this.lastScores.length > 5) this.lastScores.shift();
    if (this.lastScores.length < 2) { this.currentStatus.set('Gathering data...'); return; }
    const first = this.lastScores[0];
    const last  = this.lastScores[this.lastScores.length - 1];
    if      (last < first - 2) this.currentStatus.set('Stress levels decreasing');
    else if (last > first + 2) this.currentStatus.set('Stress levels increasing');
    else                       this.currentStatus.set('Stress levels stable');
  }

  private iqrFilter(window: number[], val: number): number {
    window.push(val);
    if (window.length > 10) window.shift();
    if (window.length < 4) return val;
    const sorted = [...window].sort((a, b) => a - b);
    const n  = sorted.length;
    const q1 = sorted[Math.floor(n / 4)];
    const q3 = sorted[Math.floor(3 * n / 4)];
    const iqr = q3 - q1;
    if (val < q1 - 1.5 * iqr || val > q3 + 1.5 * iqr) return sorted[Math.floor(n / 2)];
    return val;
  }

  private safeNum(v: any): number {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  getTimeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  getStatusLabel(): string { return this.stressLevel(); }

  getStressMessage(): string {
    const s = this.stressScore();
    if (s < 35) return 'Your stress levels are low. Great job staying calm!';
    if (s <= 65) return 'Moderate stress detected. Consider taking a short break.';
    return 'High stress detected. Try breathing exercises.';
  }

  get dashOffset(): number {
    return this.circumference * (1 - this.gaugePercentage() / 100);
  }

  redirectToProfile(): void {
    this.router.navigate(['/dashboard/profile']);
  }

  ngOnDestroy(): void {
    this.stopPassiveSession();
    this.sub.unsubscribe();
    this.ws.disconnect();
    if (this.sinceIntervalId) clearInterval(this.sinceIntervalId);
  }
}