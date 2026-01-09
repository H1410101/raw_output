import { AppStateService } from "../../services/AppStateService";

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
  private readonly _appStateService: AppStateService;

  private _autoScrollTimer: number | null = null;
  private _activeScrollDirection: number = 0;
  private _isUserDragging: boolean = false;
  private _dragStartMouseY: number = 0;
  private _dragStartScrollTop: number = 0;

  /**
   * Initializes the controller with the necessary DOM elements.
   *
   * @param scrollContainer - The scrollable area.
   * @param scrollThumb - The custom thumb element to be translated.
   * @param hoverContainer - The container used for hover-detection (auto-scroll).
   * @param appStateService - Service for persisting UI state.
   */
  public constructor(
    scrollContainer: HTMLElement,
    scrollThumb: HTMLElement,
    hoverContainer: HTMLElement,
    appStateService: AppStateService,
  ) {
    this._scrollContainer = scrollContainer;
    this._scrollThumb = scrollThumb;
    this._hoverContainer = hoverContainer;
    this._appStateService = appStateService;
  }

  /**
   * Attaches event listeners and performs the initial synchronization.
   */
  public initialize(): void {
    this._setupScrollSynchronization();
    this._setupDragInteraction();
    this._setupHoverAutoScroll();

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
    this._appStateService.setBenchmarkScrollTop(this._scrollContainer.scrollTop);
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
    const trackPadding: number = 32;
    const trackHeightLimit: number =
      this._scrollContainer.clientHeight - trackPadding;
    const thumbElementHeight: number =
      this._scrollThumb.offsetHeight || trackPadding;
    const availableTrackSpan: number = trackHeightLimit - thumbElementHeight;

    const scrollPercentageRatio: number =
      this._scrollContainer.scrollTop / totalScrollRange;
    const verticalTranslation: number =
      scrollPercentageRatio * availableTrackSpan;

    this._scrollThumb.style.transform = `translateY(${verticalTranslation}px)`;
  }

  private _setupDragInteraction(): void {
    this._scrollThumb.addEventListener("mousedown", (event: MouseEvent): void => {
      this._handleDragStart(event);
    });

    window.addEventListener("mousemove", (event: MouseEvent): void => {
      this._handleGlobalMouseMove(event);
    });

    window.addEventListener("mouseup", (): void => {
      this._handleDragEnd();
    });
  }

  private _handleDragStart(event: MouseEvent): void {
    this._isUserDragging = true;
    this._dragStartMouseY = event.clientY;
    this._dragStartScrollTop = this._scrollContainer.scrollTop;

    this._stopAutoScrollLoop();
    event.preventDefault();
    event.stopPropagation();
  }

  private _handleGlobalMouseMove(event: MouseEvent): void {
    if (!this._isUserDragging) {
      return;
    }

    const mouseDeltaY: number = event.clientY - this._dragStartMouseY;
    const scrollHeight: number = this._scrollContainer.scrollHeight;
    const clientHeight: number = this._scrollContainer.clientHeight;
    const totalScrollRange: number = scrollHeight - clientHeight;

    this._updateScrollTopFromDrag(mouseDeltaY, totalScrollRange);
  }

  private _updateScrollTopFromDrag(
    mouseDeltaY: number,
    totalScrollRange: number,
  ): void {
    const trackPadding: number = 32;
    const trackHeightLimit: number =
      this._scrollContainer.clientHeight - trackPadding;
    const thumbElementHeight: number =
      this._scrollThumb.offsetHeight || trackPadding;
    const availableTrackSpan: number = trackHeightLimit - thumbElementHeight;

    if (availableTrackSpan <= 0) {
      return;
    }

    const scrollUnitsPerPixel: number = totalScrollRange / availableTrackSpan;
    this._scrollContainer.scrollTop =
      this._dragStartScrollTop + mouseDeltaY * scrollUnitsPerPixel;
  }

  private _handleDragEnd(): void {
    this._isUserDragging = false;
  }

  private _setupHoverAutoScroll(): void {
    this._hoverContainer.addEventListener("mousemove", (event: MouseEvent): void => {
      this._evaluateHoverScrolling(event);
    });

    this._hoverContainer.addEventListener("mouseleave", (): void => {
      this._stopAutoScrollLoop();
    });
  }

  private _evaluateHoverScrolling(event: MouseEvent): void {
    if (this._isUserDragging || event.buttons !== 0) {
      this._stopAutoScrollLoop();

      return;
    }

    const thumbRectangle: DOMRect = this._scrollThumb.getBoundingClientRect();
    const isInsideHorizontally: boolean =
      event.clientX >= thumbRectangle.left && event.clientX <= thumbRectangle.right;
    const isInsideVertically: boolean =
      event.clientY >= thumbRectangle.top && event.clientY <= thumbRectangle.bottom;

    if (!isInsideHorizontally || !isInsideVertically) {
      this._stopAutoScrollLoop();

      return;
    }

    this._determineAutoScrollDirection(event, thumbRectangle);
  }

  private _determineAutoScrollDirection(
    event: MouseEvent,
    thumbRectangle: DOMRect,
  ): void {
    const relativeYInThumb: number = event.clientY - thumbRectangle.top;
    const activationThreshold: number = thumbRectangle.height * 0.1;

    if (relativeYInThumb < activationThreshold) {
      this._startAutoScrollLoop(-1);

      return;
    }

    if (relativeYInThumb > thumbRectangle.height - activationThreshold) {
      this._startAutoScrollLoop(1);

      return;
    }

    this._stopAutoScrollLoop();
  }

  private _startAutoScrollLoop(direction: number): void {
    if (this._activeScrollDirection === direction) {
      return;
    }

    this._stopAutoScrollLoop();
    this._activeScrollDirection = direction;
    this._executeAutoScrollStep();
  }

  private _executeAutoScrollStep(): void {
    const scrollAnimationStep = (): void => {
      if (this._activeScrollDirection === 0) {
        return;
      }

      const scrollSpeed: number = 8;
      this._scrollContainer.scrollTop += this._activeScrollDirection * scrollSpeed;

      this._autoScrollTimer = requestAnimationFrame(scrollAnimationStep);
    };

    this._autoScrollTimer = requestAnimationFrame(scrollAnimationStep);
  }

  private _stopAutoScrollLoop(): void {
    if (this._autoScrollTimer !== null) {
      cancelAnimationFrame(this._autoScrollTimer);
      this._autoScrollTimer = null;
    }

    this._activeScrollDirection = 0;
  }
}
