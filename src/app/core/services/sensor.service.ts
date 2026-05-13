import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';


export interface SensorReading {
  bpm: number;
  ibi: number;
  gsr: number;
  temp: number;
  finger: boolean;
  label: number;
  userId: number;
  sessionId: number;
}
@Injectable({ providedIn: 'root' })
export class SensorService {
  private readonly apiUrl = 'http://localhost:8080/api/sensor';

  constructor(private http: HttpClient) {}

  startSession(params: { label: -1 | 0 | 1; userId: number }): Observable<number> {
    return this.http
      .post(`${this.apiUrl}/sesiune/start?label=${params.label}&userId=${params.userId}`, {}, { responseType: 'text' })
      .pipe(
        map((txt) => this.extractFirstNumber(txt)),
        catchError((err) => throwError(() => new Error('Failed to start session. Please try again.')))
      );
  }

  stopSession(sessionId: number): Observable<string> {
    return this.http.post(`${this.apiUrl}/sesiune/stop?sessionId=${sessionId}`, {}, { responseType: 'text' })
      .pipe(
        catchError((err) => throwError(() => new Error('Failed to stop session.')))
      );
  }

  getAllReadings(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/all`);
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export`, { responseType: 'blob' });
  }

  private extractFirstNumber(txt: string): number {
    const m = String(txt ?? '').match(/(\d+)/);
    if (!m?.[1]) throw new Error(`Could not parse sessionId from response: ${txt}`);
    return Number(m[1]);
  }
  
  saveReading(reading: Partial<SensorReading>): Observable<any> {
  return this.http.post(`${this.apiUrl}/save`, reading);
}

predictStress(userId: number, features: number[]): Observable<{ stress_level: number }> {
  return this.http.post<{ stress_level: number }>(`${this.apiUrl}/predict/stress`, {
    userId,
    features
  });
}
}