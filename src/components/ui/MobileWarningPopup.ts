import { AudioService } from "../../services/AudioService";

/**
 * A popup component that warns the user they might be on a mobile device.
 * Used when detection is "suspicious" but not confirmed mobile.
 */
export class MobileWarningPopup {
    private readonly _audioService: AudioService | null;
    private _onContinue: (() => void) | null = null;

    /**
     * Initializes the warning popup.
     *
     * @param audioService - Service for playing interaction sounds.
     */
    public constructor(audioService: AudioService | null = null) {
        this._audioService = audioService;
    }

    /**
     * Set a callback for when the user chooses to continue despite the warning.
     *
     * @param callback - Function to call when the user continues.
     */
    public onContinue(callback: () => void): void {
        this._onContinue = callback;
    }

    /**
     * Render the warning popup into the document body.
     */
    public render(): void {
        const overlay: HTMLElement = this._createOverlay();
        const container: HTMLElement = this._createContainer();
        const card: HTMLElement = this._createCard(overlay);

        container.appendChild(card);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this._audioService?.playLight(0.5);
    }

    private _createOverlay(): HTMLElement {
        const overlay: HTMLDivElement = document.createElement("div");
        overlay.className = "settings-overlay";
        overlay.style.zIndex = "10000";

        return overlay;
    }

    private _createContainer(): HTMLElement {
        const container: HTMLDivElement = document.createElement("div");
        container.className = "settings-menu-container";
        container.style.width = "30rem";

        return container;
    }

    private _createCard(overlay: HTMLElement): HTMLElement {
        const card: HTMLDivElement = document.createElement("div");
        card.className = "settings-menu-card";
        card.style.marginRight = "0";
        card.style.padding = "2.5rem";

        card.innerHTML = this._getCardInnerHtml();

        const continueBtn = card.querySelector(".continue-btn") as HTMLButtonElement;
        continueBtn.addEventListener("click", () => {
            this._handleContinue(overlay);
        });

        return card;
    }

    private _getCardInnerHtml(): string {
        return `
      <div style="text-align: center;">
        <h2 style="margin-bottom: 1.5rem; color: var(--status-medium);">Suspicious Device Detected</h2>
        <p style="color: var(--text-dim); line-height: 1.6; margin-bottom: 2rem;">
          It looks like you might be using a mobile device or a small window. 
          Raw Output is optimized for <strong>desktop</strong> use alongside Kovaaks. 
          If you continue, some features might not work as intended.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button class="about-link-button continue-btn" style="background: var(--glow-color); color: var(--background-1);">
            Continue Anyway
          </button>
        </div>
      </div>
    `;
    }

    private _handleContinue(overlay: HTMLElement): void {
        this._audioService?.playHeavy(0.4);
        overlay.remove();
        this._onContinue?.();
    }
}
