import { DirectoryAccessService } from "./services/DirectoryAccessService";
import { RecentRunsDisplay } from "./components/RecentRunsDisplay";
import { KovaaksCsvParsingService } from "./services/KovaaksCsvParsingService";
import { KovaaksChallengeRun } from "./types/kovaaks";

/**
 * The entry point for the Raw Output application.
 * Responsibility: Orchestrate initial UI mounting and status reporting.
 */

class ApplicationStatusDisplay {
    private readonly _statusMount: HTMLElement;
    private readonly _folderMount: HTMLElement;

    constructor(statusMount: HTMLElement, folderMount: HTMLElement) {
        this._statusMount = statusMount;
        this._folderMount = folderMount;
    }

    public reportReady(): void {
        this._clearStatusContent();
        this._mountStatusIndicator();
        this._mountStatusText("Ready");
    }

    public reportFolderLinked(name: string): void {
        this._folderMount.innerHTML = `Connected to: <span class="connected-text">${name}</span>`;
    }

    public reportFolderReconnected(name: string): void {
        this._folderMount.innerHTML = `Re-connected to: <span class="connected-text">${name}</span>`;
    }

    private _clearStatusContent(): void {
        this._statusMount.innerHTML = "";
    }

    private _mountStatusIndicator(): void {
        const indicator = document.createElement("div");
        indicator.className = "status-indicator";
        this._statusMount.appendChild(indicator);
    }

    private _mountStatusText(message: string): void {
        const textNode = document.createElement("span");
        textNode.textContent = message;
        this._statusMount.appendChild(textNode);
    }
}

async function initializeApplication(): Promise<void> {
    const statusMount = document.getElementById("status-mount-point");
    const folderMount = document.getElementById("folder-status");
    const linkButton = document.getElementById("link-folder-button") as HTMLButtonElement;
    const recentRunsMount = document.getElementById("recent-runs-list");
    const importButton = document.getElementById("import-csv-button") as HTMLButtonElement;

    if (!statusMount || !folderMount || !linkButton || !recentRunsMount || !importButton) {
        throw new Error("Required application mount points not found");
    }

    const statusDisplay = new ApplicationStatusDisplay(statusMount, folderMount);
    const directoryService = new DirectoryAccessService();
    const recentRunsDisplay = new RecentRunsDisplay(recentRunsMount);
    const csvService = new KovaaksCsvParsingService();

    statusDisplay.reportReady();

    await attemptInitialReconnection(directoryService, statusDisplay);

    linkButton.addEventListener("click", async () => {
        await handleManualFolderSelection(directoryService, statusDisplay);
    });

    importButton.addEventListener("click", async () => {
        await handleFolderScan(directoryService, csvService, recentRunsDisplay);
    });
}

async function handleFolderScan(
    directoryService: DirectoryAccessService,
    csvService: KovaaksCsvParsingService,
    recentRunsDisplay: RecentRunsDisplay
): Promise<void> {
    const folderName = directoryService.currentFolderName;
    if (!folderName) return;

    const fileHandles = await directoryService.getDirectoryFiles();
    const csvHandles = fileHandles.filter((handle) => handle.name.toLowerCase().endsWith(".csv"));

    if (csvHandles.length === 0) return;

    const parsedRuns: KovaaksChallengeRun[] = [];

    for (const handle of csvHandles) {
        try {
            const file = await handle.getFile();
            const content = await file.text();
            const parsedData = csvService.parseKovaakCsv(content, handle.name);

            if (parsedData) {
                parsedRuns.push({
                    id: crypto.randomUUID(),
                    scenarioName: parsedData.scenarioName || "Unknown Scenario",
                    score: parsedData.score || 0,
                    completionDate: parsedData.completionDate || new Date()
                });
            }
        } catch (err) {
            console.error(`Error processing file ${handle.name}:`, err);
        }
    }

    if (parsedRuns.length > 0) {
        const sortedRuns = parsedRuns
            .sort((a, b) => b.completionDate.getTime() - a.completionDate.getTime())
            .slice(0, 10);

        recentRunsDisplay.renderRuns(sortedRuns);
    }
}

async function attemptInitialReconnection(
    directoryService: DirectoryAccessService,
    statusDisplay: ApplicationStatusDisplay
): Promise<void> {
    const handle = await directoryService.attemptReconnection();

    if (handle) {
        statusDisplay.reportFolderReconnected(handle.name);
    }
}

async function handleManualFolderSelection(
    directoryService: DirectoryAccessService,
    statusDisplay: ApplicationStatusDisplay
): Promise<void> {
    const handle = await directoryService.requestDirectorySelection();

    if (handle) {
        statusDisplay.reportFolderLinked(handle.name);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeApplication();
});
