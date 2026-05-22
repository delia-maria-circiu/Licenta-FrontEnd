import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/components/login-page/login-page.component';
import { RegisterPageComponent } from './features/auth/components/register-page/register-page.component';
import { DashboardComponent } from './features/dashboard/components/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { HomePageComponent } from './features/dashboard/pages/home-page/home-page.component';
import { TrainingPageComponent } from './features/dashboard/pages/training-page/training-page.component';
import { ProfilePageComponent } from './features/dashboard/pages/profile-page/profile-page.component';
import { RelaxPageComponent } from './features/dashboard/pages/relax-page/relax-page.component';
import { TrendsPageComponent } from './features/dashboard/pages/trends-page/trends-page.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginPageComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterPageComponent, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomePageComponent },
      { path: 'trends', component: TrendsPageComponent },
      { path: 'training', component: TrainingPageComponent },
      { path: 'relax', component: RelaxPageComponent},
      { path: 'profile', component: ProfilePageComponent },
    ],
  },
  { path: '**', redirectTo: '/login' },

];