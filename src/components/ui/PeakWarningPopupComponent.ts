import { AudioService } from "../../services/AudioService";
import { CosmeticOverrideService } from "../../services/CosmeticOverrideService";

/**
 * Component that renders a warning popup about peak benchmark difficulties and proof standards.
 * 
 * It follows the same aesthetic as the About popup to ensure visual consistency.
 */
export class PeakWarningPopupComponent {
    private readonly _closeCallbacks: (() => void)[] = [];
    private readonly _audioService: AudioService | null;
    private readonly _cosmeticOverrideService: CosmeticOverrideService;

    /** Active elements for each scroller container. */
    private readonly _activeScrollerElements: Map<HTMLElement, HTMLElement[]> = new Map();

    /** Animation frame request ID. */
    private _scrollerRequestId: number | null = null;

    /** Scrolling speed in pixels per second. */
    private readonly _scrollSpeed: number = 100;

    /**
     * Initializes the popup with required dependencies.
     *
     * @param audioService - Service for playing interaction sounds.
     * @param cosmeticOverrideService - Service for managing cosmetic overrides.
     */
    public constructor(audioService: AudioService | null, cosmeticOverrideService: CosmeticOverrideService) {
        this._audioService = audioService;
        this._cosmeticOverrideService = cosmeticOverrideService;
    }

    /**
     * Subscribes a callback to be called when the popup is closed.
     *
     * @param callback - Function to call on closure.
     */
    public subscribeToClose(callback: () => void): void {
        this._closeCallbacks.push(callback);
    }

