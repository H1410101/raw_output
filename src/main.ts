import { DirectoryAccessService } from "./services/DirectoryAccessService";
import { RecentRunsDisplay } from "./components/RecentRunsDisplay";
import { KovaaksCsvParsingService } from "./services/KovaaksCsvParsingService";
import { DirectoryMonitoringService } from "./services/DirectoryMonitoringService";
import { KovaaksChallengeRun } from "./types/kovaaks";
import { BenchmarkService } from "./services/BenchmarkService";
import { BenchmarkView } from "./components/BenchmarkView";

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
  const navBenchmarks = document.getElementById(
    "nav-benchmarks",
  ) as HTMLButtonElement;

  const viewRecent = document.getElementById("view-recent") as HTMLElement;
  const viewBenchmarks = document.getElementById(
    "view-benchmarks",
  ) as HTMLElement;
  const recentRunsMount = document.getElementById("recent-runs-list");

  if (
    !statusMount ||
    !folderMount ||
    !statusTextOverlay ||
    !linkButton ||
    !importButton ||
    !removeButton ||
    !navRecent ||
    !navBenchmarks ||
    !viewRecent ||
    !viewBenchmarks ||
    !recentRunsMount
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
  const csvService = new KovaaksCsvParsingService();
  const monitoringService = new DirectoryMonitoringService();
  const benchmarkService = new BenchmarkService();
  const benchmarkView = new BenchmarkView(viewBenchmarks, benchmarkService);

  statusDisplay.reportReady();

  setupNavigation(
    navRecent,
    navBenchmarks,
    viewRecent,
    viewBenchmarks,
    benchmarkView,
  );

  await attemptInitialReconnection(
    directoryService,
    statusDisplay,
    monitoringService,
    csvService,
    recentRunsDisplay,
    benchmarkService,
  );

  linkButton.addEventListener("click", async () => {
    await handleManualFolderSelection(
      directoryService,
      statusDisplay,
      monitoringService,
      csvService,
      recentRunsDisplay,
      benchmarkService,
    );
  });

  importButton.addEventListener("click", async () => {
    await handleFolderScan(
      directoryService,
      csvService,
      recentRunsDisplay,
      benchmarkService,
    );
  });

  removeButton.addEventListener("click", () => {
    directoryService.clearStoredHandle();
    monitoringService.stopMonitoring();
    statusDisplay.reportDisconnected();
  });
}

async function handleFolderScan(
  directoryService: DirectoryAccessService,
  csvService: KovaaksCsvParsingService,
  recentRunsDisplay: RecentRunsDisplay,
  benchmarkService: BenchmarkService,
): Promise<void> {
  const folderName = directoryService.currentFolderName;
  if (!folderName) return;

  const fileHandles = await directoryService.getDirectoryFiles();
  const csvHandles = fileHandles.filter((handle) =>
    handle.name.toLowerCase().endsWith(".csv"),
  );

  if (csvHandles.length === 0) return;

  const parsedRuns: KovaaksChallengeRun[] = [];

  for (const handle of csvHandles) {
    try {
      const file = await handle.getFile();
      const content = await file.text();
      const parsedData = csvService.parseKovaakCsv(content, handle.name);

      if (parsedData) {
        const scenarioName = parsedData.scenarioName || "Unknown Scenario";
        parsedRuns.push({
          id: crypto.randomUUID(),
          scenarioName,
          score: parsedData.score || 0,
          completionDate: parsedData.completionDate || new Date(),
          difficulty: benchmarkService.getDifficulty(scenarioName),
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
  statusDisplay: ApplicationStatusDisplay,
  monitoringService: DirectoryMonitoringService,
  csvService: KovaaksCsvParsingService,
  recentRunsDisplay: RecentRunsDisplay,
  benchmarkService: BenchmarkService,
): Promise<void> {
  const handle = await directoryService.attemptReconnection();

  if (handle) {
    statusDisplay.reportFolderReconnected(
      directoryService.originalSelectionName,
      directoryService.fullLogicalPath,
    );
    startMonitoring(
      handle,
      monitoringService,
      csvService,
      recentRunsDisplay,
      benchmarkService,
    );
  } else {
    statusDisplay.reportDisconnected();
  }
}

async function handleManualFolderSelection(
  directoryService: DirectoryAccessService,
  statusDisplay: ApplicationStatusDisplay,
  monitoringService: DirectoryMonitoringService,
  csvService: KovaaksCsvParsingService,
  recentRunsDisplay: RecentRunsDisplay,
  benchmarkService: BenchmarkService,
): Promise<void> {
  const handle = await directoryService.requestDirectorySelection();

  if (handle) {
    statusDisplay.reportFolderLinked(
      directoryService.originalSelectionName,
      directoryService.fullLogicalPath,
    );
    startMonitoring(
      handle,
      monitoringService,
      csvService,
      recentRunsDisplay,
      benchmarkService,
    );
  }
}

function startMonitoring(
  handle: FileSystemDirectoryHandle,
  monitoringService: DirectoryMonitoringService,
  csvService: KovaaksCsvParsingService,
  recentRunsDisplay: RecentRunsDisplay,
  benchmarkService: BenchmarkService,
): void {
  monitoringService.startMonitoring(handle, async (fileHandle) => {
    try {
      const file = await fileHandle.getFile();
      const content = await file.text();
      const parsedData = csvService.parseKovaakCsv(content, fileHandle.name);

      if (parsedData) {
        const scenarioName = parsedData.scenarioName || "Unknown Scenario";
        const run: KovaaksChallengeRun = {
          id: crypto.randomUUID(),
          scenarioName,
          score: parsedData.score || 0,
          completionDate: parsedData.completionDate || new Date(),
          difficulty: benchmarkService.getDifficulty(scenarioName),
        };
        recentRunsDisplay.prependRun(run);
      }
    } catch (err) {
      console.error(`Error processing new file ${fileHandle.name}:`, err);
    }
  });
}

function setupNavigation(
  navRecent: HTMLButtonElement,
  navBenchmarks: HTMLButtonElement,
  viewRecent: HTMLElement,
  viewBenchmarks: HTMLElement,
  benchmarkView: BenchmarkView,
): void {
  navRecent.addEventListener("click", () => {
    navRecent.classList.add("active");
    navBenchmarks.classList.remove("active");
    viewRecent.classList.remove("hidden-view");
    viewBenchmarks.classList.add("hidden-view");
  });

  navBenchmarks.addEventListener("click", () => {
    navBenchmarks.classList.add("active");
    navRecent.classList.remove("active");
    viewBenchmarks.classList.remove("hidden-view");
    viewRecent.classList.add("hidden-view");
    benchmarkView.render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});
