
/**
 * Component that renders a popup for a rank element, providing a vertical list of possible ranks.
 */
export class RankPopupComponent {
    private readonly _target: HTMLElement;
    private readonly _currentRankName: string;
    private readonly _allRanks: string[];
    private readonly _closeCallbacks: (() => void)[] = [];

    /**
     * Creates a new RankPopupComponent instance.
     * 
     * @param target The element to anchor the popup to.
     * @param currentRankName The name of the currently selected rank.
     * @param allRanks The list of all available ranks to display.
     */
    public constructor(
        target: HTMLElement,
        currentRankName: string,
        allRanks: string[]
    ) {
        this._target = target;
        this._currentRankName = currentRankName;
        this._allRanks = allRanks;
    }

    /**
     * Subscribes a callback function to be executed when the popup is closed.
     * 
     * @param callback The function to invoke on closure.
     */
    public subscribeToClose(callback: () => void): void {
        this._closeCallbacks.push(callback);
    }

    /**
     * Renders the popup into the document body and initiates positioning logic.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const popup: HTMLElement = this._createPopup();

        const glassPane = popup.querySelector('.settings-menu-container') as HTMLElement;

        if (glassPane) {
            glassPane.style.opacity = '0';
        }

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        this._adjustPosition(glassPane);
    }

    private _adjustPosition(glassPane: HTMLElement | null): void {
        if (!glassPane) {
            return;
        }

        const aboveSection = glassPane.querySelector('.rank-section-above') as HTMLElement;
        const belowSection = glassPane.querySelector('.rank-section-below') as HTMLElement;

        if (aboveSection && belowSection) {
            const hAbove = aboveSection.offsetHeight;
            const hBelow = belowSection.offsetHeight;
            const shiftY = (hBelow - hAbove) * 0.5;

            glassPane.style.top = `${shiftY}px`;
        }

        glassPane.style.opacity = '1';
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
        const anchor: HTMLDivElement = this._createAnchor();
        const glassPane: HTMLDivElement = this._createGlassPane();

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

        anchor.style.display = "flex";
        anchor.style.alignItems = "center";
        anchor.style.justifyContent = "center";

        anchor.style.pointerEvents = "none";

        return anchor;
    }

    private _createGlassPane(): HTMLDivElement {
        const glassPane: HTMLDivElement = document.createElement("div");
        glassPane.className = "settings-menu-container rank-popup-pane";

        this._applyBaseStyles(glassPane);
        this._applyLayoutStyles(glassPane);

        const { above, below } = this._splitRanks();
        const visible = this._calculateVisibleRanks(above, below);

        const aboveSection = this._createRankSection("rank-section-above", visible.showAbove, visible.hasMoreAbove, true);
        const currentItem = this._createCurrentRankItem();
        const belowSection = this._createRankSection("rank-section-below", visible.showBelow, visible.hasMoreBelow, false);

        glassPane.appendChild(aboveSection);
        glassPane.appendChild(currentItem);
        glassPane.appendChild(belowSection);

        return glassPane;
    }

    private _applyBaseStyles(element: HTMLElement): void {
        element.style.position = "relative";
        element.style.margin = "0";
        element.style.padding = "0.4rem 1rem";
        element.style.width = "auto";
        element.style.height = "auto";
        element.style.minHeight = "0";
        element.style.minWidth = "0";
        element.style.flexShrink = "0";
        element.style.pointerEvents = "auto";
        element.style.transition = "none";
    }

    private _applyLayoutStyles(element: HTMLElement): void {
        element.style.display = "flex";
        element.style.flexDirection = "column";
        element.style.alignItems = "center";
        element.style.gap = "0";
    }

    private _calculateVisibleRanks(above: string[], below: string[]): { showAbove: string[], showBelow: string[], hasMoreAbove: boolean, hasMoreBelow: boolean } {
        const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const unitHeightPx = 1.8 * remPx;

        const rect = this._target.getBoundingClientRect();
        const distTop = rect.top;
        const distBottom = window.innerHeight - rect.bottom;

        const buffer = 10;
        const maxAbove = Math.max(0, Math.floor((distTop - buffer) / unitHeightPx));
        const maxBelow = Math.max(0, Math.floor((distBottom - buffer) / unitHeightPx));

        return {
            showAbove: above.slice(0, maxAbove),
            showBelow: below.slice(-maxBelow),
            hasMoreAbove: above.length > maxAbove,
            hasMoreBelow: below.length > maxBelow
        };
    }

    private _createRankSection(className: string, ranks: string[], hasOverflow: boolean, isAbove: boolean): HTMLElement {
        const section = document.createElement("div");
        section.className = className;
        section.style.display = "flex";
        section.style.flexDirection = "column";
        section.style.alignItems = "center";

        if (isAbove && hasOverflow) {
            section.appendChild(this._createCaret(true));
        }

        const items = [...ranks].reverse();
        items.forEach(rank => {
            if (isAbove) {
                section.appendChild(this._createRankItem(rank, false));
                section.appendChild(this._createCaret(true));
            } else {
                section.appendChild(this._createCaret(false));
                section.appendChild(this._createRankItem(rank, false));
            }
        });

        if (!isAbove && hasOverflow) {
            section.appendChild(this._createCaret(false));
        }

        return section;
    }

    private _createCurrentRankItem(): HTMLElement {
        const computedStyle = window.getComputedStyle(this._target);

        return this._createRankItem(this._currentRankName, true, computedStyle);
    }

    private _splitRanks(): { above: string[], below: string[] } {
        const index = this._allRanks.indexOf(this._currentRankName);
        if (index === -1) {
            if (this._currentRankName === "Unranked") {
                return { above: [...this._allRanks], below: [] };
            }

            return { above: [], below: [] };
        }

        return {
            below: this._allRanks.slice(0, index),
            above: this._allRanks.slice(index + 1)
        };
    }

    private _createCaret(isUp: boolean): HTMLElement {
        const div = document.createElement("div");
        div.className = "rank-caret";
        div.style.flex = "none";
        div.style.width = "0.6rem";
        div.style.height = "0.2rem";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";
        div.style.margin = "0.05rem 0";

        const chevron = this._createChevronElement(isUp);
        div.appendChild(chevron);

        return div;
    }

    private _createChevronElement(isUp: boolean): HTMLElement {
        const chevron = document.createElement("div");
        chevron.style.width = "0.2rem";
        chevron.style.height = "0.2rem";

        const color = "var(--text-dim)";
        chevron.style.borderTop = `1px solid ${color}`;
        chevron.style.borderRight = `1px solid ${color}`;
        chevron.style.opacity = "0.5";
        chevron.style.transform = isUp
            ? "rotate(-45deg) translateY(1px)"
            : "rotate(135deg) translateY(1px)";

        return chevron;
    }

    private _createRankItem(rank: string, isCurrent: boolean, computedStyle?: CSSStyleDeclaration): HTMLSpanElement {
        const text: HTMLSpanElement = document.createElement("span");
        text.className = isCurrent ? "rank-name current" : "rank-name dim";
        text.textContent = rank;
        text.style.flex = "none";
        text.style.textAlign = "center";
        text.style.whiteSpace = "nowrap";

        if (isCurrent && computedStyle) {
            this._syncFontStyles(text, computedStyle);
            text.style.color = "var(--accent-color)";
            text.style.padding = "0";
            text.style.fontWeight = "500";
        } else {
            text.style.color = "var(--text-dim)";
            text.style.fontSize = "0.9rem";
            text.style.padding = "0";
            text.style.fontWeight = "500";
            text.style.textTransform = "uppercase";
        }

        return text;
    }

    private _syncFontStyles(text: HTMLSpanElement, computedStyle: CSSStyleDeclaration): void {
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
