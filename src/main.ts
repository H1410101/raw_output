import { DirectoryAccessService } from "./services/DirectoryAccessService";
import { RecentRunsDisplay } from "./components/RecentRunsDisplay";
import { KovaaksCsvParsingService } from "./services/KovaaksCsvParsingService";
import { DirectoryMonitoringService } from "./services/DirectoryMonitoringService";
import { BenchmarkService } from "./services/BenchmarkService";
import { BenchmarkView } from "./components/BenchmarkView";
import { HistoryService } from "./services/HistoryService";
import { RankService } from "./services/RankService";
import { SessionService } from "./services/SessionService";
import { RunIngestionService } from "./services/RunIngestionService";

/**
 * The entry point for the Raw Output application.
 * Responsibility: Orchestrate initial UI mounting and status reporting.
 */

class ApplicationStatusDisplay {
  private readonly _statusMount: HTMLElement;
  private readonly _folderMount: HTMLElement;
  private readonly _statusTextOverlay: HTMLElement;

  constructor(
    statusMount: HTMLElement,
    folderMount: HTMLElement,
    statusTextOverlay: HTMLElement,
  ) {
    this._statusMount = statusMount;
    this._folderMount = folderMount;
    this._statusTextOverlay = statusTextOverlay;
  }

  public reportReady(): void {
    this._clearStatusContent();
    this._mountStatusIndicator();
    this._updateStatusText("Ready");
  }

  public reportScanning(): void {
    this._updateStatusText("Scanning");
    this._setScanningState(true);
  }

  public reportActive(): void {
    this._updateStatusText("Active");
    this._setScanningState(false);
  }

  public reportDisconnected(): void {
    this._clearStatusContent();
    this._updateStatusText("Disconnected");
    this._folderMount.textContent = "No folder linked";
  }

  public reportFolderLinked(name: string, fullPath: string): void {
    this._clearStatusContent();
    this._mountStatusIndicator();
    this._folderMount.innerHTML = `Connected to: <span class="connected-text">${name}</span>`;
    this._folderMount.title = fullPath;
    this._updateStatusText("Active");
  }

  public reportFolderReconnected(name: string, fullPath: string): void {
    this._clearStatusContent();
    this._mountStatusIndicator();
    this._folderMount.innerHTML = `Re-connected to: <span class="connected-text">${name}</span>`;
    this._folderMount.title = fullPath;
    this._updateStatusText("Active");
  }

  private _clearStatusContent(): void {
    this._statusMount.innerHTML = "";
  }

  private _mountStatusIndicator(): void {
    const indicator = document.createElement("div");
    indicator.className = "status-indicator";
    this._statusMount.appendChild(indicator);
  }

  private _updateStatusText(message: string): void {
    this._statusTextOverlay.textContent = message;
  }

  private _setScanningState(isScanning: boolean): void {
    const indicator = this._statusMount.querySelector(".status-indicator");
    if (indicator) {
      if (isScanning) {
        indicator.classList.add("scanning");
      } else {
        indicator.classList.remove("scanning");
      }
    }
  }
}

async function initializeApplication(): Promise<void> {
  const statusMount = document.getElementById("status-mount-point");
  const folderMount = document.getElementById("folder-status");
  const statusTextOverlay = document.getElementById("status-text-overlay");

  const linkButton = document.getElementById(
    "link-folder-button",
  ) as HTMLButtonElement;
  const importButton = document.getElementById(
    "import-csv-button",
  ) as HTMLButtonElement;
  const removeButton = document.getElementById(
    "remove-folder-button",
  ) as HTMLButtonElement;

  const navRecent = document.getElementById("nav-recent") as HTMLButtonElement;
  const navNew = document.getElementById("nav-new") as HTMLButtonElement;
  const navBenchmarks = document.getElementById(
    "nav-benchmarks",
  ) as HTMLButtonElement;

  const viewRecent = document.getElementById("view-recent") as HTMLElement;
  const viewNew = document.getElementById("view-new") as HTMLElement;
  const viewBenchmarks = document.getElementById(
    "view-benchmarks",
  ) as HTMLElement;
  const recentRunsMount = document.getElementById("recent-runs-list");
  const newRunsMount = document.getElementById("new-runs-list");

  if (
    !statusMount ||
    !folderMount ||
    !statusTextOverlay ||
    !linkButton ||
    !importButton ||
    !removeButton ||
    !navRecent ||
    !navNew ||
    !navBenchmarks ||
    !viewRecent ||
    !viewNew ||
    !viewBenchmarks ||
    !recentRunsMount ||
    !newRunsMount
  ) {
    throw new Error("Required application mount points not found");
  }

  const statusDisplay = new ApplicationStatusDisplay(
    statusMount,
    folderMount,
    statusTextOverlay,
  );
  const directoryService = new DirectoryAccessService();
  const recentRunsDisplay = new RecentRunsDisplay(recentRunsMount);
  const newRunsDisplay = new RecentRunsDisplay(newRunsMount);
  const csvService = new KovaaksCsvParsingService();
  const monitoringService = new DirectoryMonitoringService();
  const benchmarkService = new BenchmarkService();
  const historyService = new HistoryService();
  const rankService = new RankService();
  const sessionService = new SessionService(rankService);
  const ingestionService = new RunIngestionService(
    directoryService,
    csvService,
    historyService,
    sessionService,
    benchmarkService,
  );
  const benchmarkView = new BenchmarkView(
    viewBenchmarks,
    benchmarkService,
    historyService,
    rankService,
    sessionService,
  );

  statusDisplay.reportReady();
  await benchmarkView.render();

  setupNavigation(
    navRecent,
    navNew,
    navBenchmarks,
    viewRecent,
    viewNew,
    viewBenchmarks,
    benchmarkView,
    ingestionService,
    newRunsDisplay,
  );

  await attemptInitialReconnection(
    directoryService,
    statusDisplay,
    monitoringService,
    ingestionService,
    recentRunsDisplay,
    newRunsDisplay,
  );

  linkButton.addEventListener("click", async () => {
    await handleManualFolderSelection(
      directoryService,
      statusDisplay,
      monitoringService,
      ingestionService,
      recentRunsDisplay,
      newRunsDisplay,
    );
  });

  importButton.addEventListener("click", async () => {
    statusDisplay.reportScanning();

    const runs = await ingestionService.synchronizeAvailableRuns();
    recentRunsDisplay.renderRuns(runs);

    const newRuns = await ingestionService.getNewRuns();
    newRunsDisplay.renderRuns(newRuns);

    statusDisplay.reportActive();
  });

  removeButton.addEventListener("click", () => {
    directoryService.clearStoredHandle();
    monitoringService.stopMonitoring();
    statusDisplay.reportDisconnected();
  });
}

