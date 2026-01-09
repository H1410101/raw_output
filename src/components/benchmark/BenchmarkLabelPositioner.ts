/**
 * Manages the "sticky" vertical alignment of labels within the benchmark table.
 *
 * Ensures that category and subcategory labels remain centered within the visible
 * portion of their respective tracks as the user scrolls.
 */
export class BenchmarkLabelPositioner {
  private readonly _scrollContainer: HTMLElement;
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * Initializes the positioner with the scrollable container.
   *
   * @param scrollContainer - The element whose scroll events will trigger re-positioning.
   */
  public constructor(scrollContainer: HTMLElement) {
    this._scrollContainer = scrollContainer;
  }

  /**
   * Attaches scroll listeners and performs the initial layout calculation.
   */
  public initialize(): void {
    this._scrollContainer.addEventListener("scroll", (): void => {
      this._updateAllLabelPositions();
    });

    this._setupResizeObservation();

    requestAnimationFrame((): void => {
      this._updateAllLabelPositions();
    });
  }

  /**
   * Disconnects observers and releases resources.
   */
  public destroy(): void {
    this._resizeObserver?.disconnect();
  }

  private _setupResizeObservation(): void {
    this._resizeObserver = new ResizeObserver((): void => {
      this._updateAllLabelPositions();
    });

    this._resizeObserver.observe(this._scrollContainer);
  }

  private _updateAllLabelPositions(): void {
    const labels: NodeListOf<HTMLElement> =
      this._scrollContainer.querySelectorAll(".vertical-text");
    const containerRectangle: DOMRect = this._scrollContainer.getBoundingClientRect();

    labels.forEach((label: HTMLElement): void => {
      this._updateSingleLabelPosition(label, containerRectangle);
    });
  }

  private _updateSingleLabelPosition(
    label: HTMLElement,
    containerRectangle: DOMRect,
  ): void {
    const labelTrack: HTMLElement | null = label.parentElement;
    if (!labelTrack) {
      return;
    }

    const trackRectangle: DOMRect = labelTrack.getBoundingClientRect();
    if (this._isTrackSmallerThanLabel(trackRectangle, label)) {
      this._centerLabelInTrack(label);

      return;
    }

    this._stickLabelToVisibleCenter(label, trackRectangle, containerRectangle);
  }

  private _isTrackSmallerThanLabel(
    trackRectangle: DOMRect,
    label: HTMLElement,
  ): boolean {
    return trackRectangle.height <= label.offsetHeight;
  }

  private _centerLabelInTrack(label: HTMLElement): void {
    label.style.top = "50%";
  }

  private _stickLabelToVisibleCenter(
    label: HTMLElement,
    trackRectangle: DOMRect,
    containerRectangle: DOMRect,
  ): void {
    const visibleTopEdge: number = Math.max(
      trackRectangle.top,
      containerRectangle.top,
    );
    const visibleBottomEdge: number = Math.min(
      trackRectangle.bottom,
      containerRectangle.bottom,
    );

    const visibleHeight: number = Math.max(0, visibleBottomEdge - visibleTopEdge);
    const visibleCenterY: number = visibleTopEdge + visibleHeight / 2;
    const relativeCenterInTrack: number = visibleCenterY - trackRectangle.top;

    this._applyClampedLabelPosition(label, relativeCenterInTrack, trackRectangle.height);
  }

  private _applyClampedLabelPosition(
    label: HTMLElement,
    targetYPosition: number,
    trackHeight: number,
  ): void {
    const labelHalfHeight: number = label.offsetHeight / 2;
    const minimumTopOffset: number = labelHalfHeight;
    const maximumTopOffset: number = trackHeight - labelHalfHeight;

    const clampedTopValue: number = Math.max(
      minimumTopOffset,
      Math.min(maximumTopOffset, targetYPosition),
    );

    label.style.top = `${clampedTopValue}px`;
  }
}
