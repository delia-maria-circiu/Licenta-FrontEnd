import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-verify-otp-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './verify-otp-page.component.html',
  styleUrls: ['./verify-otp-page.component.scss']
})
export class VerifyOtpPageComponent implements OnInit {
  digits = ['', '', '', '', '', ''];
  maskedEmail = '';
  email = '';
  userId: number | null = null;

  isLoading = signal(false);
  isResending = signal(false);
  countdown = signal(0);
  attemptsLeft = signal(5);
  errorMsg = signal('');

  private countdownInterval: any;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const state = history.state;
    if (!state?.email || !state?.maskedEmail) {
      this.router.navigate(['/login']);
      return;
    }
    this.email = state.email;
    this.maskedEmail = state.maskedEmail;
    this.userId = state.userId ?? null;
    this.startCountdown(300); // 5 minute
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownInterval);
  }

  // Focus automat pe următoarea căsuță
  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;

    if (val && index < 5) {
      const next = document.getElementById(`digit-${index + 1}`);
      next?.focus();
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prev = document.getElementById(`digit-${index - 1}`);
      prev?.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const nums = text.replace(/\D/g, '').slice(0, 6).split('');
    nums.forEach((n, i) => { if (i < 6) this.digits[i] = n; });
    const lastFilled = Math.min(nums.length, 5);
    document.getElementById(`digit-${lastFilled}`)?.focus();
  }

  get code(): string {
    return this.digits.join('');
  }

  get isComplete(): boolean {
    return this.digits.every(d => d !== '');
  }

  submit(): void {
    if (!this.isComplete || this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.http.post<any>('http://localhost:8080/api/auth/verify-otp', {
      email: this.email,
      code: this.code
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        // Salvează userul în localStorage via AuthService
        this.auth.updateCurrentUser({ id: res.id, username: res.username });
        localStorage.setItem('currentUser', JSON.stringify({ id: res.id, username: res.username }));
        if (res.token) localStorage.setItem('authToken', res.token);
        this.router.navigate(['/dashboard/home']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.error || 'Verification failed';
        this.errorMsg.set(msg);

        if (msg.includes('expired') || msg.includes('attempts')) {
          setTimeout(() => this.router.navigate(['/login']), 2500);
        } else {
          this.attemptsLeft.update(v => Math.max(0, v - 1));
          this.digits = ['', '', '', '', '', ''];
          document.getElementById('digit-0')?.focus();
        }
      }
    });
  }

  resendCode(): void {
    if (this.isResending() || this.countdown() > 240) return; // permite resend după 60s
    this.isResending.set(true);

    this.http.post<any>('http://localhost:8080/api/auth/resend-otp', {
      email: this.email
    }).subscribe({
      next: () => {
        this.isResending.set(false);
        this.attemptsLeft.set(5);
        this.errorMsg.set('');
        this.digits = ['', '', '', '', '', ''];
        this.startCountdown(300);
        this.snack.open('New code sent!', 'OK', { duration: 3000 });
        document.getElementById('digit-0')?.focus();
      },
      error: () => {
        this.isResending.set(false);
        this.snack.open('Could not resend. Try again.', 'Close', { duration: 3000 });
      }
    });
  }

  private startCountdown(seconds: number): void {
    clearInterval(this.countdownInterval);
    this.countdown.set(seconds);
    this.countdownInterval = setInterval(() => {
      this.countdown.update(v => {
        if (v <= 1) { clearInterval(this.countdownInterval); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  formatCountdown(): string {
    const m = Math.floor(this.countdown() / 60);
    const s = this.countdown() % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}