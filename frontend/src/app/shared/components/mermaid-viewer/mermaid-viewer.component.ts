import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  effect,
  inject,
  ElementRef,
  viewChild,
  SecurityContext
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import mermaid from 'mermaid';

// Configuración global del tema oscuro para Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    darkMode: true,
    background: '#0B0F19',
    primaryColor: '#312E81',
    primaryTextColor: '#E0E7FF',
    primaryBorderColor: '#6366F1',
    lineColor: '#818CF8',
    secondaryColor: '#1E293B',
    secondaryTextColor: '#CBD5E1',
    secondaryBorderColor: '#475569',
    tertiaryColor: '#0F172A',
    tertiaryTextColor: '#94A3B8',
    tertiaryBorderColor: '#334155',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px'
  },
  securityLevel: 'loose'
});

@Component({
  selector: 'app-mermaid-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mermaid-viewer.component.html',
  styleUrls: ['./mermaid-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidViewerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  public readonly code = input<string>('');
  public readonly title = input<string>('Roadmap de Ejecución');

  public readonly svgContainer = viewChild<ElementRef<HTMLDivElement>>('svgWrapper');

  // Estado de vista
  public readonly viewMode = signal<'VISUAL' | 'CODE'>('VISUAL');
  public readonly svgHtml = signal<SafeHtml | null>(null);
  public readonly rawSvg = signal<string>('');
  public readonly isLoading = signal<boolean>(false);
  public readonly hasError = signal<boolean>(false);
  public readonly errorMessage = signal<string>('');
  public readonly copied = signal<boolean>(false);
  public readonly isDownloading = signal<boolean>(false);

  // Controles de Pan & Zoom
  public readonly zoom = signal<number>(1);
  public readonly panX = signal<number>(0);
  public readonly panY = signal<number>(0);
  public readonly isDragging = signal<boolean>(false);

  private dragStartX = 0;
  private dragStartY = 0;

  constructor() {
    // Re-renderizar automáticamente cuando cambie el código
    effect(() => {
      const currentCode = this.code();
      if (currentCode) {
        this.renderMermaid(currentCode);
      }
    });
  }

  private async renderMermaid(rawCode: string): Promise<void> {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');

    try {
      // Limpieza de entidades HTML o backticks sobrantes
      let cleanCode = rawCode
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/```mermaid/g, '')
        .replace(/```/g, '')
        .trim();

      if (!cleanCode.startsWith('flowchart') && !cleanCode.startsWith('graph')) {
        cleanCode = 'flowchart TD\n' + cleanCode;
      }

      const id = 'mermaid-chart-' + Math.random().toString(36).substring(2, 9);
      const { svg } = await mermaid.render(id, cleanCode);

      this.rawSvg.set(svg);
      this.svgHtml.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      this.resetView();
    } catch (err: any) {
      console.error('[MermaidViewer] Error rendering diagram:', err);
      this.hasError.set(true);
      this.errorMessage.set(err?.message || 'Error de sintaxis en el diagrama Mermaid');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Controles de Zoom
  public zoomIn(): void {
    this.zoom.update(z => Math.min(Number((z + 0.2).toFixed(2)), 3.5));
  }

  public zoomOut(): void {
    this.zoom.update(z => Math.max(Number((z - 0.2).toFixed(2)), 0.4));
  }

  public resetView(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  public onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    this.zoom.update(z => {
      const next = Number((z + delta).toFixed(2));
      return Math.min(Math.max(next, 0.4), 3.5);
    });
  }

  // Controles de Pan (Arrastrar con el mouse)
  public onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Solo click izquierdo
    this.isDragging.set(true);
    this.dragStartX = event.clientX - this.panX();
    this.dragStartY = event.clientY - this.panY();
  }

  public onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;
    this.panX.set(event.clientX - this.dragStartX);
    this.panY.set(event.clientY - this.dragStartY);
  }

  public onMouseUp(): void {
    this.isDragging.set(false);
  }

  public onMouseLeave(): void {
    this.isDragging.set(false);
  }

  // Copiar código Mermaid al portapapeles
  public async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      console.error('Error al copiar código:', err);
    }
  }

  // Descargar Diagrama en PNG en alta resolución
  public async downloadPng(): Promise<void> {
    this.isDownloading.set(true);
    try {
      const container = this.svgContainer()?.nativeElement;
      const svgEl = container?.querySelector('svg');
      if (!svgEl) {
        throw new Error('No se encontró el elemento SVG para exportar.');
      }

      // Medidas reales del SVG
      const bbox = svgEl.getBoundingClientRect();
      const width = Math.max(Math.round(bbox.width) || 1200, 900);
      const height = Math.max(Math.round(bbox.height) || 800, 600);

      // Factor de escala 2x para resolución ultra nítida (Retina)
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el contexto 2D del Canvas.');

      // Fondo oscuro elegante que coincide con la aplicación
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Serializar SVG
      const serializer = new XMLSerializer();
      let svgStr = serializer.serializeToString(svgEl);

      // Asegurar xmlns
      if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);

        // Disparar descarga
        const a = document.createElement('a');
        a.download = `roadmap-${Date.now()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        this.isDownloading.set(false);
      };

      img.onerror = (e) => {
        console.error('Error cargando SVG en Canvas:', e);
        URL.revokeObjectURL(blobUrl);
        this.isDownloading.set(false);
      };

      img.src = blobUrl;
    } catch (err) {
      console.error('Error exportando PNG:', err);
      this.isDownloading.set(false);
    }
  }
}
