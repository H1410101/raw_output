/**
 * Component for displaying elapsed session time in HH:MM:SS format.
 */
export class HUDTimer {
    private readonly _element: HTMLElement;
    private _interval: number | null = null;
    private _startTime: number = 0;

    /**
     * Initializes the timer element.
     */
    public constructor() {
        this._element = document.createElement("div");
        this._element.className = "hud-timer";
        this._element.innerHTML = `
            <span class="hud-label">SESSION TIME</span>
            <span class="hud-value">00:00:00</span>
        `;
    }

    /**
     * Returns the timer element.
     * 
     * @returns The root timer HTMLElement.
     */
    public get element(): HTMLElement {
        return this._element;
    }

    /**
     * Starts the timer from a given timestamp.
     *
     * @param startTimeIso - ISO string of the session start time.
     */
    public start(startTimeIso: string): void {
        this.stop();
        this._startTime = new Date(startTimeIso).getTime();

        this._update();
        this._interval = window.setInterval((): void => this._update(), 1000);
    }

    /**
     * Stops the timer.
     */
    public stop(): void {
        if (this._interval !== null) {
            window.clearInterval(this._interval);
            this._interval = null;
        }
    }

    private _update(): void {
        const elapsed: number = Math.floor((Date.now() - this._startTime) / 1000);
        const hours: number = Math.floor(elapsed / 3600);
        const minutes: number = Math.floor((elapsed % 3600) / 60);
        const seconds: number = elapsed % 60;

        const formatted: string = [hours, minutes, seconds]
            .map((val: number): string => val.toString().padStart(2, "0"))
            .join(":");

        const valueElement: HTMLElement | null = this._element.querySelector(".hud-value");
        if (valueElement) {
            valueElement.textContent = formatted;
        }
    }
}
