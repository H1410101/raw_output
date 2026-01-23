
/**
 * Component that renders a popup for a rank element, providing a vertical list of possible ranks.
 */
export class RankPopupComponent {
    private readonly _target: HTMLElement;
    private readonly _currentRankName: string;
    private readonly _allRanks: string[];
    private readonly _closeCallbacks: (() => void)[] = [];
    private _rankHeight: number = 0;
    private _caretHeight: number = 0;
    private _aboveRanks: string[] = [];
    private _belowRanks: string[] = [];
    private _visibleAboveCount: number = 0;
    private _visibleBelowCount: number = 0;
    private _glassPane: HTMLElement | null = null;
    private _lastWheelTime: number = 0;
    private _scrollAccumulator: number = 0;
    private readonly _scrollThreshold: number = 100;

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
        this._measureHeights();

        const overlay: HTMLElement = this._createOverlay();
        const popup: HTMLElement = this._createPopup();
        const glassPane = popup.querySelector(".settings-menu-container") as HTMLElement;

        if (glassPane) {
            glassPane.style.opacity = "0";
        }

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        this._adjustPosition(glassPane);
        this._setupWheelListener();
    }

    private _measureHeights(): void {
        const dummy = document.createElement("div");
        this._setupDummyContainer(dummy);

        const label = this._createRankItem("DUMMY", false);
        const caret = this._createCaret();

        dummy.appendChild(label);
        dummy.appendChild(caret);
        document.body.appendChild(dummy);

        this._rankHeight = label.getBoundingClientRect().height;
        this._caretHeight = caret.getBoundingClientRect().height;

        document.body.removeChild(dummy);
    }

    private _setupDummyContainer(dummy: HTMLDivElement): void {
        dummy.style.position = "absolute";
        dummy.style.visibility = "hidden";
        dummy.style.pointerEvents = "none";
        dummy.style.display = "flex";
        dummy.style.flexDirection = "column";
        dummy.style.alignItems = "center";
        dummy.style.gap = "0";
    }

    private _adjustPosition(glassPane: HTMLElement | null): void {
        if (!glassPane) {
            return;
        }

        const belowSection = glassPane.querySelector(".rank-section-below") as HTMLElement;
        const currentItem = glassPane.querySelector(".rank-name.current") as HTMLElement;

        if (currentItem && belowSection) {
            this._applyCalculatedShift(glassPane);
        }

        glassPane.style.opacity = "1";
    }

    private _applyCalculatedShift(glassPane: HTMLElement): void {
        const hasMoreBelow = this._belowRanks.length > this._visibleBelowCount;
        const caretCountBelow = this._visibleBelowCount + (hasMoreBelow ? 1 : 0);

        const totalRankHeight = this._visibleBelowCount * this._rankHeight;
        const totalCaretHeight = caretCountBelow * this._caretHeight;

        const style = window.getComputedStyle(glassPane);
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const borderBottomWidth = parseFloat(style.borderBottomWidth) || 0;

        const shiftY = paddingBottom + borderBottomWidth + totalRankHeight + totalCaretHeight;
        glassPane.style.top = `${shiftY}px`;
    }

    private _refreshContent(): void {
        if (!this._glassPane) {
            return;
        }

        while (this._glassPane.firstChild) {
            this._glassPane.removeChild(this._glassPane.firstChild);
        }

        this._populateContent();
        this._adjustPosition(this._glassPane);
    }

    private _populateContent(): void {
        if (!this._glassPane) {
            return;
        }

        const hasMoreAbove = this._aboveRanks.length > this._visibleAboveCount;
        const hasMoreBelow = this._belowRanks.length > this._visibleBelowCount;

        const showAbove = this._aboveRanks.slice(0, this._visibleAboveCount);
        const showBelow = this._visibleBelowCount > 0 ? this._belowRanks.slice(-this._visibleBelowCount) : [];

        const aboveSection = this._createRankSection("rank-section-above", showAbove, hasMoreAbove, true);
        const currentItem = this._createCurrentRankItem();
        const belowSection = this._createRankSection("rank-section-below", showBelow, hasMoreBelow, false);

        this._glassPane.appendChild(aboveSection);
        this._glassPane.appendChild(currentItem);
        this._glassPane.appendChild(belowSection);
    }

    private _setupWheelListener(): void {
        if (!this._glassPane) {
            return;
        }

        this._glassPane.addEventListener("wheel", (event: WheelEvent) => {
            this._handleWheel(event);
        }, { passive: false });
    }

    private _handleWheel(event: WheelEvent): void {
        const deltaY = event.deltaY;
        if (deltaY === 0) {
            return;
        }

        const now = Date.now();
        const timeElapsed = now - this._lastWheelTime;

        this._scrollAccumulator += deltaY;

        const thresholdExceeded = Math.abs(this._scrollAccumulator) >= this._scrollThreshold;
        const cooldownExpired = timeElapsed >= 50;

        if (thresholdExceeded || cooldownExpired) {
            const effectiveDelta = thresholdExceeded ? this._scrollAccumulator : deltaY;

            this._scrollAccumulator = 0;
            this._lastWheelTime = now;

            this._processWheelScroll(effectiveDelta, event);
        } else {
            event.preventDefault();
        }
    }

    private _processWheelScroll(deltaY: number, event: WheelEvent): void {
        const changed = this._calculateExpansion(deltaY);

        if (changed) {
            event.preventDefault();
            event.stopPropagation();
            this._refreshContent();
        }
    }

    private _calculateExpansion(deltaY: number): boolean {
        if (deltaY < 0) {
            return this._tryExpandUp();
        }

        return this._tryExpandDown();
    }

    private _tryExpandUp(): boolean {
        if (this._visibleAboveCount < this._aboveRanks.length) {
            this._visibleAboveCount++;
            this._visibleBelowCount++;

            return true;
        }

        return false;
    }

    private _tryExpandDown(): boolean {
        if (this._visibleBelowCount < this._belowRanks.length) {
            this._visibleBelowCount++;

            return true;
        }

        return false;
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
        anchor.style.alignItems = "flex-end";
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
        this._aboveRanks = above;
        this._belowRanks = below;

        const visible = this._calculateVisibleRanks(above, below);
        this._visibleAboveCount = visible.showAbove.length;
        this._visibleBelowCount = visible.showBelow.length;

        this._glassPane = glassPane;
        this._populateContent();

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
        const unitHeightPx = this._rankHeight + this._caretHeight;
        const rect = this._target.getBoundingClientRect();

        const distTop = rect.top;
        const distBottom = window.innerHeight - rect.bottom;

        const buffer = 10;
        const maxAbove = Math.max(0, Math.floor((distTop - buffer) / unitHeightPx) - 1);
        const maxBelow = Math.max(0, Math.floor((distBottom - buffer) / unitHeightPx) - 1);

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
        section.style.gap = "0";

        if (isAbove && hasOverflow) {
            section.appendChild(this._createCaret());
        }

        this._appendSectionItems(section, ranks, isAbove);

        if (!isAbove && hasOverflow) {
            section.appendChild(this._createCaret());
        }

        return section;
    }

    private _appendSectionItems(section: HTMLElement, ranks: string[], isAbove: boolean): void {
        const items = [...ranks].reverse();

        items.forEach(rank => {
            if (isAbove) {
                section.appendChild(this._createRankItem(rank, false));
                section.appendChild(this._createCaret());
            } else {
                section.appendChild(this._createCaret());
                section.appendChild(this._createRankItem(rank, false));
            }
        });
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

    private _createCaret(): HTMLElement {
        const div = document.createElement("div");

        div.className = "rank-caret";
        div.style.flex = "none";
        div.style.width = "0.6rem";
        div.style.height = "0.3rem";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";

        const chevron = this._createChevronElement();
        div.appendChild(chevron);

        return div;
    }

    private _createChevronElement(): HTMLElement {
        const chevron = document.createElement("div");

        chevron.style.width = "0.2rem";
        chevron.style.height = "0.2rem";
        chevron.style.borderTop = "1px solid var(--text-dim)";
        chevron.style.borderRight = "1px solid var(--text-dim)";
        chevron.style.opacity = "0.5";
        chevron.style.transform = "rotate(-45deg)";

        return chevron;
    }

    private _createRankItem(rank: string, isCurrent: boolean, computedStyle?: CSSStyleDeclaration): HTMLSpanElement {
        const text: HTMLSpanElement = document.createElement("span");

        text.className = isCurrent ? "rank-name current" : "rank-name dim";
        if (rank === "Unranked") {
            text.classList.add("unranked-text");
        }

        text.textContent = rank;
        text.style.flex = "none";
        text.style.textAlign = "center";
        text.style.whiteSpace = "nowrap";

        this._applyRankItemStyles(text, isCurrent, rank, computedStyle);

        return text;
    }

    private _applyRankItemStyles(text: HTMLSpanElement, isCurrent: boolean, rank: string, computedStyle?: CSSStyleDeclaration): void {
        if (isCurrent && computedStyle) {
            this._syncFontStyles(text, computedStyle);
            text.style.color = "var(--accent-color)";
            text.style.padding = "0";

            return;
        }

        text.style.color = "var(--text-dim)";
        text.style.fontSize = "0.9rem";
        text.style.padding = "0";
        text.style.fontWeight = rank === "Unranked" ? "400" : "500";
        text.style.textTransform = "uppercase";
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
