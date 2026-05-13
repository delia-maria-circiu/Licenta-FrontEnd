import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { UserProfile } from '../../../../shared/models/user-profile.model';
import { WebSocketService } from '../../../../core/services/websocket.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './profile-page.component.html',
  styleUrls: ['./profile-page.component.scss']
})
export class ProfilePageComponent implements OnInit {
  profile = signal<UserProfile | null>(null);
  editProfile!: UserProfile;
  isDark = signal(false);
  deviceConnected = signal(false);
  isSaving = signal(false);
  private originalProfile = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private ws: WebSocketService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.isDark.set(this.auth.getTheme() === 'dark');
    this.initProfiles();          // inițializare imediată
  }

  ngOnInit(): void {
    this.auth.applyTheme(this.auth.getTheme());
    this.ws.status$.subscribe(status => this.deviceConnected.set(status === 'connected'));
  }

  private initProfiles(): void {
    const user = this.auth.getCurrentUser();
    const empty: UserProfile = {
      id: user?.id ?? 0,
      username: user?.username ?? '',
      name: user?.username ?? '',
      email: '',
      age: null,
      weight: null,
      height: null,
      gender: null,
      avatarUrl: null
    };
    this.profile.set(empty);
    this.editProfile = { ...empty };
    this.originalProfile = JSON.stringify(empty);
  }

  initials(): string {
    const name = (this.profile()?.name || this.profile()?.username) ?? 'U';
    return name
      .split(' ')
      .filter(word => Boolean(word))
      .slice(0, 2)
      .map(word => word[0]!.toUpperCase())
      .join('');
  }

  hasChanges(): boolean {
    return JSON.stringify(this.editProfile) !== this.originalProfile;
  }

  saveChanges(): void {
    if (!this.profile()?.id || this.isSaving()) return;

    this.isSaving.set(true);

    const payload = { ...this.editProfile };
    // nu trimitem avatarUrl în payload (va fi separat)
    delete (payload as any).avatarUrl;

    this.userService.updateProfile(this.profile()!.id, payload).subscribe({
      next: (response: any) => {
        // după salvare, păstrăm datele locale ca fiind cele corecte
        this.profile.set({ ...this.editProfile });
        this.originalProfile = JSON.stringify(this.editProfile);
        this.isSaving.set(false);

        this.snackBar.open(response.message || 'Profile updated successfully!', 'OK', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        this.snackBar.open(err.message || 'Update failed', 'Close', {
          duration: 4000,
          panelClass: ['error-snackbar']
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
    if (input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        const avatarUrl = reader.result as string;
        if (!this.profile()?.id) return;

        this.userService.updateAvatar(this.profile()!.id, avatarUrl).subscribe({
          next: () => {
            this.editProfile.avatarUrl = avatarUrl;
            this.profile.set({ ...this.editProfile });
            this.snackBar.open('Avatar updated!', 'OK', {
              duration: 2000,
              panelClass: ['success-snackbar']
            });
          },
          error: (err) => {
            this.snackBar.open(err.message || 'Avatar update failed', 'Close', {
              duration: 4000,
              panelClass: ['error-snackbar']
            });
          }
        });
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}