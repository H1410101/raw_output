import { DirectoryAccessService } from "../services/DirectoryAccessService";
import { HistoryService } from "../services/HistoryService";
import { AppStateService } from "../services/AppStateService";
import { FolderSettingsView, FolderActionHandlers } from "./ui/FolderSettingsView";

/**
 * Services and callbacks required by FolderView.
 */
export interface FolderViewServices {
    readonly directory: DirectoryAccessService;
    readonly history: HistoryService;
    readonly appState: AppStateService;
    readonly folderActions: {
        readonly onLinkFolder: () => Promise<void>;
        readonly onForceScan: () => Promise<void>;
        readonly onUnlinkFolder: () => void;
    };
}

/**
 * Top-level view for managing folder settings and initial setup.
 */
export class FolderView {
    private readonly _mountPoint: HTMLElement;
    private readonly _services: FolderViewServices;
    private _folderSettingsView: FolderSettingsView | null = null;
    private _isRendering: boolean = false;

    /**
     * Initializes the view with required dependencies.
     *
     * @param mountPoint - The DOM element where this view is rendered.
     * @param services - Core services and action handlers.
     */
    public constructor(mountPoint: HTMLElement, services: FolderViewServices) {
        this._mountPoint = mountPoint;
        this._services = services;
    }

    /**
     * Renders the folder settings interface.
     */
    public async render(): Promise<void> {
        if (this._isRendering) {
            return;
        }

        this._isRendering = true;

        try {
            this._clearMount();

            const lastCheck: number = await this._services.history.getLastCheckTimestamp();
            const isInvalid: boolean =
                !!this._services.directory.originalSelectionName &&
                !this._services.directory.isStatsFolderSelected();
            const isValid: boolean = this._services.directory.isStatsFolderSelected();

            this._folderSettingsView = new FolderSettingsView({
                handlers: this._createHandlers(),
                currentFolderName: this._services.directory.originalSelectionName,
                hasStats: lastCheck > 0,
                isInvalid,
                isValid,
            });

            this._mountPoint.appendChild(this._folderSettingsView.render());
        } finally {
            this._isRendering = false;
        }
    }

    /**
     * Determines if the current folder configuration is valid and has data.
     *
     * @returns A promise that resolves to true if the folder is valid and has stats.
     */
    public async isFolderValidAndPopulated(): Promise<boolean> {
        const isStatsFolder: boolean = this._services.directory.isStatsFolderSelected();
        const lastCheck: number = await this._services.history.getLastCheckTimestamp();

        return isStatsFolder && lastCheck > 0;
    }

    /**
     * Cleans up the view and its sub-components.
     */
    public destroy(): void {
        this._folderSettingsView?.destroy();
        this._clearMount();
    }

    private _clearMount(): void {
        this._folderSettingsView?.destroy();
        this._mountPoint.innerHTML = "";
    }

    private _createHandlers(): FolderActionHandlers {
        return {
            onLinkFolder: async (): Promise<void> => {
                await this._services.folderActions.onLinkFolder();
                await this.render();
            },
            onForceScan: async (): Promise<void> => {
                await this._services.folderActions.onForceScan();
                await this.render();
            },
            onUnlinkFolder: (): void => {
                this._services.folderActions.onUnlinkFolder();
                this.render();
            },
        };
    }
}
