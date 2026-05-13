import {
  Component,
  OnDestroy,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIcon, MatIconModule } from '@angular/material/icon';

/* ─── Types ─────────────────────────────────────────────────────────────── */

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

// const BREATH_PATTERNS: BreathPattern[] = [
//   { id: 'calm',      label: 'Calm',         description: '4s in / 4s out',               inhale: 4, hold: 0, exhale: 4, hold2: 0 },
//   { id: 'deep',      label: 'Deep Relax',   description: '4s in / 6s out',               inhale: 4, hold: 0, exhale: 6, hold2: 0 },
//   { id: 'box',       label: 'Box Breathing',description: '4s in / 4s hold / 4s out / 4s hold', inhale: 4, hold: 4, exhale: 4, hold2: 4 },
// ];

const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'calm',
    label: 'Calm',
    description: '4s in · 4s out',
    inhale: 4, hold: 0, exhale: 4, hold2: 0,
  },
  {
    id: 'deep-relax',
    label: 'Deep Relax',
    description: '4s in · 6s out',
    inhale: 4, hold: 0, exhale: 6, hold2: 0,
  },
  {
    id: 'box',
    label: 'Box Breathing',
    description: '4s in · 4s hold · 4s out · 4s hold',
    inhale: 4, hold: 4, exhale: 4, hold2: 4,
  },
  {
    id: 'energizing',
    label: 'Energizing',
    description: '3s in · 3s out',
    inhale: 3, hold: 0, exhale: 3, hold2: 0,
  },
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

/* ─── Component ──────────────────────────────────────────────────────────── */

@Component({
  selector: 'app-relax-page',
  standalone: true,
  imports: [CommonModule,MatIconModule],
  templateUrl: './relax-page.component.html',
  styleUrls: ['./relax-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelaxPageComponent implements OnDestroy {

  constructor(private router: Router) {}

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  activeTab = signal<Tab>('breathing');
  setTab(t: Tab) { this.activeTab.set(t); }

  /* ── Breathing ───────────────────────────────────────────────────────── */
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
      { phase: 'inhale' as BreathPhase, duration: p.inhale },
      { phase: 'hold'   as BreathPhase, duration: p.hold   },
      { phase: 'exhale' as BreathPhase, duration: p.exhale },
      { phase: 'hold2'  as BreathPhase, duration: p.hold2  },
    ].filter(x => x.duration > 0);

    const idx = phases.findIndex(x => x.phase === this.breathPhase());
    const next = phases[(idx + 1) % phases.length];
    if (next.phase === 'inhale' && idx !== 0) this.breathCycle.update(c => c + 1);
    this.breathPhase.set(next.phase);
    this.phaseSecondsLeft = next.duration;
    this.breathCountdown.set(next.duration);
  }

  /* Circle scale for the breathing animation */
  breathScale = computed(() => {
    if (!this.breathRunning() || this.breathPaused()) return 1;
    switch (this.breathPhase()) {
      case 'inhale': return 1.35;
      case 'exhale': return 0.75;
      default:       return 1;
    }
  });

  /* ── Meditation ──────────────────────────────────────────────────────── */
  meditationDurations = MEDITATION_DURATIONS;
  selectedDuration    = signal(MEDITATION_DURATIONS[0]);
  meditationPhase     = signal<MeditationPhase>('idle');
  meditationRemaining = signal(0);
  meditationMessage   = signal(MEDITATION_MESSAGES[0]);

  private meditationInterval: ReturnType<typeof setInterval> | null = null;
  private msgInterval:        ReturnType<typeof setInterval> | null = null;
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

  /* ── Navigation ──────────────────────────────────────────────────────── */
  goHome() { this.router.navigateByUrl('/dashboard/home'); }

  /* ── Cleanup ─────────────────────────────────────────────────────────── */
  ngOnDestroy() {
    this.stopBreath();
    this.stopMeditation();
  }
}