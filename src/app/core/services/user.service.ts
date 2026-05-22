import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserProfile } from '../../shared/models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = 'http://localhost:8080/api/user';

  constructor(private http: HttpClient) {}

  // alias folosit în profile-page și home-page
  getProfile(userId: number): Observable<UserProfile> {
    return this.getUserProfile(userId);
  }

  getUserProfile(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/${userId}`);
  }

  updateProfile(userId: number, profile: Partial<UserProfile>): Observable<{ message: string }> {
    const { avatarUrl, ...cleanProfile } = profile;
    return this.http.put<{ message: string }>(`${this.apiUrl}/${userId}/profile`, cleanProfile)
      .pipe(catchError(this.handleError));
  }

  updateAvatar(userId: number, avatarUrl: string): Observable<{ avatarUrl: string }> {
    return this.http.post<{ avatarUrl: string }>(`${this.apiUrl}/${userId}/avatar`, { avatarUrl })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred.';
    if (error.error) {
      if (typeof error.error === 'string') message = error.error;
      else if (error.error?.message) message = error.error.message;
    }
    return throwError(() => new Error(message));
  }
}