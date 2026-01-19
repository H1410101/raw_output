import { AudioService } from "../../services/AudioService";
import { IdentityService } from "../../services/IdentityService";

/**
 * Component that renders a popup asking for user consent to enable anonymous analytics.
 */
export class AnalyticsPopupComponent {
    private readonly _identityService: IdentityService;
    private readonly _audioService: AudioService | null;

    /**
     * Initializes the popup with required services.
     *
     * @param identityService - Service for managing privacy settings.
     * @param audioService - Service for interaction sounds.
     */
    public constructor(
        identityService: IdentityService,
        audioService: AudioService | null = null,
    ) {
        this._identityService = identityService;
        this._audioService = audioService;
    }

    /**
     * Renders the popup into the document body if consent is not already given.
     */
    public render(): void {
        if (this._identityService.isAnalyticsEnabled()) {
            return;
        }

        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard(overlay);

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
            }
        });

        return overlay;
    }

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container no-track";
        container.style.width = "30rem";
        container.style.maxHeight = "fit-content";
        container.style.overflow = "hidden";

        return container;
    }

    private _createCard(overlay: HTMLElement): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card";
        card.style.marginRight = "0";
        card.style.overflowY = "hidden";
        card.style.padding = "2.5rem";
        card.style.alignItems = "center";
        card.style.textAlign = "center";
        card.style.gap = "0";

        card.appendChild(this._createTitle());
        card.appendChild(this._createDescription());
        card.appendChild(this._createEnableButton(overlay));

        return card;
    }

    private _createTitle(): HTMLElement {
        const title: HTMLHeadingElement = document.createElement("h2");
        title.textContent = "Send Your Scores";
        title.style.marginBottom = "1rem";
        title.style.background =
            "linear-gradient(135deg, var(--upper-band-1) 0%, var(--upper-band-3) 100%)";
        title.style.webkitBackgroundClip = "text";
        title.style.webkitTextFillColor = "transparent";

        return title;
    }

    private _createDescription(): HTMLElement {
        const description: HTMLParagraphElement = document.createElement("p");
        description.textContent =
            "Sending your scores to Raw Output allows me to balance rank difficulties, develop modifications to benchmarks, and more. I would really appreciate it!\nOnly score data is sent.";
        description.style.color = "var(--text-dim)";
        description.style.lineHeight = "1.6";
        description.style.fontSize = "0.95rem";
        description.style.marginBottom = "2rem";
        description.style.padding = "0 1rem";
        description.style.whiteSpace = "pre-wrap";

        return description;
    }

    private _createEnableButton(overlay: HTMLElement): HTMLElement {
        const button: HTMLButtonElement = document.createElement("button");
        button.className = "tab-button";
        button.textContent = "Enable";
        button.style.width = "fit-content";
        button.style.padding = "0.6rem 2.5rem";

        button.addEventListener("click", (): void => {
            this._audioService?.playHeavy(0.4);
            this._identityService.setAnalyticsConsent(true);
            overlay.remove();
        });

        return button;
    }
}
