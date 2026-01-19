import { AppStateService } from "../../services/AppStateService";
import { AudioService } from "../../services/AudioService";

/**
 * Collection of elements and services required for BenchmarkScrollController.
 */
export interface BenchmarkScrollDependencies {
  readonly scrollContainer: HTMLElement;
  readonly scrollThumb: HTMLElement;
  readonly hoverContainer: HTMLElement;
  readonly appStateService?: AppStateService | null;
  readonly audioService?: AudioService | null;
}

/**
 * Manages custom scrollbar behavior for the benchmark table.
 *
 * Provides synchronization between the scroll container and a custom thumb,
 * as well as drag-and-drop and hover-auto-scroll functionality.
 */
export class BenchmarkScrollController {
  private readonly _scrollContainer: HTMLElement;
  private readonly _scrollThumb: HTMLElement;
  private readonly _hoverContainer: HTMLElement;
  private readonly _appStateService: AppStateService | null;
  private readonly _audioService: AudioService | null;

  private _isUserDragging: boolean = false;

  /**
   * Initializes the controller with the necessary dependencies.
   *
   * @param dependencies - Object containing DOM elements and services.
   */
  public constructor(dependencies: BenchmarkScrollDependencies) {
    this._scrollContainer = dependencies.scrollContainer;
    this._scrollThumb = dependencies.scrollThumb;
    this._hoverContainer = dependencies.hoverContainer;
    this._appStateService = dependencies.appStateService ?? null;
    this._audioService = dependencies.audioService ?? null;
  }

  /**
   * Attaches event listeners and performs the initial synchronization.
   */
  public initialize(): void {
    this._setupScrollSynchronization();
    this._setupDragInteraction();
    this._setupHoverAutoScroll();
    this._setupManualScrollDetection();

    requestAnimationFrame((): void => {
      this._synchronizeThumbPosition();
    });
  }

  private _setupScrollSynchronization(): void {
    this._scrollContainer.addEventListener("scroll", (): void => {
      this._synchronizeThumbPosition();
      this._persistScrollPosition();
    });
  }

  private _persistScrollPosition(): void {
    if (this._appStateService) {
      this._appStateService.setBenchmarkScrollTop(
        this._scrollContainer.scrollTop,
      );
    }
  }

  private _synchronizeThumbPosition(): void {
    const scrollHeight: number = this._scrollContainer.scrollHeight;
    const clientHeight: number = this._scrollContainer.clientHeight;
    const totalScrollRange: number = scrollHeight - clientHeight;

    if (totalScrollRange <= 0) {
      this._scrollThumb.style.display = "none";

      return;
    }

    this._scrollThumb.style.display = "block";
    this._applyThumbTranslation(totalScrollRange);
  }

  private _applyThumbTranslation(totalScrollRange: number): void {
    const availableTrackSpan: number = this._getAvailableTrackSpan();

    const scrollPercentageRatio: number =
      this._scrollContainer.scrollTop / totalScrollRange;
    const verticalTranslation: number =
      scrollPercentageRatio * availableTrackSpan;

    this._scrollThumb.style.transform = `translateY(${verticalTranslation}px)`;
  }

  private _setupDragInteraction(): void {
    this._hoverContainer.addEventListener(
      "mousedown",
      (event: MouseEvent): void => {
        this._handleTrackMousedown(event);
      },
    );

    window.addEventListener("mousemove", (event: MouseEvent): void => {
      this._handleGlobalMouseMove(event);
    });

    window.addEventListener("mouseup", (): void => {
      this._handleDragEnd();
    });
  }

  private _handleTrackMousedown(event: MouseEvent): void {
    if (!this._isClippingToTrack(event.clientX)) {
      return;
    }

    this._isUserDragging = true;
    this._scrollThumb.classList.add("dragging");
    this._updateScrollFromMousePosition(event.clientY);

    if (this._appStateService) {
      this._appStateService.setFocusedScenarioName(null);
    }

    event.preventDefault();
  }

  private _handleGlobalMouseMove(event: MouseEvent): void {
    if (!this._isUserDragging) {
      return;
    }

    this._updateScrollFromMousePosition(event.clientY);
  }

  private _handleDragEnd(): void {
    if (this._isUserDragging) {
      this._scrollThumb.classList.remove("dragging");
    }
    this._isUserDragging = false;
  }

  private _updateScrollFromMousePosition(mouseY: number): void {
    const totalScrollRange: number = this._getTotalScrollRange();
    const availableTrackSpan: number = this._getAvailableTrackSpan();

    if (availableTrackSpan <= 0) {
      return;
    }

    const verticalTranslation: number =
      this._calculateDesiredTranslation(mouseY);
    const scrollPercentage: number = verticalTranslation / availableTrackSpan;

    this._scrollContainer.scrollTop = scrollPercentage * totalScrollRange;
  }

