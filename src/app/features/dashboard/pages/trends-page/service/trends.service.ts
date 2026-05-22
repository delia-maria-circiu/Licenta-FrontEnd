import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WeeklyTrend {
  day: string;
  stressLevel: number;
  hasEvent: boolean;
}

export interface StressStats {
  avgStress: number;
  avgChangePercent: number;
  peakStress: number;
  peakDay: string;
  peakTime: string;
  stressEvents: number;
  eventsChange: number;
  relaxTimeMinutes: number;
  relaxTimeChangeMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class StressTrendsService {
  private apiUrl = 'http://localhost:8080/api/stress';

  constructor(private http: HttpClient) {}

  getWeeklyTrends(userId: number): Observable<WeeklyTrend[]> {
    return this.http.get<WeeklyTrend[]>(`${this.apiUrl}/trends/weekly?userId=${userId}`);
  }

  getStats(userId: number): Observable<StressStats> {
    return this.http.get<StressStats>(`${this.apiUrl}/stats?userId=${userId}`);
  }

  saveRelaxSession(userId: number, session: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/relax/session?userId=${userId}`, session);
  }
}