import { DirectoryAccessService } from "./services/DirectoryAccessService";

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
import { FocusManagementService } from "./services/FocusManagementService";

/**
 * Orchestrate service instantiation and dependency wiring.
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

  private readonly _focusService: FocusManagementService;

  private readonly _statusView: ApplicationStatusView;

  private readonly _benchmarkView: BenchmarkView;

  private readonly _navigationController: NavigationController;

  /**
   * Initializes the application's core logic and UI components.
   */
  public constructor() {
    this._directoryService = new DirectoryAccessService();
    this._csvService = new KovaaksCsvParsingService();
    this._monitoringService = new DirectoryMonitoringService();
    this._benchmarkService = new BenchmarkService();
    this._historyService = new HistoryService();
    this._rankService = new RankService();
    this._appStateService = new AppStateService();
    this._sessionSettingsService = new SessionSettingsService();

    this._focusService = new FocusManagementService(this._appStateService);

    this._sessionService = new SessionService(
      this._rankService,
      this._sessionSettingsService,
    );

    this._ingestionService = new RunIngestionService({
      directoryService: this._directoryService,
      csvService: this._csvService,
      historyService: this._historyService,
      sessionService: this._sessionService,
      benchmarkService: this._benchmarkService,
    });

    this._statusView = this._createStatusView();

    this._benchmarkView = this._createBenchmarkView();

    this._navigationController = this._createNavigationController();
  }

  /**
   * Triggers initial rendering and system initialization.
   */
  public async initialize(): Promise<void> {
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

  private _createBenchmarkView(): BenchmarkView {
    return new BenchmarkView(
      this._getRequiredElement("view-benchmarks"),
      {
        benchmark: this._benchmarkService,
        history: this._historyService,
        rank: this._rankService,
        session: this._sessionService,
        sessionSettings: this._sessionSettingsService,
        focus: this._focusService,
      },
      this._appStateService,
    );
  }

  private _createNavigationController(): NavigationController {
    return new NavigationController(
      {
        benchmarksButton: this._getRequiredButton("nav-benchmarks"),
      },
      {
        benchmarksView: this._getRequiredElement("view-benchmarks"),
      },
      {
        benchmarkView: this._benchmarkView,
        appStateService: this._appStateService,
      },
    );
  }

  private _setupActionListeners(): void {
    this._setupHeaderActions();

    this._setupStatusActions();
  }

  private _setupHeaderActions(): void {
    const settingsBtn = this._getRequiredButton("header-settings-btn");

    settingsBtn.addEventListener("click", (): void => {
      this._animateButton(settingsBtn);

      this._benchmarkView.openSettings();
    });

    const themeBtn = this._getRequiredButton("header-theme-btn");

    themeBtn.addEventListener("click", (): void => {
      this._animateButton(themeBtn);
    });

    const folderBtn = this._getRequiredButton("header-folder-btn");

    folderBtn.addEventListener("click", (): void => {
      this._animateButton(folderBtn);
    });
  }

  private _setupStatusActions(): void {
    this._getRequiredButton("link-folder-button").addEventListener(
      "click",
      (): Promise<void> => this._handleManualFolderSelection(),
    );

    this._getRequiredButton("import-csv-button").addEventListener(
      "click",
      (): Promise<void> => this._handleManualImport(),
    );

    this._getRequiredButton("remove-folder-button").addEventListener(
      "click",
      (): void => this._handleFolderRemoval(),
    );
  }

  private _animateButton(button: HTMLButtonElement): void {
    button.classList.add("clicked");

    setTimeout((): void => {
      button.classList.remove("clicked");
    }, 50);
  }

  private async _attemptInitialReconnection(): Promise<void> {
    const handle: FileSystemDirectoryHandle | null =
      await this._directoryService.attemptReconnection();

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
    const handle: FileSystemDirectoryHandle | null =
      await this._directoryService.requestDirectorySelection();

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

    await this._ingestionService.synchronizeAvailableRuns();

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
    await this._ingestionService.synchronizeAvailableRuns();

    this._startMonitoring(handle);
  }

  private _startMonitoring(handle: FileSystemDirectoryHandle): void {
    this._monitoringService.startMonitoring(handle, async (): Promise<void> => {
      this._statusView.reportScanning();

      const updatedRuns =
        await this._ingestionService.synchronizeAvailableRuns();

      if (updatedRuns.length > 0) {
        this._focusService.focusScenario(
          updatedRuns[0].scenarioName,
          "NEW_SCORE",
        );
      }

      this._statusView.reportActive();
    });
  }

  private _getRequiredElement(elementId: string): HTMLElement {
    const element: HTMLElement | null = document.getElementById(elementId);

    if (!element) {
      throw new Error(
        `Required application mount point not found: ${elementId}`,
      );
    }

    return element;
  }

  private _getRequiredButton(buttonId: string): HTMLButtonElement {
    const element: HTMLElement = this._getRequiredElement(buttonId);

    if (!(element instanceof HTMLButtonElement)) {
      throw new Error(`Element is not a button: ${buttonId}`);
    }

    return element;
  }
}
