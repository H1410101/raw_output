import { TrainingRun } from "../types/training";

export class RecentRunsDisplay {
    private readonly _listMountPoint: HTMLElement;

    constructor(listMountPoint: HTMLElement) {
        this._listMountPoint = listMountPoint;
    }

    public renderRuns(runs: TrainingRun[]): void {
        this._clearListContent();

        runs.forEach((run) => {
            const runItem = this._createRunItemElement(run);
            this._listMountPoint.appendChild(runItem);
        });
    }

    public renderPlaceholders(): void {
        const placeholders: TrainingRun[] = this._generatePlaceholderData();
        this.renderRuns(placeholders);
    }

    private _clearListContent(): void {
        this._listMountPoint.innerHTML = "";
    }

    private _createRunItemElement(run: TrainingRun): HTMLElement {
        const listItem = document.createElement("li");
        listItem.className = "run-item";

        listItem.innerHTML = `
            <div class="run-info">
                <span class="run-scenario">${run.scenarioName}</span>
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
            minute: "2-digit"
        });
    }

    private _generatePlaceholderData(): TrainingRun[] {
        return [
            {
                id: "1",
                scenarioName: "[Placeholder] Vertical Clicking",
                score: 14200.0,
                completionDate: new Date()
            },
            {
                id: "2",
                scenarioName: "[Placeholder] Horizontal Tracking",
                score: 8.0,
                completionDate: new Date(Date.now() - 3600000)
            },
            {
                id: "3",
                scenarioName: "[Placeholder] Dynamic Pasu",
                score: 245.5,
                completionDate: new Date(Date.now() - 86400000)
            }
        ];
    }
}
