/**
 * The entry point for the Raw Output application.
 * Responsibility: Orchestrate initial UI mounting and status reporting.
 */

class ApplicationStatusDisplay {
    private readonly _mountElement: HTMLElement;

    constructor(mountElement: HTMLElement) {
        this._mountElement = mountElement;
    }

    public reportReady(): void {
        this._clearCurrentContent();
        this._mountStatusIndicator();
        this._mountStatusText("Ready");
    }

    private _clearCurrentContent(): void {
        this._mountElement.innerHTML = "";
    }

    private _mountStatusIndicator(): void {
        const indicator = document.createElement("div");
        indicator.className = "status-indicator";
        this._mountElement.appendChild(indicator);
    }

    private _mountStatusText(message: string): void {
        const textNode = document.createElement("span");
        textNode.textContent = message;
        this._mountElement.appendChild(textNode);
    }
}

function initializeApplication(): void {
    const mountPoint = document.getElementById("status-mount-point");

    if (!mountPoint) {
        throw new Error("Application mount point not found");
    }

    const statusDisplay = new ApplicationStatusDisplay(mountPoint);
    statusDisplay.reportReady();
}

document.addEventListener("DOMContentLoaded", () => {
    initializeApplication();
});
