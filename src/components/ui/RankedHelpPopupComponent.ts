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
        card.appendChild(this._createQuirksSection());

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
            "Ranked Mode compiles scenarios into a playlist, balancing strong and weak scenarios using your existing rank estimates, as well as avoiding recently played scenarios.";

        section.appendChild(text);

        return section;
    }

    private _createMechanicsSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "How it works";

        section.appendChild(title);
        section.appendChild(this._createMechanicsList());

        return section;
    }

    private _createMechanicsList(): HTMLElement {
        const list: HTMLUListElement = this._createDefaultList();

        list.appendChild(this._createListItem("Click the play button on a blank ranked screen to start a ranked session"));
        list.appendChild(this._createListItem("When in a session, click the play button again to launch the scenario into Kovaak's."));
        list.appendChild(this._createListItem("After playing, your scores should appear on the timeline."));
        list.appendChild(this._createListItem("Navigate between scenarios in the playlist with the previous and next buttons."));

        return list;
    }

    private _createQuirksSection(): HTMLElement {
        const section: HTMLDivElement = document.createElement("div");
        section.className = "about-section";

        const title: HTMLHeadingElement = document.createElement("h3");
        title.textContent = "Note the following quirks:";

        section.appendChild(title);
        section.appendChild(this._createQuirksList());

        return section;
    }

    private _createQuirksList(): HTMLElement {
        const list: HTMLUListElement = this._createDefaultList();

        list.appendChild(this._createListItem("The next button brightens when you gain any rank rating. You are encouraged to try to achieve this, but note that the dimmed next button is functional anyway."));
        list.appendChild(this._createListItem("As of writing, Kovaak's does not handle launching scenarios robustly. Know that Kovaak's sometimes freezes and leaks memory when launching, but also note that I can't really do much about this. I recommend not spam-clicking the launch button, and ending task in task manager if Kovaak's is unresponsive."));
        list.appendChild(this._createListItem("Your new rank is halfway from your current rank to your third highest score in the session, to prevent fluke runs and make you prove your rank."));
        list.appendChild(this._createListItem("Rank rating decreases by a bit each day, but this should not be terribly notable unless you take a long hiatus. This is intentional; the rank attempts to reflect your actual skill level, and gaining initial ranks is always fast regardless."));

        return list;
    }

    private _createDefaultList(): HTMLUListElement {
        const list: HTMLUListElement = document.createElement("ul");
        list.style.margin = "0";
        list.style.paddingLeft = "1.5rem";
        list.style.color = "var(--text-dim)";
        list.style.fontSize = "calc(0.9rem * var(--scenario-font-multiplier))";

        return list;
    }

    private _createListItem(text: string): HTMLLIElement {
        const item: HTMLLIElement = document.createElement("li");
        item.textContent = text;
        item.style.marginBottom = "0.5rem";

        return item;
    }
}
