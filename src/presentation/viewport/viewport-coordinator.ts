import type { Rect } from '../responsive/metrics';
import { cameraViewportFor, type ResponsiveLayout } from '../responsive/layout';
import {
  DEFAULT_SCENE_ZOOM_CAP,
  INTERIOR_TOUCH_SCENE_ZOOM_CAP,
  deadzoneOf,
  mapZoomFor,
  sceneZoomFor,
  type Size,
} from '../camera';
import { calculatePixelViewportPolicy, type PixelViewportPolicy } from '../pixel-viewport/policy';
import type { RenderProfileId } from '../pixel-viewport/profiles';
import { TILE_SIZE } from '../constants';

/** Inputs that define the presentation viewport; never includes saved or domain state. */
export interface ViewportCoordinatorInput {
  layout: ResponsiveLayout;
  profile: RenderProfileId;
  dpr: number;
  /** Current scene size in world units; omitted only for viewport-only diagnostics. */
  mapWorldSize?: Size;
  /** Explicit scene classification; only mobile interiors receive the larger framing cap. */
  sceneKind?: 'interior' | 'exterior';
}

/** Values derived from one responsive snapshot and applied together by the scene. */
export interface ViewportPlan {
  pixelViewport: PixelViewportPolicy;
  cameraViewport: Rect;
  zoom: number;
  deadzone: Size;
  touchInput: boolean;
}

/** Narrow Phaser boundary; the coordinator itself remains independently testable. */
export interface ViewportCoordinatorPort {
  gameSize(): Size;
  setGameSize(size: Size): void;
  setCameraViewport(viewport: Rect): void;
  setCameraZoom(zoom: number): void;
  setCameraDeadzone(size: Size): void;
}

/**
 * Keeps the responsive layout → pixel policy → Phaser scale/camera path in one place.
 * Calculation is pure; apply only changes the presentation ports and is safe to repeat.
 */
export class ViewportCoordinator {
  calculate(input: ViewportCoordinatorInput): ViewportPlan {
    const { layout } = input;
    const touchInput = layout.pointer.coarse || layout.pointer.touchPoints > 0;
    const pixelViewport = calculatePixelViewportPolicy({
      container: layout.worldRect,
      safeArea: layout.safeRect,
      dpr: input.dpr,
      orientation: layout.orientation,
      profile: input.profile,
      input: touchInput ? 'touch' : 'pointer',
    });
    const cameraViewport = cameraViewportFor(layout, pixelViewport.renderResolution);
    const baseZoom = pixelViewport.profile.id === 'legacy'
      ? mapZoomFor({
        cameraWidth: cameraViewport.width,
        coarse: touchInput,
        portrait: layout.orientation === 'portrait',
      })
      : cameraViewport.width / (pixelViewport.worldTilesVisible.width * TILE_SIZE);
    const zoomCap = touchInput && input.sceneKind === 'interior'
      ? INTERIOR_TOUCH_SCENE_ZOOM_CAP
      : DEFAULT_SCENE_ZOOM_CAP;
    const zoom = input.mapWorldSize
      ? sceneZoomFor(baseZoom, input.mapWorldSize, cameraViewport, zoomCap)
      : baseZoom;

    return {
      pixelViewport,
      cameraViewport,
      zoom,
      deadzone: deadzoneOf({
        width: cameraViewport.width / zoom,
        height: cameraViewport.height / zoom,
      }),
      touchInput,
    };
  }

  apply(input: ViewportCoordinatorInput, port: ViewportCoordinatorPort): ViewportPlan {
    const plan = this.calculate(input);
    const currentSize = port.gameSize();
    const desiredSize = plan.pixelViewport.renderResolution;
    if (currentSize.width !== desiredSize.width || currentSize.height !== desiredSize.height) {
      port.setGameSize(desiredSize);
    }
    port.setCameraViewport(plan.cameraViewport);
    port.setCameraZoom(plan.zoom);
    port.setCameraDeadzone(plan.deadzone);
    return plan;
  }
}
