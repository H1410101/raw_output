/**
 * Component for visualizing ranked session progress.
 */
export class HUDProgressBar {
    private readonly _element: HTMLElement;

    /**
     * Initializes the progress bar element.
     */
    public constructor() {
        this._element = document.createElement("div");
        this._element.className = "hud-progress-container";
        this._element.innerHTML = `
            <div class="hud-label">GAUNTLET PROGRESS</div>
            <div class="hud-progress-track">
                <div class="hud-progress-fill"></div>
            </div>
        `;
    }

    /**
     * Returns the progress bar element.
     */
    public get element(): HTMLElement {
        return this._element;
    }

    /**
     * Updates the progress bar state.
     *
     * @param currentIndex - Current scenario index (0-based).
     * @param sequenceLength - Total scenarios in current sequence.
     * @param isInitialGauntlet - Whether we are in the initial 3-scenario gauntlet.
     */
    public update(currentIndex: number, sequenceLength: number, isInitialGauntlet: boolean): void {
        const fill: HTMLElement | null = this._element.querySelector(".hud-progress-fill");
        const label: HTMLElement | null = this._element.querySelector(".hud-label");

        if (!fill || !label) {
            return;
        }

        const progress: number = (currentIndex / sequenceLength) * 100;
        fill.style.width = `${progress}%`;

        if (isInitialGauntlet) {
            label.textContent = "GAUNTLET PROGRESS";
        } else {
            label.textContent = "INFINITE PROGRESS";
        }
    }
}
