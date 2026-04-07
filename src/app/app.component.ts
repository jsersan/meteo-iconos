import { Component, inject, ElementRef, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from './services/app-state.service';
import { SpainMapComponent } from './components/map/spain-map.component';
import { CurrentWeatherComponent } from './components/current-weather/current-weather.component';
import { ForecastComponent } from './components/forecast/forecast.component';
import { DayDetailComponent } from './components/forecast/day-detail.component';
import { SpainOverviewComponent } from './components/forecast/spain-overview.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SpainMapComponent, CurrentWeatherComponent,
            ForecastComponent, DayDetailComponent, SpainOverviewComponent],
  template: `
    <div class="app-shell">

      <!-- ── Header ──────────────────────────────── -->
      <header class="app-header">
        <div class="header-brand">
          <div class="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4.5" fill="white" opacity="0.95"/>
              <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
              <circle cx="12" cy="8" r="2" fill="#0274b8"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">MeteoEspaña</div>
            <div class="brand-sub">Datos: AEMET Open Data</div>
          </div>
        </div>
        <div class="header-center">
          <span class="copyright">© Txema Serrano</span>
          <span class="sep">·</span>
          <span class="header-date">{{ today | date:'EEEE, d MMMM yyyy':'':'es' }}</span>
          @if (state.loading()) {
            <div class="loading-badge"><span class="pulse-dot"></span> Actualizando</div>
          }
        </div>
        <div class="header-right">
          <a href="https://opendata.aemet.es" target="_blank" rel="noopener" class="aemet-link">AEMET Open Data</a>
        </div>
      </header>

      <!-- ── OVERVIEW MODE ────────────────────────── -->
      @if (state.selectedCCAA().id === '00') {
        <section class="map-section">
          <div class="map-hint">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
            </svg>
            Haz clic en una comunidad autónoma para ver su pronóstico
          </div>
          <app-spain-map />
        </section>
        <main class="app-main">
          <app-spain-overview />
        </main>
      }

      <!-- ── CCAA MODE: resizable split ────────────── -->
      @if (state.selectedCCAA().id !== '00') {
        <div class="split-layout" #splitLayout>

          <!-- LEFT: map -->
          <aside class="split-map"
                 [style.width]="mapWidth > 0 ? mapWidth + 'px' : '50%'">
            <div class="map-hint-ccaa">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
              </svg>
              <span class="hint-selected">{{ state.selectedCCAA().name }}</span>
            </div>
            <app-spain-map />
          </aside>

          <!-- DIVIDER (draggable) -->
          <div class="split-divider"
               (mousedown)="startDrag($event)"
               [class.dragging]="isDragging">
            <div class="divider-handle">
              <svg width="4" height="32" viewBox="0 0 4 32" fill="none">
                <circle cx="2" cy="6"  r="1.5" fill="rgba(255,255,255,0.6)"/>
                <circle cx="2" cy="14" r="1.5" fill="rgba(255,255,255,0.6)"/>
                <circle cx="2" cy="22" r="1.5" fill="rgba(255,255,255,0.6)"/>
              </svg>
            </div>
          </div>

          <!-- RIGHT: weather panel -->
          <main class="split-weather">
            <div class="ccaa-header">
              <div class="ccaa-title">
                <span class="ccaa-icon">📍</span>
                {{ state.selectedCCAA().name }}
              </div>
              <div class="muni-tabs">
                @for (muni of state.municipios(); track muni.id) {
                  <button class="muni-tab"
                    [class.active]="state.selectedMunicipio().id === muni.id"
                    (click)="state.selectMunicipio(muni)">
                    {{ muni.name }}
                  </button>
                }
              </div>
            </div>
            <div class="weather-col">
              <app-current-weather />
              <app-forecast />
              <app-day-detail />
            </div>
          </main>
        </div>
      }

    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      background:
        radial-gradient(ellipse at 10% 0%,  rgba(56,174,240,0.18) 0%, transparent 55%),
        radial-gradient(ellipse at 90% 100%, rgba(14,148,218,0.10) 0%, transparent 50%),
        linear-gradient(160deg, #ddeeff 0%, #cce8fb 50%, #d5ecff 100%);
      display: flex; flex-direction: column;
    }

    /* ── Header ──────────────────────────── */
    .app-header {
      display: grid; grid-template-columns: auto 1fr auto;
      align-items: center; gap: 12px; padding: 11px 20px;
      background: rgba(2,116,184,0.92);
      border-bottom: 0.5px solid rgba(255,255,255,0.15);
      position: sticky; top: 0; z-index: 200; height: 64px; box-sizing: border-box;
    }
    .header-brand { display: flex; align-items: center; gap: 10px; }
    .brand-logo {
      width: 34px; height: 34px; background: rgba(255,255,255,0.15);
      border-radius: 9px; display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 16px; font-weight: 600; color: white; letter-spacing: -0.3px; }
    .brand-sub  { font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 1px; }
    .header-center { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
    .copyright   { font-size: 12px; color: rgba(255,255,255,0.9); font-style: italic; }
    .sep         { color: rgba(255,255,255,0.4); }
    .header-date { font-size: 12px; color: rgba(255,255,255,0.75); }
    .loading-badge {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 20px;
    }
    .pulse-dot {
      width: 6px; height: 6px; background: #7df5a0; border-radius: 50%;
      animation: pulse-anim 1.2s ease-in-out infinite;
    }
    @keyframes pulse-anim { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
    .header-right { display: flex; justify-content: flex-end; }
    .aemet-link { font-size: 10px; color: rgba(255,255,255,0.55); text-decoration: none; }
    .aemet-link:hover { color: rgba(255,255,255,0.85); text-decoration: underline; }

    /* ── Overview ────────────────────────── */
    .map-section { width: 100%; border-bottom: 0.5px solid var(--border-subtle); }
    .map-section app-spain-map { display: block; width: 100%; }
    .map-hint {
      display: flex; align-items: center; gap: 6px; padding: 7px 16px 0;
      font-size: 10px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;
      color: var(--sky-700); opacity: 0.72;
    }
    .app-main { padding: 1.25rem; max-width: 1200px; margin: 0 auto; width: 100%; }

    /* ── CCAA split layout ──────────────── */
    .split-layout {
      display: flex;                        /* flex instead of grid — needed for resize */
      height: calc(100vh - 64px);
      overflow: hidden;
      position: relative;
    }

    /* LEFT: map pane — width driven by [style.width.px] binding */
    .split-map {
      flex-shrink: 0;
      display: flex; flex-direction: column;
      border-right: none;                   /* divider provides the border */
      background: linear-gradient(180deg, rgba(2,116,184,0.04) 0%, rgba(200,230,247,0.25) 100%);
      overflow: hidden;
      min-width: 220px;
    }
    .map-hint-ccaa {
      display: flex; align-items: center; gap: 6px; padding: 8px 14px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;
      color: var(--sky-700); opacity: 0.75; flex-shrink: 0;
    }
    .hint-selected { color: var(--sky-800); opacity: 1; font-size: 11px; }
    .split-map app-spain-map { display: block; flex: 1; min-height: 0; }
    .split-map app-spain-map ::ng-deep .map-wrapper { height: 100%; }
    .split-map app-spain-map ::ng-deep .map-svg { width: 100%; height: 100%; }

    /* DIVIDER ─────────────────────────────── */
    .split-divider {
      width: 8px;
      flex-shrink: 0;
      background: rgba(2,116,184,0.15);
      cursor: col-resize;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
      position: relative;
      z-index: 10;
      user-select: none;
    }
    .split-divider:hover, .split-divider.dragging {
      background: rgba(2,116,184,0.45);
    }
    .divider-handle {
      width: 20px; height: 48px;
      background: rgba(2,116,184,0.55);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(2,80,140,0.25);
      transition: background 0.15s, transform 0.15s;
    }
    .split-divider:hover .divider-handle,
    .split-divider.dragging .divider-handle {
      background: rgba(2,116,184,0.85);
      transform: scaleX(1.15);
    }

    /* RIGHT: weather pane — takes remaining space */
    .split-weather {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.25rem;
      min-width: 200px;
    }

    /* Weather panel elements */
    .ccaa-header { margin-bottom: 1rem; }
    .ccaa-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 20px; font-weight: 600; color: var(--text-primary);
      margin-bottom: 10px; letter-spacing: -0.3px;
    }
    .ccaa-icon  { font-size: 16px; }
    .muni-tabs  { display: flex; gap: 6px; flex-wrap: wrap; }
    .muni-tab {
      padding: 5px 14px; border-radius: 20px;
      font-size: 12px; font-weight: 500; font-family: var(--font-primary);
      border: 0.5px solid var(--border-mid);
      background: rgba(255,255,255,0.7); color: var(--text-secondary);
      cursor: pointer; transition: background 0.14s, color 0.14s, transform 0.1s;
    }
    .muni-tab:hover  { background: rgba(14,148,218,0.12); color: var(--sky-700); }
    .muni-tab.active { background: var(--sky-600); color: white; border-color: var(--sky-600); box-shadow: 0 2px 8px rgba(2,116,184,0.3); }
    .muni-tab:active { transform: scale(0.96); }
    .weather-col { display: flex; flex-direction: column; gap: 1rem; }

    /* ── Responsive ─────────────────────── */
    @media (max-width: 860px) {
      .split-layout { flex-direction: column; height: auto; overflow: visible; }
      .split-map    { width: 100% !important; height: 45vw; min-height: 220px; max-height: 380px; }
      .split-divider { display: none; }
      .split-weather { overflow-y: visible; }
      .app-header { grid-template-columns: auto 1fr; padding: 10px 12px; }
      .header-right { display: none; }
    }
  `]
})
export class AppComponent implements OnDestroy {
  @ViewChild('splitLayout') splitLayout!: ElementRef<HTMLDivElement>;

