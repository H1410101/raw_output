import { KovaaksChallengeRun } from "../types/kovaaks";

export class RecentRunsDisplay {
  private readonly _listMountPoint: HTMLElement;

  constructor(listMountPoint: HTMLElement) {
    this._listMountPoint = listMountPoint;
  }

  public renderRuns(runs: KovaaksChallengeRun[]): void {
    this._clearListContent();

    runs.forEach((run) => {
      const runItem = this._createRunItemElement(run);
      this._listMountPoint.appendChild(runItem);
    });
  }

  public prependRun(run: KovaaksChallengeRun): void {
    const runItem = this._createRunItemElement(run);
    this._listMountPoint.prepend(runItem);

    if (this._listMountPoint.children.length > 10) {
      this._listMountPoint.lastElementChild?.remove();
    }
  }

  private _clearListContent(): void {
    this._listMountPoint.innerHTML = "";
  }

  private _createRunItemElement(run: KovaaksChallengeRun): HTMLElement {
    const listItem = document.createElement("li");
    listItem.className = "run-item";

    listItem.innerHTML = `
            <div class="run-info">
                <span class="run-scenario">
                    ${run.scenarioName}
                    ${
                      run.difficulty
                        ? `<span class="run-tag tag-${run.difficulty.toLowerCase()}">${run.difficulty}</span>`
                        : ""
                    }
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
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
