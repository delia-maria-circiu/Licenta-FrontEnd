import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit  {
  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    // Aplică tema salvată la pornirea aplicației
    this.auth.applyTheme(this.auth.getTheme());
  }
}
