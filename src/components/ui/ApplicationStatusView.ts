/**
 * Handles the visual reporting of folder connectivity and scanning states.
 *
 * Manages the status indicator, folder path display, and text overlays.
 */
export class ApplicationStatusView {
  private readonly _statusMount: HTMLElement;

  private readonly _folderMount: HTMLElement;

  private readonly _statusTextOverlay: HTMLElement;

  /**
   * Initializes the status view with its required DOM mount points.
   *
   * @param statusMount - The element where the status indicator is placed.
   * @param folderMount - The element where the linked folder name is displayed.
   * @param statusTextOverlay - The element displaying the human-readable status text.
   */
  public constructor(
    statusMount: HTMLElement,
    folderMount: HTMLElement,
    statusTextOverlay: HTMLElement,
  ) {
    this._statusMount = statusMount;

    this._folderMount = folderMount;

    this._statusTextOverlay = statusTextOverlay;
  }

  /**
   * Reports that the application is ready for interaction.
   */
  public reportReady(): void {
    this._clearStatusContent();

    this._mountStatusIndicator();

    this._updateStatusText("Ready");
  }

  /**
   * Reports that a background file system scan is in progress.
   */
  public reportScanning(): void {
    this._updateStatusText("Scanning");

    this._setScanningState(true);
  }

  /**
   * Reports that the application is active and monitoring for changes.
   */
  public reportActive(): void {
    this._updateStatusText("Active");

    this._setScanningState(false);
  }

  /**
   * Reports that no folder is currently linked.
   */
  public reportDisconnected(): void {
    this._clearStatusContent();

    this._updateStatusText("Disconnected");

    this._folderMount.textContent = "No folder linked";
  }

  /**
   * Reports a successful manual folder selection.
   *
   * @param folderName - The display name of the selected folder.
   * @param fullPath - The full logical path of the folder for tooltips.
   */
  public reportFolderLinked(folderName: string, fullPath: string): void {
    this._clearStatusContent();

    this._mountStatusIndicator();

    this._folderMount.innerHTML = `Connected to: <span class="connected-text">${folderName}</span>`;

    this._folderMount.title = fullPath;

    this._updateStatusText("Active");
  }

  /**
   * Reports a successful automated reconnection to a stored folder handle.
   *
   * @param folderName - The display name of the reconnected folder.
   * @param fullPath - The full logical path for tooltips.
   */
  public reportFolderReconnected(folderName: string, fullPath: string): void {
    this._clearStatusContent();

    this._mountStatusIndicator();

    this._folderMount.innerHTML = `Re-connected to: <span class="connected-text">${folderName}</span>`;

    this._folderMount.title = fullPath;

    this._updateStatusText("Active");
  }

  private _clearStatusContent(): void {
    this._statusMount.innerHTML = "";
  }

  private _mountStatusIndicator(): void {
    const indicator: HTMLDivElement = document.createElement("div");

    indicator.className = "status-indicator";

    this._statusMount.appendChild(indicator);
  }

  private _updateStatusText(message: string): void {
    this._statusTextOverlay.textContent = message;
  }

  private _setScanningState(isScanning: boolean): void {
    const indicator: Element | null =
      this._statusMount.querySelector(".status-indicator");

    if (!indicator) {
      return;
    }

    if (isScanning) {
      indicator.classList.add("scanning");

      return;
    }

    indicator.classList.remove("scanning");
  }
}
