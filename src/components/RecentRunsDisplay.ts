import { KovaaksChallengeRun } from "../types/kovaaks";

/**
 * Handles the rendering and dynamic updating of recent run lists in the UI.
 */
export class RecentRunsDisplay {
  private readonly _listMountPoint: HTMLElement;

  /**
   * Initializes the display with a target DOM element for the list.
   *
   * @param listMountPoint - The element where run items will be appended.
   */
  public constructor(listMountPoint: HTMLElement) {
    this._listMountPoint = listMountPoint;
  }

  /**
   * Replaces the current list content with a new set of runs.
   *
   * @param runs - Array of run data to display.
   */
  public renderRuns(runs: KovaaksChallengeRun[]): void {
    this._clearListContent();

    runs.forEach((run: KovaaksChallengeRun): void => {
      const runItem: HTMLElement = this._createRunItemElement(run);

      this._listMountPoint.appendChild(runItem);
    });
  }

  /**
   * Adds a single run to the top of the list, enforcing a maximum item count.
   *
   * @param run - The new run data to prepend.
   */
  public prependRun(run: KovaaksChallengeRun): void {
    const runItem: HTMLElement = this._createRunItemElement(run);

    this._listMountPoint.prepend(runItem);

    const maxItems: number = 10;

    if (this._listMountPoint.children.length > maxItems) {
      this._listMountPoint.lastElementChild?.remove();
    }
  }

  private _clearListContent(): void {
    this._listMountPoint.innerHTML = "";
  }

  private _createRunItemElement(run: KovaaksChallengeRun): HTMLElement {
    const listItem: HTMLLIElement = document.createElement("li");

    listItem.className = "run-item";

    const difficultyTag: string = run.difficulty
      ? `<span class="run-tag tag-${run.difficulty.toLowerCase()}">${run.difficulty}</span>`
      : "";

    listItem.innerHTML = `
            <div class="run-info">
                <span class="run-scenario">
                    ${run.scenarioName}
                    ${difficultyTag}
                </span>
                <span class="run-date">${this._formatDate(run.completionDate)}</span>
            </div>
            <div class="run-stats">
                <span class="run-score">${run.score.toLocaleString()}</span>
            </div>
        `;

    return listItem;
  }

  private _formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    return date.toLocaleDateString("en-US", options);
  }
}
