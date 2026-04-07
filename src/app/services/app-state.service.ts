import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { WeatherService } from './weather.service';
import { ComunidadAutonoma, Municipio, AemetPrediction, DayDetail } from '../models/weather.models';
import { SPAIN_DATA, TODA_ESPANA } from '../models/spain-data';
import { from, of, forkJoin } from 'rxjs';
import { concatMap, delay, toArray, catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private weatherService = inject(WeatherService);

  // ─── Core state ──────────────────────────────────────────────────────────
  readonly comunidades    = signal<ComunidadAutonoma[]>([TODA_ESPANA, ...SPAIN_DATA]);
  readonly selectedCCAA   = signal<ComunidadAutonoma>(TODA_ESPANA);
  readonly selectedMunicipio = signal<Municipio>(TODA_ESPANA.municipios[0]);
  readonly selectedDayIndex  = signal<number>(0);
  readonly loading        = signal<boolean>(false);
  readonly loadingSpain   = signal<boolean>(false);
  readonly error          = signal<string | null>(null);
  readonly prediction     = signal<AemetPrediction | null>(null);

  // ─── Province weather icons (map: municipioId → WeatherIcon string) ───────
  readonly provWeather = signal<Record<string, string>>({});

  // ─── Spain-wide cards (one per capital) ─────────────────────────────────
  readonly spainCards = signal<{ municipio: string; ccaa: string; pred: AemetPrediction }[]>([]);

  // ─── Derived ─────────────────────────────────────────────────────────────
  readonly municipios  = computed(() => this.selectedCCAA().municipios);
  readonly days        = computed(() => this.prediction()?.days ?? []);
  readonly selectedDay = computed<DayDetail | null>(
    () => this.days()[this.selectedDayIndex()] ?? null
  );

  constructor() {
    // Fetch CCAA weather when municipio changes (skip Toda España)
    effect(() => {
      const muni = this.selectedMunicipio();
      const ccaa = this.selectedCCAA();
      if (muni && ccaa.id !== '00') {
        this.fetchWeather(muni.id);
      }
    });

    // Fetch province weather icons when CCAA changes
    effect(() => {
      const ccaa = this.selectedCCAA();
      if (ccaa.id !== '00') {
        this.fetchProvWeather(ccaa);
      } else {
        this.provWeather.set({});
      }
    });

    // Fetch Spain-wide overview on startup
    this.fetchSpainOverview();
  }

  selectCCAA(ccaa: ComunidadAutonoma): void {
    this.selectedCCAA.set(ccaa);
    this.selectedMunicipio.set(ccaa.municipios[0]);
    this.selectedDayIndex.set(0);
    if (ccaa.id === '00') {
      this.prediction.set(null);
      this.loading.set(false);
    }
  }

  selectMunicipio(muni: Municipio): void {
    this.selectedMunicipio.set(muni);
    this.selectedDayIndex.set(0);
  }

  selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  // ─── Fetch one CCAA ──────────────────────────────────────────────────────
  private fetchWeather(municipioId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.weatherService.getPrediction(municipioId).subscribe({
      next:  (pred) => { this.prediction.set(pred); this.loading.set(false); },
      error: (err)  => { this.error.set(err.message); this.loading.set(false); },
    });
  }

  // ─── Fetch weather icon for each province/island of the selected CA ────────
  private fetchProvWeather(ccaa: ComunidadAutonoma): void {
    const munis = ccaa.municipios;
    if (!munis.length) return;

    // Fetch all province capitals in parallel (small number, max 9)
    const requests = munis.map(m =>
      this.weatherService.getPrediction(m.id).pipe(
        map(pred => ({ id: m.id, icon: pred.days[0]?.icono ?? 'sol' })),
        catchError(() => of({ id: m.id, icon: 'sol' as string }))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const map: Record<string, string> = {};
        results.forEach(r => { map[r.id] = r.icon; });
        this.provWeather.set(map);
      },
      error: () => this.provWeather.set({}),
    });
  }
  private fetchSpainOverview(): void {
    this.loadingSpain.set(true);

    const targets = SPAIN_DATA.map(ccaa => ({
      ccaaName: ccaa.name,
      muni: ccaa.municipios[0],
    }));

    // Sequential requests with 350ms gap to avoid AEMET 429 rate limit
    from(targets).pipe(
      concatMap(t =>
        of(t).pipe(
          delay(350),
          concatMap(target =>
            this.weatherService.getPrediction(target.muni.id).pipe(
              catchError(() => of(this.weatherService.getMockPrediction(target.muni.id)))
            )
          )
        )
      ),
      toArray()
    ).subscribe({
      next: (preds) => {
        const cards = preds.map((pred, i) => ({
          municipio: targets[i].muni.name,
          ccaa:      targets[i].ccaaName,
          pred,
        }));
        this.spainCards.set(cards);
        this.loadingSpain.set(false);
      },
      error: () => this.loadingSpain.set(false),
    });
  }
}
