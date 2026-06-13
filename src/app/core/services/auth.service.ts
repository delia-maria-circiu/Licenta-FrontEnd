import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoginModel } from '../../features/auth/models/login.model';
import { RegisterModel } from '../../features/auth/models/register.model';

export type CurrentUser = {
  id: number;
  username: string;
  // câmpuri de profil — opționale, populate după login via getProfile
  name?: string;
  email?: string;
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  gender?: 'Male' | 'Female' | 'Other' | null;  // ← era string | null
  avatarUrl?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:8080/api';
  private readonly THEME_KEY = 'appTheme';

  constructor(private http: HttpClient) {}

login(loginData: LoginModel): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/auth/login`, loginData).pipe(
    catchError(this.handleError)
  );
}

  register(registerData: RegisterModel): Observable<CurrentUser> {
    return this.http.post<CurrentUser>(`${this.apiUrl}/auth/register`, registerData).pipe(
      catchError(this.handleError)
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() != null;
  }

  getCurrentUser(): CurrentUser | null {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id == null || !parsed?.username) return null;
      // returnează tot obiectul, nu doar id+username
      return parsed as CurrentUser;
    } catch {
      return null;
    }
  }

  updateCurrentUser(profile: Partial<CurrentUser>): void {
    const current = this.getCurrentUser();
    if (!current) return;
    const updated: CurrentUser = { ...current, ...profile };
    localStorage.setItem('currentUser', JSON.stringify(updated));
  }

  getTheme(): 'light' | 'dark' {
    return (localStorage.getItem(this.THEME_KEY) as 'light' | 'dark') || 'light';
  }

  setTheme(theme: 'light' | 'dark'): void {
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred. Please try again.';
    if (error.error) {
      if (typeof error.error === 'string') message = error.error;
      else if (error.error?.error) message = error.error.error;
    }
    return throwError(() => new Error(message));
  }
}