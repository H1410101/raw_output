
/**
 * Component that renders a popup for the rank display.
 * It overlays exactly over the original rank display.
 */
export class RankPopupComponent {
    private readonly _target: HTMLElement;
    private readonly _rankName: string;
    private readonly _closeCallbacks: (() => void)[] = [];

    /**
     * Initializes the rank popup.
     *
     * @param target - The target element to overlay.
     * @param rankName - The text to display (rank name).
     */
    public constructor(
        target: HTMLElement,
        rankName: string
    ) {
        this._target = target;
        this._rankName = rankName;
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
        const popup: HTMLElement = this._createPopup();

        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }

    private _createOverlay(): HTMLElement {
        const overlay: HTMLDivElement = document.createElement("div");
        overlay.className = "settings-overlay";

        overlay.addEventListener("click", (event: MouseEvent): void => {
            if (event.target === overlay) {
                overlay.remove();
                this._closeCallbacks.forEach((callback): void => callback());
            }
        });

        return overlay;
    }

    private _createPopup(): HTMLElement {
        const computedStyle = window.getComputedStyle(this._target);

        // 1. ANCHOR: Invisible box matching the EXACT size and position of the target text.
        const anchor: HTMLDivElement = this._createAnchor();

        // 2. GLASS PANE: The visual popup. 
        const glassPane: HTMLDivElement = this._createGlassPane();

        // 3. TEXT
        const text: HTMLSpanElement = this._createRankText(computedStyle);

        glassPane.appendChild(text);
        anchor.appendChild(glassPane);

        return anchor;
    }

    private _createAnchor(): HTMLDivElement {
        const rect = this._target.getBoundingClientRect();
        const anchor: HTMLDivElement = document.createElement("div");
        anchor.style.position = "absolute";
        anchor.style.top = `${rect.top}px`;
        anchor.style.left = `${rect.left}px`;
        anchor.style.width = `${rect.width}px`;
        anchor.style.height = `${rect.height}px`;

        // Flexbox centering ensures the child (glass pane) expands evenly outwards.
        anchor.style.display = "flex";
        anchor.style.alignItems = "center";
        anchor.style.justifyContent = "center";

        // Let clicks pass through if missed (though overlay catches them)
        anchor.style.pointerEvents = "none";

        return anchor;
    }

    private _createGlassPane(): HTMLDivElement {
        const glassPane: HTMLDivElement = document.createElement("div");
        glassPane.className = "settings-menu-container";

        // Reset absolute positioning from previous implementation, let it flow in flex
        glassPane.style.position = "static";
        glassPane.style.margin = "0";
        // Apply the cheat padding: 0.4rem vertical, 1rem horizontal.
        glassPane.style.padding = "0.4rem 1rem";
        glassPane.style.width = "auto";
        glassPane.style.height = "auto";
        glassPane.style.minHeight = "0";
        glassPane.style.minWidth = "0";
        // Critical: prevents shrinking to fit the narrow anchor
        glassPane.style.flexShrink = "0";
        // Re-enable pointer events for the pane itself
        glassPane.style.pointerEvents = "auto";

        return glassPane;
    }

    private _createRankText(computedStyle: CSSStyleDeclaration): HTMLSpanElement {
        const text: HTMLSpanElement = document.createElement("span");
        text.className = "rank-name";
        text.textContent = this._rankName;
        text.style.flex = "none";
        text.style.textAlign = "center";

        // Prevent wrapping if width constraints appear
        text.style.whiteSpace = "nowrap";

        this._syncFontStyles(text, computedStyle);

        // Reset padding (original .rank-name has padding-right) to ensure perfect optical centering
        text.style.paddingRight = "0";

        return text;
    }

    private _syncFontStyles(text: HTMLSpanElement, computedStyle: CSSStyleDeclaration): void {
        text.style.color = computedStyle.color;
        text.style.fontFamily = computedStyle.fontFamily;
        text.style.fontSize = computedStyle.fontSize;
        text.style.fontWeight = computedStyle.fontWeight;
        text.style.letterSpacing = computedStyle.letterSpacing;
        text.style.lineHeight = computedStyle.lineHeight;
        text.style.textTransform = computedStyle.textTransform;
        text.style.fontStyle = computedStyle.fontStyle;
        text.style.textShadow = computedStyle.textShadow;
    }
}
