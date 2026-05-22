import {
  Component,
  OnDestroy,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StressTrendsService } from '../trends-page/service/trends.service';
import { AuthService } from '../../../../core/services/auth.service';

type Tab = 'breathing' | 'meditation';
type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold2';
type MeditationPhase = 'idle' | 'running' | 'paused' | 'done';

interface BreathPattern {
  id: string;
  label: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  hold2: number;
}

const BREATH_PATTERNS: BreathPattern[] = [
  { id: 'calm', label: 'Calm', description: '4s in · 4s out', inhale: 4, hold: 0, exhale: 4, hold2: 0 },
  { id: 'deep-relax', label: 'Deep Relax', description: '4s in · 6s out', inhale: 4, hold: 0, exhale: 6, hold2: 0 },
  { id: 'box', label: 'Box Breathing', description: '4s in · 4s hold · 4s out · 4s hold', inhale: 4, hold: 4, exhale: 4, hold2: 4 },
  { id: 'energizing', label: 'Energizing', description: '3s in · 3s out', inhale: 3, hold: 0, exhale: 3, hold2: 0 },
];

const MEDITATION_MESSAGES = [
  'Focus on your breathing…',
  'Relax your mind…',
  'Let your thoughts pass…',
  'You are safe and at peace…',
  'Breathe in calm, breathe out tension…',
];