  private _setupHoverAutoScroll(): void {
    this._hoverContainer.addEventListener(
      "mousemove",
      (event: MouseEvent): void => {
        this._evaluateHoverScrolling(event);
      },
    );

    this._hoverContainer.addEventListener("mouseleave", (): void => {
      this._hoverContainer.style.cursor = "";
    });
  }

  private _setupManualScrollDetection(): void {
    this._scrollContainer.addEventListener(
      "wheel",
      (): void => {
        if (this._appStateService) {
          this._appStateService.setFocusedScenarioName(null);
        }
      },
      { passive: true },
    );
  }

  private _evaluateHoverScrolling(event: MouseEvent): void {
    if (this._isUserDragging || event.buttons !== 0) {
      return;
    }

    const thumbRectangle: DOMRect = this._scrollThumb.getBoundingClientRect();
    const hitboxExtension: number = thumbRectangle.height * 0.1;

    const isInsideHorizontally: boolean =
      event.clientX >= thumbRectangle.left &&
      event.clientX <= thumbRectangle.right;

    this._hoverContainer.style.cursor = isInsideHorizontally ? "pointer" : "";

    const isInsideVertically: boolean =
      event.clientY >= thumbRectangle.top - hitboxExtension &&
      event.clientY <= thumbRectangle.bottom + hitboxExtension;

    if (!isInsideHorizontally || !isInsideVertically) {
      return;
    }

    this._determineAutoScrollDirection(event, thumbRectangle);
  }

  private _determineAutoScrollDirection(
    event: MouseEvent,
    thumbRectangle: DOMRect,
  ): void {
    const pixelDelta: number = this._calculateHoverDelta(
      event.clientY,
      thumbRectangle,
    );

    if (pixelDelta === 0) {
      return;
    }

    this._applyHoverScroll(pixelDelta);
  }


  private _calculateTrackPadding(): number {
    const rootStyles: CSSStyleDeclaration = getComputedStyle(
      document.documentElement,
    );

    const remSizePixels: number = parseFloat(rootStyles.fontSize);
    const marginSpacingMultiplier: number = parseFloat(
      rootStyles.getPropertyValue("--margin-spacing-multiplier") || "1",
    );

    const totalPaddingRems: number = 3;

    return remSizePixels * totalPaddingRems * marginSpacingMultiplier;
  }

  private _calculateDesiredTranslation(mouseY: number): number {
    const hoverRect: DOMRect = this._hoverContainer.getBoundingClientRect();
    const trackPadding: number = this._calculateTrackPadding();
    const trackTop: number = hoverRect.top + trackPadding / 2;
    const thumbHeight: number = this._getThumbHeight();

    const desiredCenter: number = mouseY - trackTop;
    const translation: number = desiredCenter - thumbHeight / 2;

    return Math.max(0, Math.min(translation, this._getAvailableTrackSpan()));
  }

  private _calculateHoverDelta(mouseY: number, thumbRect: DOMRect): number {
    if (mouseY < thumbRect.top) {
      return mouseY - thumbRect.top;
    }

    if (mouseY > thumbRect.bottom) {
      return mouseY - thumbRect.bottom;
    }

    return 0;
  }

  private _applyHoverScroll(pixelDelta: number): void {
    const totalScrollRange: number = this._getTotalScrollRange();
    const availableTrackSpan: number = this._getAvailableTrackSpan();

    if (availableTrackSpan <= 0) {
      return;
    }

    const scrollUnitsPerPixel: number = totalScrollRange / availableTrackSpan;
    const oldScrollTop = this._scrollContainer.scrollTop;
    this._scrollContainer.scrollTop += pixelDelta * scrollUnitsPerPixel;

    if (
      this._audioService &&
      this._scrollContainer.scrollTop !== oldScrollTop
    ) {
      this._playThrottledLightSound();
    }

    if (this._appStateService) {
      this._appStateService.setFocusedScenarioName(null);
    }
  }

  private _playThrottledLightSound(): void {
    this._audioService?.playLight(0.4);
  }

  private _isClippingToTrack(clientX: number): boolean {
    const thumbRectangle: DOMRect = this._scrollThumb.getBoundingClientRect();

    return clientX >= thumbRectangle.left && clientX <= thumbRectangle.right;
  }

  private _getAvailableTrackSpan(): number {
    const trackPadding: number = this._calculateTrackPadding();
    const trackHeightLimit: number =
      this._hoverContainer.clientHeight - trackPadding;
    const thumbHeight: number = this._getThumbHeight();

    return trackHeightLimit - thumbHeight;
  }

  private _getThumbHeight(): number {
    return (
      this._scrollThumb.getBoundingClientRect().height ||
      this._calculateTrackPadding()
    );
  }

  private _getTotalScrollRange(): number {
    return (
      this._scrollContainer.scrollHeight - this._scrollContainer.clientHeight
    );
  }
}
