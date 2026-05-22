import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart, LineController, ScatterController,
  CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend
} from 'chart.js';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { StressTrendsService, WeeklyTrend, StressStats } from './service/trends.service';
import { AuthService } from '../../../../core/services/auth.service';

Chart.register(
  LineController, ScatterController,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Tooltip, Legend
);

@Component({
  selector: 'app-trends-page',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './trends-page.component.html',
  styleUrls: ['./trends-page.component.scss']
})
export class TrendsPageComponent implements OnInit {
  loading = false;

  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Stress Level',
        borderColor: '#00bcd4',
        backgroundColor: 'transparent',
        pointBackgroundColor: '#00bcd4',
        pointBorderColor: '#00bcd4',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: false,
        type: 'line'
      },
      {
        data: [],
        label: 'Events',
        borderColor: 'transparent',
        backgroundColor: '#f44336',
        pointBackgroundColor: '#f44336',
        pointBorderColor: '#fff',
        pointRadius: 6,
        pointHoverRadius: 8,
        type: 'scatter',
        showLine: false
      }
    ],
    labels: [] // populated dynamically from backend
  };

  public lineChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255,255,255,0.05)' },
        title: { display: true, text: 'Stress Level (%)', color: '#aaa' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#ccc' }
      }
    }
  };

  public lineChartType: ChartType = 'line';

  stats: StressStats = {
    avgStress: 0,
    avgChangePercent: 0,
    peakStress: 0,
    peakDay: '',
    peakTime: '',
    stressEvents: 0,
    eventsChange: 0,
    relaxTimeMinutes: 0,
    relaxTimeChangeMinutes: 0
  };

  constructor(
    private trendsService: StressTrendsService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      console.warn('No user logged in');
      return;
    }

    this.loading = true;
    Promise.all([
      this.trendsService.getWeeklyTrends(userId).toPromise(),
      this.trendsService.getStats(userId).toPromise()
    ])
      .then(([trends, stats]) => {
        if (trends) this.updateChartData(trends);
        if (stats) {
          this.stats = stats;
          this.cdr.detectChanges();
        }
      })
      .catch(err => {
        console.error('Failed to load trends data', err);
        this.cdr.detectChanges();
      })
      .finally(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  private updateChartData(trends: WeeklyTrend[]): void {
    const stressValues = trends.map(t => t.stressLevel);
    const labels = trends.map(t => t.day); // dynamic labels from backend

    this.lineChartData = {
      ...this.lineChartData,
      datasets: [
        { ...this.lineChartData.datasets[0], data: stressValues },
        this.lineChartData.datasets[1]
      ],
      labels
    };
    this.cdr.detectChanges();
  }
  hasNoRecentData(): boolean {
  const data = this.lineChartData.datasets[0].data as (number | null)[];
  return data.every(v => v === null || v === 0);
}
}