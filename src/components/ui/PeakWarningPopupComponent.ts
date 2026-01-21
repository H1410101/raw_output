import { AudioService } from "../../services/AudioService";

/**
 * Component that renders a warning popup about peak benchmark difficulties and proof standards.
 * 
 * It follows the same aesthetic as the About popup to ensure visual consistency.
 */
export class PeakWarningPopupComponent {
    private readonly _closeCallbacks: (() => void)[] = [];
    private readonly _audioService: AudioService | null;

    /**
     * Initializes the popup with an optional audio service for interactions.
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
     * Renders the popup into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard();

        container.appendChild(card);
        overlay.appendChild(container);
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

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container peak-warning-container no-track";

        return container;
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

        const introParagraph: HTMLParagraphElement = document.createElement("p");
        introParagraph.style.fontWeight = "600";
        introParagraph.style.color = "var(--upper-band-3)";
        introParagraph.innerHTML = "Being WOOL in just one scenario is usually top 1.5k in the world.<br>Being LINEN puts you well above top 1k.";
        section.appendChild(introParagraph);

        const proofStandardsParagraph: HTMLParagraphElement = document.createElement("p");
        proofStandardsParagraph.style.fontWeight = "700";
        proofStandardsParagraph.style.color = "var(--lower-band-3)";
        proofStandardsParagraph.innerHTML = "As of writing, the aim community<br>DOES NOT HAVE SUFFICIENTLY HIGH PROOF STANDARDS.";
        section.appendChild(proofStandardsParagraph);

        const transparencyParagraph: HTMLParagraphElement = document.createElement("p");
        transparencyParagraph.textContent = "Raw Output is a website that reads files from your computer. This can be easily cheated. I faked files while making this website for the sake of development.";
        section.appendChild(transparencyParagraph);

        const teaserButton: HTMLButtonElement = document.createElement("button");
        teaserButton.className = "about-link-button";
        teaserButton.style.marginTop = "0";
        teaserButton.style.height = "auto";
        teaserButton.style.padding = "0.75rem 1.5rem";
        teaserButton.style.lineHeight = "1.2";
        teaserButton.innerHTML = "BE BETTER THAN EVERYONE ELSE<br>(for a while)";
        section.appendChild(teaserButton);

        return section;
    }
}
