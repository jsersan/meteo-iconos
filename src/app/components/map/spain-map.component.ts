import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, NgZone, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { AppStateService } from '../../services/app-state.service';
import { ComunidadAutonoma } from '../../models/weather.models';

declare const d3CompositeProjections: any;

const PROV_TO_CCAA: Record<string, string> = {
  '04':'Andalucía','11':'Andalucía','14':'Andalucía','18':'Andalucía',
  '21':'Andalucía','23':'Andalucía','29':'Andalucía','41':'Andalucía',
  '22':'Aragón','44':'Aragón','50':'Aragón',
  '33':'Principado de Asturias','07':'Illes Balears',
  '35':'Canarias','38':'Canarias','39':'Cantabria',
  '02':'Castilla-La Mancha','13':'Castilla-La Mancha','16':'Castilla-La Mancha',
  '19':'Castilla-La Mancha','45':'Castilla-La Mancha',
  '05':'Castilla y León','09':'Castilla y León','24':'Castilla y León',
  '34':'Castilla y León','37':'Castilla y León','40':'Castilla y León',
  '42':'Castilla y León','47':'Castilla y León','49':'Castilla y León',
  '08':'Cataluña','17':'Cataluña','25':'Cataluña','43':'Cataluña',
  '06':'Extremadura','10':'Extremadura',
  '15':'Galicia','27':'Galicia','32':'Galicia','36':'Galicia',
  '28':'Comunidad de Madrid','30':'Región de Murcia',
  '31':'Comunidad Foral de Navarra',
  '01':'País Vasco','20':'País Vasco','48':'País Vasco','26':'La Rioja',
  '03':'Comunitat Valenciana','12':'Comunitat Valenciana','46':'Comunitat Valenciana',
  '51':'Ceuta','52':'Melilla',
};

const PROV_CAPITAL: Record<string, string> = {
  '04':'04013','11':'11012','14':'14021','18':'18087',
  '21':'21041','23':'23050','29':'29067','41':'41091',
  '22':'22125','44':'44216','50':'50297','33':'33044','07':'07040',
  '35':'35016','38':'38038','39':'39075',
  '02':'02003','13':'13034','16':'16078','19':'19130','45':'45168',
  '05':'05019','09':'09059','24':'24089','34':'34120','37':'37274',
  '40':'40194','42':'42173','47':'47186','49':'49275',
  '08':'08019','17':'17079','25':'25120','43':'43148',
  '06':'06015','10':'10037',
  '15':'15030','27':'27028','32':'32054','36':'36038',
  '28':'28079','30':'30030','31':'31201',
  '01':'01059','20':'20069','48':'48020','26':'26089',
  '03':'03014','12':'12040','46':'46250','51':'51001','52':'52001',
};

const PROV_NAME: Record<string, string> = {
  '04':'Almería','11':'Cádiz','14':'Córdoba','18':'Granada',
  '21':'Huelva','23':'Jaén','29':'Málaga','41':'Sevilla',
  '22':'Huesca','44':'Teruel','50':'Zaragoza','33':'Asturias',
  '07':'Baleares','35':'Las Palmas','38':'S.C. Tenerife','39':'Cantabria',
  '02':'Albacete','13':'C. Real','16':'Cuenca','19':'Guadalajara','45':'Toledo',
  '05':'Ávila','09':'Burgos','24':'León','34':'Palencia','37':'Salamanca',
  '40':'Segovia','42':'Soria','47':'Valladolid','49':'Zamora',
  '08':'Barcelona','17':'Girona','25':'Lleida','43':'Tarragona',
  '06':'Badajoz','10':'Cáceres',
  '15':'A Coruña','27':'Lugo','32':'Ourense','36':'Pontevedra',
  '28':'Madrid','30':'Murcia','31':'Navarra',
  '01':'Álava','20':'Gipuzkoa','48':'Bizkaia','26':'La Rioja',
  '03':'Alicante','12':'Castellón','46':'Valencia','51':'Ceuta','52':'Melilla',
};

// Maps province INE 2-digit code → capital municipio INE id (same as PROV_CAPITAL in the service)
const PROV_CODE_TO_CAPITAL: Record<string,string> = {
  '04':'04013','11':'11012','14':'14021','18':'18087','21':'21041','23':'23050','29':'29067','41':'41091',
  '22':'22125','44':'44216','50':'50297','33':'33044','07':'07040','35':'35016','38':'38038','39':'39075',
  '02':'02003','13':'13034','16':'16078','19':'19130','45':'45168',
  '05':'05019','09':'09059','24':'24089','34':'34120','37':'37274','40':'40194','42':'42173','47':'47186','49':'49275',
  '08':'08019','17':'17079','25':'25120','43':'43148','06':'06015','10':'10037',
  '15':'15030','27':'27028','32':'32054','36':'36038','28':'28079','30':'30030','31':'31201',
  '01':'01059','20':'20069','48':'48020','26':'26089','03':'03014','12':'12040','46':'46250',
  '51':'51001','52':'52001',
};

