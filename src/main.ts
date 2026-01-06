import { DirectoryAccessService } from "./services/DirectoryAccessService";

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

    if (!statusMount || !folderMount || !linkButton) {
        throw new Error("Required application mount points not found");
    }

    const statusDisplay = new ApplicationStatusDisplay(statusMount, folderMount);
    const directoryService = new DirectoryAccessService();

    statusDisplay.reportReady();

    linkButton.addEventListener("click", async () => {
        const handle = await directoryService.requestDirectoryLink();
        if (handle) {
            statusDisplay.reportFolderLinked(handle.name);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeApplication();
});
