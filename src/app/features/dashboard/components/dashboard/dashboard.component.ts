import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
  ]
})
export class DashboardComponent {
  readonly user = computed(() => this.authService.getCurrentUser());
  readonly initials = computed(() => {
    const u = this.user();
    if (!u?.username) return 'U';
    return u.username
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]!.toUpperCase())
      .join('');
  });
sidebarExpanded = false;
toggleSidebar() { this.sidebarExpanded = !this.sidebarExpanded; }
  constructor(private authService: AuthService) {}
}