import type { Settings } from '../../domain/settings';
import { layoutFor, type ResponsiveLayout } from './layout';
import type { Insets, ViewportMetrics } from './metrics';

type Listener = (layout: ResponsiveLayout) => void;

/** Coalesces browser and container changes into one presentation-only layout snapshot per frame. */
export class ResponsiveLayoutController {
  private readonly listeners = new Set<Listener>();
  private readonly safeProbe: HTMLDivElement;
  private resizeObserver: ResizeObserver | null = null;
  private mediaQueries: MediaQueryList[] = [];
  private frame: number | null = null;
  private current: ResponsiveLayout | null = null;
  private settings: Settings;
  private readonly visualViewport: VisualViewport | null;

  private readonly schedule = (): void => {
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.measureAndPublish();
    });
  };

  constructor(
    private readonly doc: Document,
    private readonly app: HTMLElement,
    private readonly host: HTMLElement,
    settings: Settings,
  ) {
    this.settings = settings;
    this.visualViewport = window.visualViewport ?? null;
    this.safeProbe = doc.createElement('div');
    this.safeProbe.setAttribute('aria-hidden', 'true');
    this.safeProbe.dataset.responsiveSafeProbe = 'true';
    Object.assign(this.safeProbe.style, {
      position: 'fixed',
      visibility: 'hidden',
      pointerEvents: 'none',
      paddingTop: 'env(safe-area-inset-top)',
      paddingRight: 'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
    });
    doc.body.append(this.safeProbe);
  }

  start(): void {
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.schedule);
    this.resizeObserver?.observe(this.app);
    this.resizeObserver?.observe(this.host);
    window.addEventListener('resize', this.schedule, { passive: true });
    window.addEventListener('orientationchange', this.schedule, { passive: true });
    window.addEventListener('focusin', this.schedule);
    window.addEventListener('focusout', this.schedule);
    this.visualViewport?.addEventListener('resize', this.schedule, { passive: true });
    this.visualViewport?.addEventListener('scroll', this.schedule, { passive: true });
    this.mediaQueries = ['(pointer: coarse)', '(pointer: fine)', '(hover: hover)'].map((query) => window.matchMedia(query));
    for (const query of this.mediaQueries) query.addEventListener('change', this.schedule);
    this.measureAndPublish();
  }

  get(): ResponsiveLayout {
    if (!this.current) this.measureAndPublish();
    return this.current!;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.get());
    return () => this.listeners.delete(listener);
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.schedule();
  }

  dispose(): void {
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.schedule);
    window.removeEventListener('orientationchange', this.schedule);
    window.removeEventListener('focusin', this.schedule);
    window.removeEventListener('focusout', this.schedule);
    this.visualViewport?.removeEventListener('resize', this.schedule);
    this.visualViewport?.removeEventListener('scroll', this.schedule);
    for (const query of this.mediaQueries) query.removeEventListener('change', this.schedule);
    this.mediaQueries = [];
    this.listeners.clear();
    this.safeProbe.remove();
  }

  private measureAndPublish(): void {
    const hostBounds = this.host.getBoundingClientRect();
    const appBounds = this.app.getBoundingClientRect();
    const visual = this.visualViewport;
    const active = this.doc.activeElement;
    const textEntryFocused = active instanceof HTMLElement && (
      active.isContentEditable || active.matches('input, textarea, select')
    );
    const layoutHeight = Math.max(1, window.innerHeight);
    const visualHeight = visual?.height ?? layoutHeight;
    const keyboardOpen = Boolean(textEntryFocused && layoutHeight - visualHeight > Math.min(120, layoutHeight * 0.2));
    const metrics: ViewportMetrics = {
      layoutViewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: {
        x: visual?.offsetLeft ?? 0,
        y: visual?.offsetTop ?? 0,
        width: visual?.width ?? window.innerWidth,
        height: visualHeight,
      },
      host: { x: hostBounds.left, y: hostBounds.top, width: hostBounds.width, height: hostBounds.height },
      safeInsets: this.readSafeInsets(),
      pointers: {
        coarse: this.mediaQueries[0]?.matches ?? false,
        fine: this.mediaQueries[1]?.matches ?? true,
        hover: this.mediaQueries[2]?.matches ?? false,
        touchPoints: navigator.maxTouchPoints ?? 0,
      },
      keyboardOpen,
    };
    const result = layoutFor(metrics, this.settings.mobile.controlsPlacement);
    this.current = result;
    const root = this.doc.documentElement;
    root.dataset.responsiveOrientation = result.orientation;
    root.dataset.controlsPlacement = this.settings.mobile.controlsPlacement;
    root.dataset.keyboardOpen = String(result.keyboardOpen);
    for (const [name, value] of Object.entries(result.cssTokens)) root.style.setProperty(name, value);
    root.style.setProperty('--responsive-host-left', `${hostBounds.left - appBounds.left}px`);
    root.style.setProperty('--responsive-host-top', `${hostBounds.top - appBounds.top}px`);
    const controls = this.doc.querySelector<HTMLElement>('#touch-controls');
    if (controls) controls.dataset.placement = this.settings.mobile.controlsPlacement;
    for (const listener of this.listeners) listener(result);
  }

  private readSafeInsets(): Insets {
    const style = window.getComputedStyle(this.safeProbe);
    return {
      top: px(style.paddingTop),
      right: px(style.paddingRight),
      bottom: px(style.paddingBottom),
      left: px(style.paddingLeft),
    };
  }
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