const MEDITATION_DURATIONS = [
  { label: '5 min',  seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];

@Component({
  selector: 'app-relax-page',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './relax-page.component.html',
  styleUrls: ['./relax-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelaxPageComponent implements OnDestroy {
  private breathStartTime: Date | null = null;
  private meditationStartTime: Date | null = null;

  constructor(
    private router: Router,
    private trendsService: StressTrendsService,
    private authService: AuthService
  ) {}

  /* Tabs */
  activeTab = signal<Tab>('breathing');
  setTab(t: Tab) { this.activeTab.set(t); }

  /* Breathing */
  patterns = BREATH_PATTERNS;
  selectedPattern = signal<BreathPattern>(BREATH_PATTERNS[0]);
  selectPattern(p: BreathPattern) {
    if (this.breathRunning()) this.stopBreath();
    this.selectedPattern.set(p);
  }

  breathRunning  = signal(false);
  breathPaused   = signal(false);
  breathPhase    = signal<BreathPhase>('inhale');
  breathPhaseLabel = computed(() => {
    switch (this.breathPhase()) {
      case 'inhale': return 'Breathe In';
      case 'hold':   return 'Hold';
      case 'exhale': return 'Breathe Out';
      case 'hold2':  return 'Hold';
    }
  });
  breathCountdown = signal(0);
  breathCycle    = signal(0);

  private breathInterval: ReturnType<typeof setInterval> | null = null;
  private phaseSecondsLeft = 0;

  startBreath() {
    if (this.breathRunning() && !this.breathPaused()) return;
    if (this.breathPaused()) {
      this.breathPaused.set(false);
      this._tickBreath();
      return;
    }
    this.breathStartTime = new Date();
    console.log('[Breath] Started at', this.breathStartTime);
    this.breathRunning.set(true);
    this.breathPaused.set(false);
    this.breathPhase.set('inhale');
    this.phaseSecondsLeft = this.selectedPattern().inhale;
    this.breathCountdown.set(this.phaseSecondsLeft);
    this._tickBreath();
  }

  pauseBreath() {
    if (!this.breathRunning()) return;
    this.breathPaused.set(true);
    if (this.breathInterval) { clearInterval(this.breathInterval); this.breathInterval = null; }
  }

  stopBreath() {
    console.log('[Breath] Stop called');
    if (this.breathStartTime && this.breathRunning()) {
      const durationMs = Date.now() - this.breathStartTime.getTime();
      let durationMinutes = Math.floor(durationMs / 60000);
      if (durationMinutes === 0 && durationMs > 0) durationMinutes = 1; // cel puțin 1 minut
      console.log(`[Breath] Duration: ${durationMinutes} minutes`);
      if (durationMinutes > 0) {
        this.saveRelaxSession(durationMinutes, 'breathing', this.selectedPattern().id);
      }
      this.breathStartTime = null;
    }
    if (this.breathInterval) { clearInterval(this.breathInterval); this.breathInterval = null; }
    this.breathRunning.set(false);
    this.breathPaused.set(false);
    this.breathPhase.set('inhale');
    this.breathCountdown.set(0);
    this.breathCycle.set(0);
  }

  private _tickBreath() {
    if (this.breathInterval) clearInterval(this.breathInterval);
    this.breathInterval = setInterval(() => {
      this.phaseSecondsLeft--;
      this.breathCountdown.set(this.phaseSecondsLeft);
      if (this.phaseSecondsLeft <= 0) this._nextPhase();
    }, 1000);
  }

  private _nextPhase() {
    const p = this.selectedPattern();
    const phases: { phase: BreathPhase; duration: number }[] = [
      { phase: 'inhale' as const, duration: p.inhale },
      { phase: 'hold' as const,   duration: p.hold },
      { phase: 'exhale' as const, duration: p.exhale },
      { phase: 'hold2' as const,  duration: p.hold2 },
    ].filter(x => x.duration > 0);

    const idx = phases.findIndex(x => x.phase === this.breathPhase());
    const next = phases[(idx + 1) % phases.length];
    if (next.phase === 'inhale' && idx !== 0) this.breathCycle.update(c => c + 1);
    this.breathPhase.set(next.phase);
    this.phaseSecondsLeft = next.duration;
    this.breathCountdown.set(next.duration);
  }

  breathScale = computed(() => {
    if (!this.breathRunning() || this.breathPaused()) return 1;
    switch (this.breathPhase()) {
      case 'inhale': return 1.35;
      case 'exhale': return 0.75;
      default:       return 1;
    }
  });

  /* Meditation */
  meditationDurations = MEDITATION_DURATIONS;
  selectedDuration    = signal(MEDITATION_DURATIONS[0]);
  meditationPhase     = signal<MeditationPhase>('idle');
  meditationRemaining = signal(0);
  meditationMessage   = signal(MEDITATION_MESSAGES[0]);

  private meditationInterval: ReturnType<typeof setInterval> | null = null;
  private msgInterval: ReturnType<typeof setInterval> | null = null;
  private msgIdx = 0;

  selectDuration(d: typeof MEDITATION_DURATIONS[number]) {
    if (this.meditationPhase() !== 'idle') this.stopMeditation();
    this.selectedDuration.set(d);
  }

  startMeditation() {
    if (this.meditationPhase() === 'running') return;
    if (this.meditationPhase() === 'paused') {
      this.meditationPhase.set('running');
      this._tickMeditation();
      return;
    }
    this.meditationStartTime = new Date();
    console.log('[Meditation] Started at', this.meditationStartTime);
    this.meditationRemaining.set(this.selectedDuration().seconds);
    this.meditationPhase.set('running');
    this._tickMeditation();
    this._rotateMsgInterval();
  }

  pauseMeditation() {
    this.meditationPhase.set('paused');
    if (this.meditationInterval) { clearInterval(this.meditationInterval); this.meditationInterval = null; }
    if (this.msgInterval)        { clearInterval(this.msgInterval);        this.msgInterval = null; }
  }

  stopMeditation() {
    console.log('[Meditation] Stop called');
    if (this.meditationStartTime && (this.meditationPhase() === 'running' || this.meditationPhase() === 'paused')) {
      const durationMs = Date.now() - this.meditationStartTime.getTime();
      let durationMinutes = Math.floor(durationMs / 60000);
      if (durationMinutes === 0 && durationMs > 0) durationMinutes = 1;
      console.log(`[Meditation] Duration: ${durationMinutes} minutes`);
      if (durationMinutes > 0) {
        this.saveRelaxSession(durationMinutes, 'meditation');
      }
      this.meditationStartTime = null;
    }
    if (this.meditationInterval) { clearInterval(this.meditationInterval); this.meditationInterval = null; }
    if (this.msgInterval)        { clearInterval(this.msgInterval);        this.msgInterval = null; }
    this.meditationPhase.set('idle');
    this.meditationRemaining.set(0);
  }

  private _tickMeditation() {
    if (this.meditationInterval) clearInterval(this.meditationInterval);
    this.meditationInterval = setInterval(() => {
      const next = this.meditationRemaining() - 1;
      this.meditationRemaining.set(next);
      if (next <= 0) {
        clearInterval(this.meditationInterval!);
        this.meditationInterval = null;
        if (this.msgInterval) { clearInterval(this.msgInterval); this.msgInterval = null; }
        this.meditationPhase.set('done');
        if (this.meditationStartTime) {
          const durationMs = Date.now() - this.meditationStartTime.getTime();
          let durationMinutes = Math.floor(durationMs / 60000);
          if (durationMinutes === 0 && durationMs > 0) durationMinutes = 1;
          if (durationMinutes > 0) {
            this.saveRelaxSession(durationMinutes, 'meditation');
          }
          this.meditationStartTime = null;
        }
      }
    }, 1000);
  }

  private _rotateMsgInterval() {
    if (this.msgInterval) clearInterval(this.msgInterval);
    this.msgInterval = setInterval(() => {
      this.msgIdx = (this.msgIdx + 1) % MEDITATION_MESSAGES.length;
      this.meditationMessage.set(MEDITATION_MESSAGES[this.msgIdx]);
    }, 5000);
  }

  meditationTimeDisplay = computed(() => {
    const s = this.meditationRemaining();
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  });

  meditationProgress = computed(() => {
    const total = this.selectedDuration().seconds;
    const remaining = this.meditationRemaining();
    return total > 0 ? ((total - remaining) / total) * 100 : 0;
  });

  /* Save relax session */
  private saveRelaxSession(durationMinutes: number, type: 'breathing' | 'meditation', pattern?: string): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      console.warn('No user logged in');
      return;
    }
    const session = {
      type: type,
      breathingPattern: pattern || null,
      durationMinutes: durationMinutes,
      startedAt: type === 'breathing' ? this.breathStartTime : this.meditationStartTime,
      endedAt: new Date()
    };
    console.log('[Save] Sending to backend:', session);
    this.trendsService.saveRelaxSession(userId, session).subscribe({
      next: (res) => console.log('[Save] Success:', res),
      error: (err) => console.error('[Save] Error:', err)
    });
  }

  goHome() { this.router.navigateByUrl('/dashboard/home'); }

  ngOnDestroy() {
    this.stopBreath();
    this.stopMeditation();
  }
}