import { BenchmarkScenario, DifficultyTier } from "../../data/benchmarks";

/**
 * Configuration for the RankPopupComponent.
 */
export interface RankPopupConfig {
  readonly difficulty: DifficultyTier;
  readonly scenarios: BenchmarkScenario[];
  readonly rankNames: string[];
  readonly anchorElement: HTMLElement;
  readonly onDismiss: () => void;
}

/**
 * Component that renders a simplified popup showing rank order for a specific difficulty.
 *
 * It appears as a singular glass pane with the difficulty as a title and
 * the ranks listed with separators, without complex sub-styling or hover effects.
 */
export class RankPopupComponent {
  private readonly _config: RankPopupConfig;

  private _containerElement: HTMLElement | null = null;

  private _overlayElement: HTMLElement | null = null;

  private _bridgeElement: HTMLElement | null = null;

  private _mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * Initializes the popup with required data and anchor.
   *
   * @param config - The popup configuration.
   */
  public constructor(config: RankPopupConfig) {
    this._config = config;
  }

  /**
   * Renders the popup into the document body.
   */
  public render(): void {
    this._overlayElement = this._createOverlay();
    this._containerElement = this._createPopupContainer();
    this._bridgeElement = this._createHoverBridge();

    this._overlayElement.appendChild(this._containerElement);
    this._overlayElement.appendChild(this._bridgeElement);
    document.body.appendChild(this._overlayElement);
    document.body.classList.add("has-rank-popup");
    this._config.anchorElement.classList.add("active-popup");

    this._positionPopup();
    this._setupMouseTracking();
    this._setupOverlayClip();

    requestAnimationFrame((): void => {
      requestAnimationFrame((): void => {
        this._overlayElement?.classList.add("active");
      });
    });
  }

  /**
   * Removes the popup from the DOM.
   */
  public destroy(): void {
    if (this._mouseMoveHandler) {
      window.removeEventListener("mousemove", this._mouseMoveHandler);
      this._mouseMoveHandler = null;
    }

    if (this._overlayElement) {
      this._overlayElement.remove();
      document.body.classList.remove("has-rank-popup");
      this._config.anchorElement.classList.remove("active-popup");
      this._resizeObserver?.disconnect();
      this._resizeObserver = null;
      this._overlayElement = null;
      this._containerElement = null;
      this._bridgeElement = null;
    }
  }

  private _createOverlay(): HTMLElement {
    const overlay: HTMLDivElement = document.createElement("div");

    overlay.className = "rank-popup-overlay";

    overlay.addEventListener("click", (event: MouseEvent): void => {
      if (event.target === overlay) {
        this._config.onDismiss();
      }
    });

    return overlay;
  }

  private _createPopupContainer(): HTMLElement {
    const container: HTMLDivElement = document.createElement("div");

    container.className = "rank-popup-container";

    const list: HTMLDivElement = document.createElement("div");
    list.className = "rank-popup-list";

    this._config.rankNames.forEach((rankName: string, index: number): void => {
      if (index > 0) {
        list.appendChild(this._createSeparatorCaret());
      }
      list.appendChild(this._createRankText(rankName));
    });

    container.appendChild(list);

    return container;
  }

  private _createRankText(name: string): HTMLElement {
    const text: HTMLDivElement = document.createElement("div");

    text.className = "rank-popup-rank-text";
    text.textContent = name;

    return text;
  }

  private _createHoverBridge(): HTMLElement {
    const bridge: HTMLDivElement = document.createElement("div");

    bridge.className = "hover-bridge";

    return bridge;
  }

  private _createSeparatorCaret(): HTMLElement {
    const caret: HTMLDivElement = document.createElement("div");

    caret.className = "rank-popup-separator";
    caret.innerHTML = `
      <svg viewBox="0 0 24 24" width="10" height="10" style="opacity: 0.4;">
        <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    return caret;
  }

  private _positionPopup(): void {
    if (!this._containerElement) return;

    const anchorRect: DOMRect =
      this._config.anchorElement.getBoundingClientRect();

    const popupWidth: number = this._containerElement.offsetWidth || 180;
    const centerX: number = anchorRect.left + anchorRect.width / 2;
    const left: number = centerX - popupWidth / 2;
    const top: number = anchorRect.bottom - 2;

    this._containerElement.style.left = `${this._clamp(left, 20, window.innerWidth - popupWidth - 20)}px`;
    this._containerElement.style.top = `${top}px`;

    if (this._bridgeElement) {
      this._bridgeElement.style.left = `${anchorRect.left}px`;
      this._bridgeElement.style.top = `${anchorRect.top}px`;
      this._bridgeElement.style.width = `${anchorRect.width}px`;
      this._bridgeElement.style.height = `${anchorRect.height + 20}px`;
    }

    this._updateOverlayClip();
  }

  private _setupOverlayClip(): void {
    if (!this._overlayElement) return;

    this._resizeObserver = new ResizeObserver((): void => {
      this._positionPopup();
    });

    this._resizeObserver.observe(this._config.anchorElement);
    this._resizeObserver.observe(document.body);
  }

  private _updateOverlayClip(): void {
    if (!this._overlayElement) return;

    const anchorRect: DOMRect =
      this._config.anchorElement.getBoundingClientRect();

    const top: number = anchorRect.top;
    const left: number = anchorRect.left;
    const right: number = anchorRect.right;
    const bottom: number = anchorRect.bottom;

    this._overlayElement.style.clipPath = `polygon(
      0vw 0vh,
      0vw 100vh,
      ${left}px 100vh,
      ${left}px ${top}px,
      ${right}px ${top}px,
      ${right}px ${bottom}px,
      ${left}px ${bottom}px,
      ${left}px 100vh,
      100vw 100vh,
      100vw 0vh
    )`;
  }

  private _setupMouseTracking(): void {
    this._mouseMoveHandler = (event: MouseEvent): void => {
      if (!this._containerElement) return;

      const elements: Element[] = document.elementsFromPoint(
        event.clientX,
        event.clientY,
      );

      const isOverPopup: boolean = elements.some((element: Element): boolean =>
        this._containerElement!.contains(element),
      );
      const isOverAnchor: boolean = elements.some((element: Element): boolean =>
        this._config.anchorElement.contains(element),
      );
      const isOverBridge: boolean = elements.some(
        (element: Element): boolean =>
          this._bridgeElement?.contains(element) ?? false,
      );

      if (!isOverPopup && !isOverAnchor && !isOverBridge) {
        this._config.onDismiss();
      }
    };

    window.addEventListener("mousemove", this._mouseMoveHandler);
  }

  private _clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
