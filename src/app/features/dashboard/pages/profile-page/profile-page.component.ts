import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { UserProfile } from '../../../../shared/models/user-profile.model';
import { WebSocketService, WsStatus } from '../../../../core/services/websocket.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.scss']
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  profile         = signal<UserProfile | null>(null);
  editProfile!:     UserProfile;
  isDark          = signal(false);
  deviceConnected = signal(false);
  wsStatus        = signal<WsStatus>('disconnected');
  isSaving        = signal(false);
  isLoading       = signal(true);

  private originalProfile = '';
  private sub = new Subscription();

  constructor(
    private auth: AuthService,
    private router: Router,
    private ws: WebSocketService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.isDark.set(this.auth.getTheme() === 'dark');
  }

  ngOnInit(): void {
    this.auth.applyTheme(this.auth.getTheme());

    this.sub.add(
      this.ws.status$.subscribe((status: WsStatus) => {
        this.wsStatus.set(status);
        this.deviceConnected.set(status === 'connected');
      })
    );

    this.loadProfileFromBackend();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private loadProfileFromBackend(): void {
    const user = this.auth.getCurrentUser();
    if (!user?.id) {
      this.initEmpty();
      return;
    }

    this.isLoading.set(true);
    this.userService.getProfile(user.id).subscribe({
      next: (backendProfile: UserProfile) => {
        this.profile.set(backendProfile);
        this.editProfile = { ...backendProfile };
        this.originalProfile = JSON.stringify(backendProfile);
        this.auth.updateCurrentUser(backendProfile);
        this.isLoading.set(false);
      },
      error: () => {
        this.initEmpty();
        this.isLoading.set(false);
      }
    });
  }

  private initEmpty(): void {
    const user = this.auth.getCurrentUser();
    const empty: UserProfile = {
      id:        user?.id        ?? 0,
      username:  user?.username  ?? '',
      name:      user?.name      ?? user?.username ?? '',
      email:     user?.email     ?? '',
      age:       user?.age       ?? null,
      weight:    user?.weight    ?? null,
      height:    user?.height    ?? null,
      gender:    user?.gender    ?? null,
      avatarUrl: user?.avatarUrl ?? null
    };
    this.profile.set(empty);
    this.editProfile    = { ...empty };
    this.originalProfile = JSON.stringify(empty);
  }

  initials(): string {
    const name = (this.profile()?.name || this.profile()?.username) ?? 'U';
    return name.split(' ').filter(Boolean).slice(0, 2)
      .map(w => w[0].toUpperCase()).join('');
  }

  hasChanges(): boolean {
    return JSON.stringify(this.editProfile) !== this.originalProfile;
  }

  saveChanges(): void {
    if (!this.profile()?.id || this.isSaving()) return;
    this.isSaving.set(true);

    const payload = { ...this.editProfile };
    delete (payload as any).avatarUrl;

    this.userService.updateProfile(this.profile()!.id, payload).subscribe({
      next: (response: any) => {
        const updated = { ...this.editProfile };
        this.profile.set(updated);
        this.originalProfile = JSON.stringify(updated);
        this.auth.updateCurrentUser(updated);
        this.isSaving.set(false);
        this.snackBar.open(response.message || 'Profile updated!', 'OK', {
          duration: 3000, panelClass: ['success-snackbar']
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        this.snackBar.open(err.error?.error || 'Update failed', 'Close', {
          duration: 4000, panelClass: ['error-snackbar']
        });
      }
    });
  }

  toggleTheme(): void {
    const newTheme = this.isDark() ? 'light' : 'dark';
    this.isDark.set(!this.isDark());
    this.auth.setTheme(newTheme);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Image too large. Max 5MB.', 'Close', { duration: 4000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarUrl = reader.result as string;
      if (!this.profile()?.id) return;

      this.userService.updateAvatar(this.profile()!.id, avatarUrl).subscribe({
        next: (res: any) => {
          const savedUrl = res.avatarUrl ?? avatarUrl;
          this.editProfile = { ...this.editProfile, avatarUrl: savedUrl };
          this.profile.set({ ...this.editProfile });
          this.originalProfile = JSON.stringify(this.editProfile);
          this.auth.updateCurrentUser({ ...this.editProfile });
          this.snackBar.open('Avatar updated!', 'OK', {
            duration: 2000, panelClass: ['success-snackbar']
          });
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || 'Avatar update failed', 'Close', {
            duration: 4000, panelClass: ['error-snackbar']
          });
        }
      });
    };
    reader.readAsDataURL(file);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}