async function attemptInitialReconnection(
  directoryService: DirectoryAccessService,
  statusDisplay: ApplicationStatusDisplay,
  monitoringService: DirectoryMonitoringService,
  ingestionService: RunIngestionService,
  recentRunsDisplay: RecentRunsDisplay,
  newRunsDisplay: RecentRunsDisplay,
): Promise<void> {
  const handle = await directoryService.attemptReconnection();

  if (handle) {
    statusDisplay.reportFolderReconnected(
      directoryService.originalSelectionName,
      directoryService.fullLogicalPath,
    );

    const initialRuns = await ingestionService.synchronizeAvailableRuns();
    recentRunsDisplay.renderRuns(initialRuns);

    const initialNewRuns = await ingestionService.getNewRuns();
    newRunsDisplay.renderRuns(initialNewRuns);

    startMonitoring(
      handle,
      monitoringService,
      ingestionService,
      recentRunsDisplay,
      newRunsDisplay,
      statusDisplay,
    );
  } else {
    statusDisplay.reportDisconnected();
  }
}

async function handleManualFolderSelection(
  directoryService: DirectoryAccessService,
  statusDisplay: ApplicationStatusDisplay,
  monitoringService: DirectoryMonitoringService,
  ingestionService: RunIngestionService,
  recentRunsDisplay: RecentRunsDisplay,
  newRunsDisplay: RecentRunsDisplay,
): Promise<void> {
  const handle = await directoryService.requestDirectorySelection();

  if (handle) {
    statusDisplay.reportFolderLinked(
      directoryService.originalSelectionName,
      directoryService.fullLogicalPath,
    );

    const initialRuns = await ingestionService.synchronizeAvailableRuns();
    recentRunsDisplay.renderRuns(initialRuns);

    const initialNewRuns = await ingestionService.getNewRuns();
    newRunsDisplay.renderRuns(initialNewRuns);

    startMonitoring(
      handle,
      monitoringService,
      ingestionService,
      recentRunsDisplay,
      newRunsDisplay,
      statusDisplay,
    );
  }
}

function startMonitoring(
  handle: FileSystemDirectoryHandle,
  monitoringService: DirectoryMonitoringService,
  ingestionService: RunIngestionService,
  recentRunsDisplay: RecentRunsDisplay,
  newRunsDisplay: RecentRunsDisplay,
  statusDisplay: ApplicationStatusDisplay,
): void {
  monitoringService.startMonitoring(handle, async () => {
    try {
      statusDisplay.reportScanning();

      const updatedRuns = await ingestionService.synchronizeAvailableRuns();
      recentRunsDisplay.renderRuns(updatedRuns);

      const updatedNewRuns = await ingestionService.getNewRuns();
      newRunsDisplay.renderRuns(updatedNewRuns);

      statusDisplay.reportActive();
    } catch (err) {
      console.error(`Error processing directory update:`, err);
    }
  });
}

function setupNavigation(
  navRecent: HTMLButtonElement,
  navNew: HTMLButtonElement,
  navBenchmarks: HTMLButtonElement,
  viewRecent: HTMLElement,
  viewNew: HTMLElement,
  viewBenchmarks: HTMLElement,
  benchmarkView: BenchmarkView,
  ingestionService: RunIngestionService,
  newRunsDisplay: RecentRunsDisplay,
): void {
  navRecent.addEventListener("click", () => {
    navRecent.classList.add("active");
    navNew.classList.remove("active");
    navBenchmarks.classList.remove("active");
    viewRecent.classList.remove("hidden-view");
    viewNew.classList.add("hidden-view");
    viewBenchmarks.classList.add("hidden-view");
  });

  navNew.addEventListener("click", async () => {
    navNew.classList.add("active");
    navRecent.classList.remove("active");
    navBenchmarks.classList.remove("active");
    viewNew.classList.remove("hidden-view");
    viewRecent.classList.add("hidden-view");
    viewBenchmarks.classList.add("hidden-view");

    const newRuns = await ingestionService.getNewRuns();
    newRunsDisplay.renderRuns(newRuns);
  });

  navBenchmarks.addEventListener("click", async () => {
    navBenchmarks.classList.add("active");
    navRecent.classList.remove("active");
    navNew.classList.remove("active");
    viewBenchmarks.classList.remove("hidden-view");
    viewRecent.classList.add("hidden-view");
    viewNew.classList.add("hidden-view");
    await benchmarkView.render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});
