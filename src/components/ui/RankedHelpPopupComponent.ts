import { BenchmarkScrollController } from "../benchmark/BenchmarkScrollController";
import { AudioService } from "../../services/AudioService";

/**
 * Component that renders an information popup about the Ranked mode.
 */
export class RankedHelpPopupComponent {
    private readonly _closeCallbacks: (() => void)[] = [];
    private readonly _audioService: AudioService | null;

    /**
     * Initializes the ranked help popup.
     *
     * @param audioService - Service for playing interaction sounds.
     */
    public constructor(audioService: AudioService | null = null) {
        this._audioService = audioService;
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
     * Renders the help popup into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard();
        const thumb: HTMLElement = this._createScrollThumb();

        container.appendChild(card);
        container.appendChild(thumb);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this._initializeScrollController(card, thumb, container);
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

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container";

        return container;
    }

    private _createCard(): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card";

        card.appendChild(this._createMainTitle("Ranked Mode"));
        card.appendChild(this._createIntroSection());
        card.appendChild(this._createMechanicsSection());
        card.appendChild(this._createTipsSection());

        return card;
    }

    private _createScrollThumb(): HTMLElement {
        const thumb: HTMLDivElement = document.createElement("div");
        thumb.className = "custom-scroll-thumb";

        return thumb;
    }

    private _initializeScrollController(
        scrollArea: HTMLElement,
        thumb: HTMLElement,
        container: HTMLElement,
    ): void {
        const controller: BenchmarkScrollController = new BenchmarkScrollController({
            scrollContainer: scrollArea,
            scrollThumb: thumb,
            hoverContainer: container,
            appStateService: null,
            audioService: this._audioService,
        });

        controller.initialize();
    }

    private _createMainTitle(text: string): HTMLElement {
        const title: HTMLHeadingElement = document.createElement("h2");
        title.textContent = text;

        return title;
    }

    private _createIntroSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const text: HTMLParagraphElement = document.createElement("p");
        text.style.fontWeight = "600";
        text.style.color = "var(--upper-band-3)";
        text.textContent =
            "Ranked Mode is a structured way to play through benchmarks, offering a guided session that adapts to your performance.";

        section.appendChild(text);

        return section;
    }

    private _createMechanicsSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "How it Works";

        section.appendChild(title);
        section.appendChild(this._createMechanicsList());

        return section;
    }

    private _createMechanicsList(): HTMLElement {
        const list: HTMLUListElement = document.createElement("ul");
        list.style.margin = "0";
        list.style.paddingLeft = "1.5rem";
        list.style.color = "var(--text-dim)";
        list.style.fontSize = "calc(0.9rem * var(--scenario-font-multiplier))";

        list.appendChild(this._createListItem("Click 'Play Now' to launch the current scenario directly in KovaaK's."));
        list.appendChild(this._createListItem("After playing, your score is automatically recorded if you have the stats folder linked."));
        list.appendChild(this._createListItem("Use 'Next' to move to the next scenario in the sequence."));
        list.appendChild(this._createListItem("The session starts with a fixed set of scenarios, then unlocks 'Infinite Run' for continuous play."));

        return list;
    }

    private _createTipsSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Tips";

        section.appendChild(title);

        const tipsParagraph: HTMLParagraphElement = document.createElement("p");
        tipsParagraph.textContent = "Your rank estimate is updated in real-time as you play. Consistent performance across different scenarios is key to ranking up.";

        section.appendChild(tipsParagraph);

        return section;
    }

    private _createListItem(text: string): HTMLLIElement {
        const item: HTMLLIElement = document.createElement("li");
        item.textContent = text;
        item.style.marginBottom = "0.5rem";

        return item;
    }
}