  state = inject(AppStateService);
  today = new Date();

  // Resizable split — default 50% width, set after view init
  mapWidth = 0;
  isDragging = false;

  private dragStartX   = 0;
  private dragStartW   = 0;
  private totalW       = 0;
  private readonly MIN_MAP_PX  = 250;
  private readonly MIN_DATA_PX = 300;

  private onMouseMove = (e: MouseEvent) => this.doDrag(e);
  private onMouseUp   = ()              => this.stopDrag();

  ngOnDestroy(): void {
    this.stopDrag();
  }

  startDrag(e: MouseEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.totalW     = this.splitLayout?.nativeElement.clientWidth ?? this.totalW;

    // If mapWidth is still 0 (default 50%), measure the actual rendered px width
    const splitEl = this.splitLayout?.nativeElement;
    const mapEl   = splitEl?.querySelector('.split-map') as HTMLElement | null;
    if (this.mapWidth === 0 && mapEl) {
      this.mapWidth = mapEl.clientWidth;
    }
    this.dragStartW = this.mapWidth;

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup',   this.onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'col-resize';
  }

  private doDrag(e: MouseEvent): void {
    if (!this.isDragging) return;
    const delta   = e.clientX - this.dragStartX;
    const desired = this.dragStartW + delta;
    // Clamp: map min 200px, data panel min 260px, divider 8px
    const max = this.totalW - this.MIN_DATA_PX - 8;
    this.mapWidth = Math.max(this.MIN_MAP_PX, Math.min(max, desired));
  }

  private stopDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup',   this.onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor     = '';
  }

  // Keyboard: allow resizing with ← → arrows when focused on divider
  @HostListener('keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!(e.target as Element)?.classList?.contains('split-divider')) return;
    const step = e.shiftKey ? 50 : 20;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this.mapWidth = Math.max(this.MIN_MAP_PX, this.mapWidth - step); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.mapWidth = Math.min(this.totalW - this.MIN_DATA_PX - 8, this.mapWidth + step); }
  }
}