const WEATHER_EMOJI: Record<string,string> = {
  sol:'☀️', sol_nubes:'⛅', nubes:'☁️', lluvia:'🌧️',
  lluvia_sol:'🌦️', tormenta:'⛈️', nieve:'❄️', niebla:'🌫️',
  viento:'💨', granizo:'🌨️',
};

@Component({
  selector: 'app-spain-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-wrapper" #wrapperRef>
      @if (isLoading) {
        <div class="map-loading"><div class="spinner"></div><span>Cargando…</span></div>
      }
      <svg #svgRef class="map-svg"></svg>
      @if (isZoomed) {
        <button class="back-btn" (click)="zoomOut()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Ver toda España
        </button>
      }
      <div class="map-tooltip" [class.visible]="tooltip.visible"
           [style.left.px]="tooltip.x" [style.top.px]="tooltip.y">
        {{ tooltip.name }}
      </div>
      <div class="scroll-hint">🖱 Rueda · Arrastrar</div>
    </div>
  `,
  styles: [`
    .map-wrapper { position: relative; width: 100%; overflow: hidden; }
    .map-svg { display: block; width: 100%; height: auto; cursor: grab; user-select: none; }
    .map-svg:active { cursor: grabbing; }
    .map-loading {
      position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; gap: 8px; color: var(--sky-600); font-size: 13px;
      background: rgba(200,230,247,0.6); z-index: 5;
    }
    .spinner { width: 20px; height: 20px; border: 2px solid var(--sky-200);
      border-top-color: var(--sky-600); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .back-btn {
      position: absolute; top: 12px; left: 14px; display: flex; align-items: center; gap: 7px;
      background: rgba(2,116,184,0.92); color: white; border: none; border-radius: 22px;
      padding: 7px 16px 7px 11px; font-size: 12px; font-weight: 600;
      font-family: var(--font-primary), system-ui; cursor: pointer; z-index: 20;
      box-shadow: 0 3px 12px rgba(2,80,140,0.3); animation: slideIn .22s ease both;
    }
    .back-btn:hover { background: rgba(2,96,160,1); }
    @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
    .map-tooltip {
      position: absolute; background: rgba(5,30,58,.9); color: white;
      font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 20px;
      pointer-events: none; opacity: 0; transition: opacity .12s; white-space: nowrap;
      transform: translate(-50%,-140%); z-index: 20;
    }
    .map-tooltip.visible { opacity: 1; }
    .scroll-hint {
      position: absolute; bottom: 6px; right: 8px;
      font-size: 10px; color: rgba(2,80,140,0.4); pointer-events: none;
    }
  `]
})
export class SpainMapComponent implements OnInit, OnDestroy {
  @ViewChild('svgRef',     { static: true }) svgRef!:     ElementRef<SVGSVGElement>;
  @ViewChild('wrapperRef', { static: true }) wrapperRef!: ElementRef<HTMLDivElement>;

  private state = inject(AppStateService);
  private zone  = inject(NgZone);

  isLoading = true;
  isZoomed  = false;
  tooltip   = { visible: false, x: 0, y: 0, name: '' };

  // SVG canvas dimensions
  private W = 0; private H = 0;
  private baseFontSize = 7;
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private proj!: any;
  private pathFn!: d3.GeoPath;

  private topoCC:   Topology | null = null;
  private topoProv: Topology | null = null;

  private featureData: Array<{ ccaaName: string; bounds: [[number,number],[number,number]] }> = [];
  private provBounds  = new Map<string, [[number,number],[number,number]]>();

  private resizeObserver?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // React to province weather data arriving — must be in constructor for injection context
    effect(() => {
      const pw = this.state.provWeather();
      if (Object.keys(pw).length > 0) {
        this.updateProvIcons(pw);
      }
    });
  }

  async ngOnInit() {
    await this.loadLib();
    [this.topoCC, this.topoProv] = await Promise.all([
      this.fetchTopo('https://unpkg.com/es-atlas@0.5.0/es/autonomous_regions.json'),
      this.fetchTopo('https://unpkg.com/es-atlas@0.5.0/es/provinces.json'),
    ]);
    this.buildMap();
    this.setupInteraction();
    this.setupResize();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeTimer);
    const el = this.svgRef?.nativeElement as any;
    if (!el) return;
    if (el.__wheel)     el.removeEventListener('wheel',       el.__wheel);
    if (el.__mousedown) el.removeEventListener('mousedown',   el.__mousedown);
    if (el.__ctxmenu)   el.removeEventListener('contextmenu', el.__ctxmenu);
    if (el.__mousemove) window.removeEventListener('mousemove', el.__mousemove);
    if (el.__mouseup)   window.removeEventListener('mouseup',   el.__mouseup);
  }

  zoomOut(): void {
    this.isZoomed = false;
    const todas = this.state.comunidades().find(c => c.id === '00');
    if (todas) this.state.selectCCAA(todas);
    this.zone.run(() => {
      this.animateViewBox(0, 0, this.W, this.H);
      // Keep province borders visible; only hide province name labels
      this.svg.select('g.prov-labels, g.prov-icons').transition().duration(300).attr('opacity', 0);
      this.redrawFills();
    });
  }

  // ─── Load lib ──────────────────────────────────────────────────────────────
  private loadLib(): Promise<void> {
    return new Promise(resolve => {
      if (typeof d3CompositeProjections !== 'undefined') { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/d3-composite-projections@1.4.0/dist/d3-composite-projections.min.js';
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  private async fetchTopo(url: string): Promise<Topology | null> {
    try { return await d3.json<Topology>(url) ?? null; } catch { return null; }
  }

  // ─── Build the full map ────────────────────────────────────────────────────
  private buildMap(): void {
    this.isLoading = true;
    if (!this.topoCC) { this.isLoading = false; return; }

    const wrapper = this.wrapperRef.nativeElement;
    this.W = Math.max(wrapper.clientWidth || 800, 400);
    const containerH = wrapper.clientHeight;
    // In split-layout the container has an explicit height; otherwise start with aspect ratio
    // We'll crop the height after measuring actual content bounds
    this.H = containerH > 150 ? containerH : Math.round(this.W * 0.60);
    this.baseFontSize = Math.max(6, Math.round(this.W / 120));

    const svgEl = this.svgRef.nativeElement;
    this.svg = d3.select(svgEl);
    this.svg.selectAll('*').remove();
    this.featureData = [];
    this.provBounds.clear();

    // ── Projection ────────────────────────────────────────────────────────
    const useComposite = typeof d3CompositeProjections !== 'undefined' &&
      typeof d3CompositeProjections.geoConicConformalSpain === 'function';
    this.proj = useComposite
      ? d3CompositeProjections.geoConicConformalSpain()
      : d3.geoConicConformal().center([-3.7,40.2]).parallels([36,44]);

    const ccaaGeo = topojson.feature(
      this.topoCC!, (this.topoCC as any).objects.autonomous_regions as GeometryCollection
    );

    // Step 1: fit to full canvas
    this.proj.fitSize([this.W, this.H], ccaaGeo);
    let path0 = d3.geoPath(this.proj);
    const [[ax0,ay0],[ax1,ay1]] = path0.bounds(ccaaGeo as any);
    const aw = ax1-ax0; const ah = ay1-ay0;

    // Step 2: rescale to fit with horizontal padding only (4% each side)
    // Use more generous horizontal padding so map aligns better
    const padH = Math.round(this.W * 0.04);
    const targetW = this.W - padH * 2;
    const sc = targetW / aw; // scale to fill width
    this.proj.scale(this.proj.scale() * sc);

    // Step 3: re-measure and shift so map is horizontally centered, top-aligned with small padding
    path0 = d3.geoPath(this.proj);
    const [[bx0,by0],[bx1,by1]] = path0.bounds(ccaaGeo as any);
    const bw = bx1-bx0; const bh = by1-by0;
    const padV = Math.round(this.H * 0.02); // small top/bottom padding
    const shiftX = (this.W - bw) / 2 - bx0;
    const shiftY = padV - by0; // align to top with small padding
    const [tx, ty] = this.proj.translate();
    this.proj.translate([tx + shiftX, ty + shiftY]);
    this.pathFn = d3.geoPath(this.proj);

    // Step 4: measure actual rendered height by checking all rendered paths
    // (pathFn.bounds on ccaaGeo misses the Canarias inset from the composite projection)
    // We do this AFTER drawing, so we temporarily draw to measure then set viewBox
    if (containerH <= 150) {
      // Draw temporarily to measure
      const tempG = this.svg.append('g').attr('class', 'temp-measure');
      tempG.selectAll('path').data((ccaaGeo as any).features)
        .join('path').attr('d', this.pathFn as any);
      
      // Get the actual rendered bounding box of all SVG content
      const svgNode = svgEl as SVGSVGElement;
      let maxY = 0;
      tempG.selectAll<SVGPathElement, any>('path').each(function() {
        try {
          const bbox = (this as SVGPathElement).getBBox();
          maxY = Math.max(maxY, bbox.y + bbox.height);
        } catch(e) { /* ignore */ }
      });
      tempG.remove();
      
      // If getBBox worked, use it; otherwise fall back to pathFn bounds
      if (maxY > 50) {
        const padVpx = Math.round(maxY * 0.03); // 3% bottom padding
        this.H = Math.round(maxY + padVpx);
      } else {
        // Fallback: use pathFn bounds bottom
        const [[,],[,ry1]] = this.pathFn.bounds(ccaaGeo as any);
        this.H = Math.round(ry1 * 1.03);
      }
      this.H = Math.max(this.H, 200);
    }

    svgEl.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    svgEl.setAttribute('width',   String(this.W));
    svgEl.setAttribute('height',  String(this.H));

    // ── Index CCAA features ───────────────────────────────────────────────
    (ccaaGeo as any).features.forEach((f: any, i: number) => {
      const name   = this.getCCAAName(f, i);
      const bounds = this.pathFn.bounds(f as any) as [[number,number],[number,number]];
      this.featureData.push({ ccaaName: name, bounds });
    });

    // ── Index province bounds ─────────────────────────────────────────────
    if (this.topoProv) {
      const provGeo = topojson.feature(this.topoProv, (this.topoProv as any).objects.provinces as GeometryCollection);
      (provGeo as any).features.forEach((f: any) => {
        const code = String(f.id ?? '').padStart(2,'0');
        this.provBounds.set(code, this.pathFn.bounds(f as any) as [[number,number],[number,number]]);
      });
    }

    // ── Draw layers (order matters: CCAA fill → prov borders → prov labels → comp borders → CCAA labels)
    this.drawCCAALayer(ccaaGeo);
    this.drawProvLayers(this.isZoomed); // visible immediately if already zoomed
    this.drawCompositionBorders();
    this.drawCCAALabels(ccaaGeo);

    this.isLoading = false;
  }

  // ── CCAA fill + click ─────────────────────────────────────────────────────
  private drawCCAALayer(ccaaGeo: any): void {
    const wrapper = this.wrapperRef.nativeElement;
    this.svg.append('g').attr('class', 'ccaa-layer')
      .selectAll<SVGPathElement, any>('path.ccaa')
      .data(ccaaGeo.features)
      .join('path').attr('class','ccaa')
      .attr('d', this.pathFn as any)
      .attr('fill', (_f:any, i:number) => this.fillForIdx(i))
      .attr('stroke','white').attr('stroke-width',0.8).attr('stroke-linejoin','round')
      .style('cursor','pointer')
      .on('mouseenter', (ev:MouseEvent) => {
        const idx  = this.domIdx(ev,'ccaa');
        const name = this.featureData[idx]?.ccaaName ?? '';
        if (name && !this.isSelectedByName(name)) d3.select(ev.currentTarget as Element).attr('fill','#3a9fd4');
        const r = wrapper.getBoundingClientRect();
        this.zone.run(() => { this.tooltip = { visible:true, x:ev.clientX-r.left, y:ev.clientY-r.top, name }; });
      })
      .on('mousemove', (ev:MouseEvent) => {
        const r = wrapper.getBoundingClientRect();
        this.tooltip.x = ev.clientX-r.left; this.tooltip.y = ev.clientY-r.top;
      })
      .on('mouseleave', (ev:MouseEvent) => {
        const idx = this.domIdx(ev,'ccaa');
        d3.select(ev.currentTarget as Element).attr('fill', this.fillForIdx(idx));
        this.zone.run(() => { this.tooltip = {...this.tooltip, visible:false}; });
      })
      .on('click', (ev:MouseEvent) => {
        const idx   = this.domIdx(ev,'ccaa');
        const entry = this.featureData[idx];
        if (!entry || entry.ccaaName.startsWith('Unknown')) return;
        const ccaa  = this.state.comunidades().find(c => c.id !== '00' && c.name === entry.ccaaName);
        if (!ccaa) return;

        // For Canarias: union of both province bounds
        let bounds = entry.bounds;
        if (this.norm(entry.ccaaName).includes('canaria')) {
          const b35 = this.provBounds.get('35'); const b38 = this.provBounds.get('38');
          if (b35 && b38) bounds = [
            [Math.min(b35[0][0],b38[0][0]), Math.min(b35[0][1],b38[0][1])],
            [Math.max(b35[1][0],b38[1][0]), Math.max(b35[1][1],b38[1][1])],
          ];
        }

        this.zone.run(() => {
          this.tooltip  = { ...this.tooltip, visible: false };
          this.isZoomed = true;
          this.state.selectCCAA(ccaa);
          this.state.selectMunicipio(ccaa.municipios[0]);
          this.redrawFills();
          this.zoomToBounds(bounds);
          // Fade in province layers
          this.svg.selectAll('g.prov-layer, g.prov-labels, g.prov-icons').transition().duration(400).attr('opacity', 1);
        });
      });
  }

  // ── Province borders + labels ──────────────────────────────────────────────
  private drawProvLayers(showNow = false): void {
    if (!this.topoProv) return;
    const provGeo   = topojson.feature(this.topoProv, (this.topoProv as any).objects.provinces as GeometryCollection);
    const features  = (provGeo as any).features;
    const wrapper   = this.wrapperRef.nativeElement;
    const provLabelFs = Math.max(5, Math.round(this.W / 170));

    // CAs where the province name = the CCAA name → suppress to avoid duplicate text
    // Rule: if PROV_NAME[code] normalised == shortLabel(ccaaName) normalised → hide
    const SUPPRESS_PROV_LABEL = new Set([
      // Single-province CAs
      '33', // Asturias (prov=Asturias, CA=Principado de Asturias → shortLabel=Asturias)
      '39', // Cantabria (prov=Cantabria, CA=Cantabria)
      '28', // Madrid (prov=Madrid, CA=Comunidad de Madrid → shortLabel=Madrid)
      '30', // Murcia (prov=Murcia, CA=Región de Murcia → shortLabel=Murcia)
      '31', // Navarra (prov=Navarra, CA=Comunidad Foral de Navarra → shortLabel=Navarra)
      '26', // La Rioja (prov=La Rioja, CA=La Rioja)
      '51', // Ceuta
      '52', // Melilla
    ]);

    // Province borders: always visible (subtle, helps orientation)
    // Province labels: only shown when zoomed into a CA
    const labelOpacity   = showNow ? 1 : 0;

    // ── Province border paths (always visible) ───────────────────────────
    this.svg.append('g').attr('class','prov-layer').attr('opacity', 1)
      .selectAll<SVGPathElement, any>('path.prov')
      .data(features)
      .join('path').attr('class','prov')
      .attr('d', this.pathFn as any)
      .attr('fill','rgba(0,0,0,0)')
      .attr('stroke','rgba(255,255,255,0.85)').attr('stroke-width',0.4)
      .style('cursor','pointer')
      .on('mouseenter', (ev:MouseEvent, f:any) => {
        const code = String(f.id??'').padStart(2,'0');
        d3.select(ev.currentTarget as Element).attr('fill','rgba(255,255,255,0.18)');
        const r = wrapper.getBoundingClientRect();
        this.zone.run(() => {
          this.tooltip = { visible:true, x:ev.clientX-r.left, y:ev.clientY-r.top, name: PROV_NAME[code]??'' };
        });
      })
      .on('mousemove', (ev:MouseEvent) => {
        const r = wrapper.getBoundingClientRect();
        this.tooltip.x = ev.clientX-r.left; this.tooltip.y = ev.clientY-r.top;
      })
      .on('mouseleave', (ev:MouseEvent) => {
        d3.select(ev.currentTarget as Element).attr('fill','rgba(0,0,0,0)');
        this.zone.run(() => { this.tooltip = {...this.tooltip, visible:false}; });
      })
      .on('click', (ev:MouseEvent, f:any) => {
        ev.stopPropagation();
        const code = String(f.id??'').padStart(2,'0');
        const ccaaName  = PROV_TO_CCAA[code];
        const capitalId = PROV_CAPITAL[code];
        if (!ccaaName || !capitalId) return;
        const ccaa = this.state.comunidades().find(c => c.id!=='00' && c.name===ccaaName);
        const muni = ccaa?.municipios.find(m => m.id===capitalId) ?? ccaa?.municipios[0];
        const bounds = this.provBounds.get(code);
        this.zone.run(() => {
          this.tooltip = {...this.tooltip, visible:false};
          this.isZoomed = true;
          if (ccaa) { this.state.selectCCAA(ccaa); this.redrawFills(); }
          if (muni) this.state.selectMunicipio(muni);
          if (bounds) this.zoomToBounds(bounds);
        });
      });

    // ── Province name labels (shown when zoomed) ─────────────────────────
    this.svg.append('g').attr('class','prov-labels').attr('opacity', labelOpacity)
      .selectAll<SVGTextElement, any>('text.prov-label')
      .data(features)
      .join('text').attr('class','prov-label')
      .attr('transform', (f:any) => {
        const c = this.pathFn.centroid(f as any);
        return c && isFinite(c[0]) ? `translate(${c})` : 'translate(-9999,-9999)';
      })
      .attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size', provLabelFs)
      .attr('font-family','var(--font-primary), system-ui')
      .attr('font-weight','500')
      .attr('fill','rgba(255,255,255,0.82)')
      .attr('pointer-events','none')
      .attr('paint-order','stroke')
      .attr('stroke','rgba(2,60,120,0.35)')
      .attr('stroke-width', provLabelFs * 0.45)
      .text((f:any) => {
        const code = String(f.id??'').padStart(2,'0');
        if (SUPPRESS_PROV_LABEL.has(code)) return '';
        return PROV_NAME[code] ?? '';
      });

    // ── Province weather icons (emoji) ───────────────────────────────────
    const iconFs = Math.max(9, Math.round(this.W / 85));
    this.svg.append('g').attr('class','prov-icons').attr('opacity', labelOpacity)
      .selectAll<SVGTextElement, any>('text.prov-icon')
      .data(features)
      .join('text').attr('class','prov-icon')
      .attr('transform', (f:any) => {
        const c = this.pathFn.centroid(f as any);
        if (!c || !isFinite(c[0])) return 'translate(-9999,-9999)';
        const code      = String(f.id??'').padStart(2,'0');
        const hasLabel  = !SUPPRESS_PROV_LABEL.has(code) && !!PROV_NAME[code];
        // Place icon above label if label exists, otherwise centered
        const yOff = hasLabel ? -(provLabelFs * 1.5) : 0;
        return `translate(${c[0]},${c[1] + yOff})`;
      })
      .attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size', iconFs)
      .attr('pointer-events','none')
      .text(''); // populated by updateProvIcons() once data arrives
  }

  private drawCompositionBorders(): void {
    if (typeof this.proj.getCompositionBorders !== 'function') return;
    this.svg.append('path')
      .attr('d', this.proj.getCompositionBorders())
      .attr('fill','none').attr('stroke','#7ab8d9')
      .attr('stroke-width',0.8).attr('stroke-dasharray','4,3').attr('opacity',0.6);
  }

  private drawCCAALabels(ccaaGeo: any): void {
    const fs = this.baseFontSize;
    this.svg.append('g').attr('class','labels')
      .selectAll('text').data(ccaaGeo.features).join('text')
      .attr('transform', (f:any) => {
        const c = this.pathFn.centroid(f as any);
        return c && isFinite(c[0]) ? `translate(${c})` : 'translate(-9999,-9999)';
      })
      .attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size',fs).attr('font-family','var(--font-primary), system-ui')
      .attr('font-weight','500').attr('fill','rgba(255,255,255,0.88)')
      .attr('pointer-events','none')
      .attr('paint-order','stroke')
      .attr('stroke','rgba(2,80,140,0.30)').attr('stroke-width', fs*0.4)
      .text((_f:any,i:number) => this.shortLabel(this.featureData[i]?.ccaaName ?? ''));
  }

  // ── ViewBox zoom to region ─────────────────────────────────────────────────
  private zoomToBounds(b: [[number,number],[number,number]]): void {
    const [[x0,y0],[x1,y1]] = b;
    const bw = x1-x0; const bh = y1-y0;
    const pad = Math.round(Math.min(this.W,this.H) * 0.07);
    let vx = x0-pad; let vy = y0-pad;
    let vw = bw+pad*2; let vh = bh+pad*2;
    // Enforce aspect ratio
    const ar = this.W / this.H;
    if (vw/vh < ar) { const nw=vh*ar; vx-=(nw-vw)/2; vw=nw; }
    else            { const nh=vw/ar; vy-=(nh-vh)/2; vh=nh; }
    this.animateViewBox(vx, vy, vw, vh);
  }

  // ── Animate viewBox ────────────────────────────────────────────────────────
  private animateViewBox(tx:number, ty:number, tw:number, th:number): void {
    const cur = this.getVB();
    const interp = d3.interpolateArray(cur, [tx,ty,tw,th]);
    d3.select(this.svgRef.nativeElement)
      .transition().duration(600).ease(d3.easeCubicInOut)
      .tween('viewBox', () => (t:number) => {
        const [x,y,w,h] = interp(t) as number[];
        this.applyVB(x,y,w,h);
      });
  }

  // ── Interaction: wheel zoom + drag pan ────────────────────────────────────
  private setupInteraction(): void {
    const el   = this.svgRef.nativeElement as any;
    const self = this;

    // Remove old handlers
    ['wheel','mousedown','contextmenu'].forEach(ev => {
      if (el[`__${ev}`]) el.removeEventListener(ev, el[`__${ev}`]);
    });
    if (el.__mousemove) window.removeEventListener('mousemove', el.__mousemove);
    if (el.__mouseup)   window.removeEventListener('mouseup',   el.__mouseup);

    // Wheel zoom (fixed: no drift)
    el.__wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [vx,vy,vw,vh] = self.getVB();
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      const maxVw = self.W * 1.01;
      const minVw = self.W * 0.08;
      const rawVw = vw * factor;
      const fVw   = Math.max(minVw, Math.min(maxVw, rawVw));
      const fVh   = vh * (fVw/vw);
      const ratio = fVw/vw;
      const rect  = el.getBoundingClientRect();
      const mx    = vx + (e.clientX - rect.left) / rect.width  * vw;
      const my    = vy + (e.clientY - rect.top)  / rect.height * vh;
      self.applyVB(mx-(mx-vx)*ratio, my-(my-vy)*ratio, fVw, fVh);
    };

    // Drag pan (any button)
    let dragging = false; let lx=0; let ly=0;
    el.__mousedown = (e: MouseEvent) => {
      e.preventDefault();
      dragging=true; lx=e.clientX; ly=e.clientY;
    };
    el.__mousemove = (e: MouseEvent) => {
      if (!dragging) return;
      const [vx,vy,vw,vh] = self.getVB();
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX-lx)/rect.width  * vw;
      const dy = (e.clientY-ly)/rect.height * vh;
      lx=e.clientX; ly=e.clientY;
      self.applyVB(vx-dx, vy-dy, vw, vh);
    };
    el.__mouseup   = () => { dragging=false; };
    el.__contextmenu = (e: Event) => e.preventDefault();

    el.addEventListener('wheel',       el.__wheel,       { passive:false });
    el.addEventListener('mousedown',   el.__mousedown);
    el.addEventListener('contextmenu', el.__contextmenu);
    window.addEventListener('mousemove', el.__mousemove);
    window.addEventListener('mouseup',   el.__mouseup);
  }

  // ── ViewBox helpers ────────────────────────────────────────────────────────

  /** Update province weather emoji icons from the provWeather signal */
  private updateProvIcons(pw: Record<string, string>): void {
    if (!this.svg) return;
    // Update text content of each icon element
    this.svg.selectAll<SVGTextElement, any>('g.prov-icons text.prov-icon')
      .text((f: any) => {
        const code      = String(f?.id ?? '').padStart(2, '0');
        const capitalId = PROV_CODE_TO_CAPITAL[code];
        const icon      = capitalId ? (pw[capitalId] ?? '') : '';
        return icon ? (WEATHER_EMOJI[icon] ?? '🌡️') : '';
      });
    // Make sure the layer is visible if we're zoomed
    if (this.isZoomed) {
      this.svg.select('g.prov-icons').attr('opacity', 1);
    }
  }

  private getVB(): [number,number,number,number] {
    return (this.svgRef.nativeElement.getAttribute('viewBox') ?? `0 0 ${this.W} ${this.H}`)
             .split(' ').map(Number) as [number,number,number,number];
  }

  private applyVB(vx:number, vy:number, vw:number, vh:number): void {
    const el = this.svgRef.nativeElement;
    el.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    const scale = this.W / vw;
    el.querySelectorAll<SVGPathElement>('path.ccaa')
      .forEach(p => p.setAttribute('stroke-width', `${(0.8/scale).toFixed(3)}`));
    el.querySelectorAll<SVGPathElement>('path.prov')
      .forEach(p => p.setAttribute('stroke-width', `${(0.4/scale).toFixed(3)}`));
    const fs   = Math.min(this.baseFontSize*3, Math.max(this.baseFontSize*0.8, 11/scale));
    const pfs  = Math.min(this.baseFontSize*2.5, Math.max(this.baseFontSize*0.5, 9/scale));
    const ifs  = Math.min(this.baseFontSize*3.5, Math.max(this.baseFontSize*0.8, 13/scale));
    el.querySelectorAll<SVGTextElement>('g.labels text')
      .forEach(t => { t.setAttribute('font-size',`${fs.toFixed(2)}`); t.setAttribute('stroke-width',`${(fs*0.35).toFixed(2)}`); });
    el.querySelectorAll<SVGTextElement>('g.prov-labels text')
      .forEach(t => { t.setAttribute('font-size',`${pfs.toFixed(2)}`); t.setAttribute('stroke-width',`${(pfs*0.4).toFixed(2)}`); });
    el.querySelectorAll<SVGTextElement>('g.prov-icons text')
      .forEach(t => t.setAttribute('font-size',`${ifs.toFixed(2)}`));
  }

  // ── Fill helpers ───────────────────────────────────────────────────────────
  private fillForIdx(i: number): string {
    return this.isSelectedByName(this.featureData[i]?.ccaaName??'') ? '#0274b8' : '#7ac4e8';
  }
  private isSelectedByName(n: string): boolean {
    const s = this.state.selectedCCAA(); return s.id!=='00' && s.name===n;
  }
  private redrawFills(): void {
    if (!this.svg) return;
    this.svg.selectAll<SVGPathElement,any>('path.ccaa').attr('fill',(_f,i)=>this.fillForIdx(i));
  }

  private domIdx(ev: MouseEvent, cls: string): number {
    return Array.from(
      (ev.currentTarget as Element).parentElement!.querySelectorAll(`path.${cls}`)
    ).indexOf(ev.currentTarget as Element);
  }

  private getCCAAName(f: any, idx: number): string {
    const p = f.properties ?? {};
    const candidates = [p.NAME_1,p.name,p.NAME,p.NAMEUNIT,p.NOM_CCAA,p.Texto,p.NUTS_NAME].filter(Boolean);
    for (const c of candidates) {
      const m = this.resolveCCAAName(String(c));
      if (m) return m;
    }
    const natcode  = String(p.NATCODE??p.natcode??p.code??p.CODE??f.id??'').replace(/[^0-9]/g,'');
    const shortCode = natcode.substring(0,2).padStart(2,'0');
    const NATMAP: Record<string,string> = {
      '01':'Andalucía','02':'Aragón','03':'Principado de Asturias','04':'Illes Balears',
      '05':'Canarias','06':'Cantabria','07':'Castilla-La Mancha','08':'Castilla y León',
      '09':'Cataluña','10':'Extremadura','11':'Galicia','13':'Comunidad de Madrid',
      '14':'Región de Murcia','15':'Comunidad Foral de Navarra','16':'País Vasco',
      '17':'La Rioja','18':'Comunitat Valenciana','19':'Ceuta','20':'Melilla',
    };
    if (NATMAP[shortCode]) return NATMAP[shortCode];
    const ORDER = ['Andalucía','Aragón','Principado de Asturias','Illes Balears','Canarias',
      'Cantabria','Comunidad de Madrid','Castilla y León','Castilla-La Mancha','Cataluña',
      'Comunitat Valenciana','Extremadura','Galicia','La Rioja',
      'Comunidad Foral de Navarra','País Vasco','Región de Murcia','Ceuta','Melilla'];
    return ORDER[idx] ?? `Unknown_${idx}`;
  }

  private resolveCCAAName(text: string): string | null {
    const nl   = this.norm(text);
    const list = this.state.comunidades().filter(c => c.id !== '00');
    return (list.find(c=>this.norm(c.name)===nl)
         ?? list.find(c=>nl.includes(this.norm(c.name)))
         ?? list.find(c=>this.norm(c.name).includes(nl)))?.name ?? null;
  }

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z\s]/g,'').trim();
  }

  private shortLabel(n: string): string {
    const M: Record<string,string> = {
      'Andalucía':'Andalucía','Aragón':'Aragón','Principado de Asturias':'Asturias',
      'Illes Balears':'Baleares','Canarias':'Canarias','Cantabria':'Cantabria',
      'Castilla-La Mancha':'C-La Mancha','Castilla y León':'C. y León',
      'Cataluña':'Cataluña','Extremadura':'Extremadura','Galicia':'Galicia',
      'La Rioja':'La Rioja','Comunidad de Madrid':'Madrid','Región de Murcia':'Murcia',
      'Comunidad Foral de Navarra':'Navarra','País Vasco':'P. Vasco',
      'Comunitat Valenciana':'Valencia','Ceuta':'Ceuta','Melilla':'Melilla',
    };
    return M[n] ?? n.split(' ').slice(0,2).join(' ');
  }

  private setupResize(): void {
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        const wasZoomed = this.isZoomed;
        const sel       = this.state.selectedCCAA();
        this.buildMap();       // rebuilds with this.isZoomed already set, so drawProvLayers gets correct opacity
        this.setupInteraction();
        if (wasZoomed && sel.id !== '00') {
          // Re-apply zoom after rebuild
          const entry = this.featureData.find(d => d.ccaaName === sel.name);
          if (entry) {
            this.redrawFills();
            // Compute zoom bounds (Canarias special case)
            let bounds = entry.bounds;
            if (this.norm(entry.ccaaName).includes('canaria')) {
              const b35 = this.provBounds.get('35'); const b38 = this.provBounds.get('38');
              if (b35 && b38) bounds = [
                [Math.min(b35[0][0],b38[0][0]), Math.min(b35[0][1],b38[0][1])],
                [Math.max(b35[1][0],b38[1][0]), Math.max(b35[1][1],b38[1][1])],
              ];
            }
            this.zoomToBounds(bounds);
            // Re-apply weather icons
            const pw = this.state.provWeather();
            if (Object.keys(pw).length > 0) this.updateProvIcons(pw);
          }
        }
      }, 150);
    });
    this.resizeObserver.observe(this.wrapperRef.nativeElement);
  }
}
