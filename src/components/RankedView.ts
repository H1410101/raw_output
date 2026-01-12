
/**
 * Component responsible for managing the Ranked mode interface.
 */
export class RankedView {
    private readonly _container: HTMLElement;

    /**
     * Initializes the view with its mount point.
     *
     * @param container - The DOM element where this view is rendered.
     */
    public constructor(container: HTMLElement) {
        this._container = container;
    }

    /**
     * Renders the initial state of the Ranked view.
     */
    public async render(): Promise<void> {
        this._container.innerHTML = `
      <div class="ranked-placeholder">
        <h2>Ranked Mode</h2>
        <p>Prepare for your next benchmark session.</p>
        <div class="ranked-coming-soon">
          <span>Active Session logic pending (Checkpoint 4.2)</span>
        </div>
      </div>
    `;
    }

    /**
     * Refreshes the view data.
     */
    public refresh(): void {
        // To be implemented as we add session logic
    }
}
