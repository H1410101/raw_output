import { DirectoryAccessService } from "./services/DirectoryAccessService";
import { RecentRunsDisplay } from "./components/RecentRunsDisplay";
import { KovaaksCsvParsingService } from "./services/KovaaksCsvParsingService";
import { DirectoryMonitoringService } from "./services/DirectoryMonitoringService";
import { BenchmarkService } from "./services/BenchmarkService";
import { BenchmarkView } from "./components/BenchmarkView";
import { HistoryService } from "./services/HistoryService";
import { RankService } from "./services/RankService";
import { SessionService } from "./services/SessionService";
import { SessionSettingsService } from "./services/SessionSettingsService";
import { RunIngestionService } from "./services/RunIngestionService";
import { AppStateService } from "./services/AppStateService";
import { ApplicationStatusView } from "./components/ui/ApplicationStatusView";
import { NavigationController } from "./components/NavigationController";

/**
 * Responsibility: Orchestrate service instantiation and dependency wiring.
 * Acts as the composition root for the application's core logic and UI components.
 */
export class AppBootstrap {
  private readonly _directoryService: DirectoryAccessService;
  private readonly _csvService: KovaaksCsvParsingService;
  private readonly _monitoringService: DirectoryMonitoringService;
  private readonly _benchmarkService: BenchmarkService;
  private readonly _historyService: HistoryService;
  private readonly _rankService: RankService;
  private readonly _appStateService: AppStateService;
  private readonly _sessionSettingsService: SessionSettingsService;
  private readonly _sessionService: SessionService;
  private readonly _ingestionService: RunIngestionService;
  private readonly _statusView: ApplicationStatusView;
  private readonly _recentRunsDisplay: RecentRunsDisplay;
  private readonly _newRunsDisplay: RecentRunsDisplay;
  private readonly _benchmarkView: BenchmarkView;
  private readonly _navigationController: NavigationController;

  constructor() {
    this._directoryService = new DirectoryAccessService();
    this._csvService = new KovaaksCsvParsingService();
    this._monitoringService = new DirectoryMonitoringService();
    this._benchmarkService = new BenchmarkService();
    this._historyService = new HistoryService();
    this._rankService = new RankService();
    this._appStateService = new AppStateService();
    this._sessionSettingsService = new SessionSettingsService();

    this._sessionService = new SessionService(
      this._rankService,
      this._sessionSettingsService,
    );

    this._ingestionService = new RunIngestionService(
      this._directoryService,
      this._csvService,
      this._historyService,
      this._sessionService,
      this._benchmarkService,
    );

    this._statusView = this._createStatusView();
    this._recentRunsDisplay = this._createDisplay("recent-runs-list");
    this._newRunsDisplay = this._createDisplay("new-runs-list");

    this._benchmarkView = this._createBenchmarkView();
    this._navigationController = this._createNavigationController();
  }

  /**
   * Initializes the application lifecycle and triggers initial rendering.
   */
  public async initialize(): Promise<void> {
    this._setupSessionInteractions();
    this._statusView.reportReady();
    await this._benchmarkView.render();
    this._navigationController.initialize();
    this._setupActionListeners();

    await this._attemptInitialReconnection();
  }

  private _createStatusView(): ApplicationStatusView {
    return new ApplicationStatusView(
      this._getRequiredElement("status-mount-point"),
      this._getRequiredElement("folder-status"),
      this._getRequiredElement("status-text-overlay"),
    );
  }

  private _createDisplay(id: string): RecentRunsDisplay {
    return new RecentRunsDisplay(this._getRequiredElement(id));
  }

  private _createBenchmarkView(): BenchmarkView {
    return new BenchmarkView(
      this._getRequiredElement("view-benchmarks"),
      this._benchmarkService,
      this._historyService,
      this._rankService,
      this._sessionService,
      this._sessionSettingsService,
      this._appStateService,
    );
  }

  private _createNavigationController(): NavigationController {
    return new NavigationController(
      this._getRequiredButton("nav-recent"),
      this._getRequiredButton("nav-new"),
      this._getRequiredButton("nav-benchmarks"),
      this._getRequiredElement("view-recent"),
      this._getRequiredElement("view-new"),
      this._getRequiredElement("view-benchmarks"),
      this._benchmarkView,
      this._ingestionService,
      this._newRunsDisplay,
      this._appStateService,
    );
  }

  private _setupSessionInteractions(): void {
    this._sessionService.onSessionUpdated(async () => {
      const newRuns = await this._ingestionService.getNewRuns();
      this._newRunsDisplay.renderRuns(newRuns);
    });
  }

  private _setupActionListeners(): void {
    this._getRequiredButton("link-folder-button").addEventListener(
      "click",
      () => this._handleManualFolderSelection(),
    );

    this._getRequiredButton("import-csv-button").addEventListener(
      "click",
      () => this._handleManualImport(),
    );

    this._getRequiredButton("remove-folder-button").addEventListener(
      "click",
      () => this._handleFolderRemoval(),
    );
  }

  private async _attemptInitialReconnection(): Promise<void> {
    const handle = await this._directoryService.attemptReconnection();

    if (handle) {
      this._statusView.reportFolderReconnected(
        this._directoryService.originalSelectionName,
        this._directoryService.fullLogicalPath,
      );

      await this._synchronizeAndMonitor(handle);
      return;
    }

    this._statusView.reportDisconnected();
  }

  private async _handleManualFolderSelection(): Promise<void> {
    const handle = await this._directoryService.requestDirectorySelection();

    if (handle) {
      this._statusView.reportFolderLinked(
        this._directoryService.originalSelectionName,
        this._directoryService.fullLogicalPath,
      );

      await this._synchronizeAndMonitor(handle);
    }
  }

  private async _handleManualImport(): Promise<void> {
    this._statusView.reportScanning();

    const runs = await this._ingestionService.synchronizeAvailableRuns();
    this._recentRunsDisplay.renderRuns(runs);

    const newRuns = await this._ingestionService.getNewRuns();
    this._newRunsDisplay.renderRuns(newRuns);

    this._statusView.reportActive();
  }

  private _handleFolderRemoval(): void {
    this._directoryService.clearStoredHandle();
    this._monitoringService.stopMonitoring();
    this._statusView.reportDisconnected();
  }

  private async _synchronizeAndMonitor(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    const runs = await this._ingestionService.synchronizeAvailableRuns();
    this._recentRunsDisplay.renderRuns(runs);

    const newRuns = await this._ingestionService.getNewRuns();
    this._newRunsDisplay.renderRuns(newRuns);

    this._startMonitoring(handle);
  }

  private _startMonitoring(handle: FileSystemDirectoryHandle): void {
    this._monitoringService.startMonitoring(handle, async () => {
      this._statusView.reportScanning();
      const updatedRuns = await this._ingestionService.synchronizeAvailableRuns();
      this._recentRunsDisplay.renderRuns(updatedRuns);

      const updatedNewRuns = await this._ingestionService.getNewRuns();
      this._newRunsDisplay.renderRuns(updatedNewRuns);
      this._statusView.reportActive();
    });
  }

  private _getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required application mount point not found: ${id}`);
    }
    return element;
  }

  private _getRequiredButton(id: string): HTMLButtonElement {
    const element = this._getRequiredElement(id);
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error(`Element is not a button: ${id}`);
    }
    return element;
  }
}