    /**
     * Renders the popup into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard();

        const topScroller = this._createScroller("top");
        const bottomScroller = this._createScroller("bottom");

        container.appendChild(topScroller);
        container.appendChild(card);
        container.appendChild(bottomScroller);

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this._startScroller();
    }

    private _createOverlay(): HTMLElement {
        const overlay: HTMLDivElement = document.createElement("div");
        overlay.className = "settings-overlay";

        overlay.addEventListener("click", (event: MouseEvent): void => {
            if (event.target === overlay) {
                if (this._scrollerRequestId !== null) {
                    cancelAnimationFrame(this._scrollerRequestId);
                }
                overlay.remove();
                this._closeCallbacks.forEach((callback): void => callback());
            }
        });

        return overlay;
    }

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container peak-warning-container no-track";

        return container;
    }

    private _close(): void {
        const overlay = document.querySelector(".settings-overlay");
        if (overlay) {
            if (this._scrollerRequestId !== null) {
                cancelAnimationFrame(this._scrollerRequestId);
            }
            overlay.remove();
            this._closeCallbacks.forEach((callback): void => callback());
        }
    }

    private _createCard(): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card peak-warning-card";

        card.appendChild(this._createContentSection());

        return card;
    }


    private _createContentSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";
        section.style.alignItems = "center";

        this._appendWarningParagraphs(section);
        section.appendChild(this._createBeBetterButton());

        return section;
    }

    private _appendWarningParagraphs(container: HTMLElement): void {
        const introParagraph: HTMLParagraphElement = document.createElement("p");
        introParagraph.style.fontWeight = "600";
        introParagraph.style.color = "var(--upper-band-3)";
        introParagraph.innerHTML = "Being WOOL in just one scenario is usually top 1.5k in the world.<br>Being LINEN puts you well above top 1k.";
        container.appendChild(introParagraph);

        const proofStandardsParagraph: HTMLParagraphElement = document.createElement("p");
        proofStandardsParagraph.style.fontWeight = "700";
        proofStandardsParagraph.style.color = "var(--lower-band-3)";
        proofStandardsParagraph.innerHTML = "As of writing, the aim community<br>DOES NOT HAVE SUFFICIENTLY HIGH PROOF STANDARDS.";
        container.appendChild(proofStandardsParagraph);

        const transparencyParagraph: HTMLParagraphElement = document.createElement("p");
        transparencyParagraph.textContent = "Raw Output pulls scores from Kovaaks, and unfortunately such scores can currently be cheated.";
        container.appendChild(transparencyParagraph);
    }

    private _createBeBetterButton(): HTMLElement {
        const button: HTMLButtonElement = document.createElement("button");
        button.className = "about-link-button";
        button.style.marginTop = "0";
        button.style.height = "auto";
        button.style.padding = "0.75rem 1.5rem";
        button.style.lineHeight = "1.2";
        button.innerHTML = "BE BETTER THAN EVERYONE ELSE<br>(for a while)";
        button.addEventListener("click", () => {
            if (this._audioService) {
                this._audioService.playHeavy(0.4);
            }
            this._cosmeticOverrideService.activate();
            this._close();
        });

        return button;
    }

    private _createScroller(side: "top" | "bottom"): HTMLElement {
        const container = document.createElement("div");
        container.className = `error-scrolling-text-container peak-warning-scroller peak-scroller-${side}`;

        this._activeScrollerElements.set(container, []);

        return container;
    }

    private _startScroller(): void {
        this._activeScrollerElements.forEach((_unused, element) => {
            this._preFillScroller(element, element.offsetWidth);
        });

        let lastTimestamp = performance.now();
        const animate = (timestamp: number): void => {
            const deltaTime = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            this._updateScrollers(deltaTime);
            this._scrollerRequestId = requestAnimationFrame(animate);
        };

        this._scrollerRequestId = requestAnimationFrame(animate);
    }

    private _preFillScroller(scrollerContainer: HTMLElement, scrollerWidth: number): void {
        const spawnX = scrollerWidth;

        let currentX = 0;
        while (currentX < spawnX) {
            const element = this._spawnScrollerElement(scrollerContainer, currentX);
            // Fallback to avoid infinite loop
            const width = element.offsetWidth || 100;
            currentX += width;
        }
    }

    private _updateScrollers(deltaTime: number): void {
        this._activeScrollerElements.forEach((elements, container) => {
            const bounds = this._getScrollerBounds(container.offsetWidth);

            this._moveElements(elements, deltaTime);
            this._despawnElements(elements);
            this._maybeSpawnElement(container, elements, bounds.spawnThreshold);
        });
    }

    private _getScrollerBounds(panelWidth: number): { deathThreshold: number; spawnThreshold: number } {
        return {
            deathThreshold: 0,
            spawnThreshold: panelWidth,
        };
    }

    private _moveElements(elements: HTMLElement[], deltaTime: number): void {
        elements.forEach((element) => {
            const currentX = parseFloat(element.dataset.x || "0");
            const nextX = currentX - this._scrollSpeed * deltaTime;

            element.dataset.x = nextX.toString();
            element.style.transform = `translateX(${nextX}px) translateY(-50%)`;
        });
    }

    private _despawnElements(elements: HTMLElement[]): void {
        if (elements.length === 0) return;

        const first = elements[0];
        const x = parseFloat(first.dataset.x || "0");
        const width = first.offsetWidth;

        // Despawn when the right edge (x + width) is past the left boundary (0)
        if (x + width < 0) {
            first.remove();
            elements.shift();
        }
    }

    private _maybeSpawnElement(container: HTMLElement, elements: HTMLElement[], spawnX: number): void {
        const last = elements[elements.length - 1];
        let shouldSpawn = !last;

        if (last) {
            const leftX = parseFloat(last.dataset.x || "0");
            const width = last.offsetWidth;
            const rightX = leftX + width;
            shouldSpawn = rightX <= spawnX;
        }

        if (shouldSpawn) {
            const entryX = last
                ? parseFloat(last.dataset.x || "0") + last.offsetWidth
                : spawnX;

            this._spawnScrollerElement(container, entryX);
        }
    }

    private _spawnScrollerElement(container: HTMLElement, leftX: number): HTMLElement {
        const element = document.createElement("div");
        element.className = "error-scrolling-text peak-warning-scroller-text";
        element.textContent = "DO NOT TRUST SCREENSHOTS. DO NOT TRUST CLAIMS. THIS WEBSITE IS NOT PROOF.";

        container.appendChild(element);

        element.dataset.x = leftX.toString();
        element.style.transform = `translateX(${leftX}px) translateY(-50%)`;

        const elements = this._activeScrollerElements.get(container)!;
        elements.push(element);

        return element;
    }
}
