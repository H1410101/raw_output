import { DifficultyTier } from "../data/benchmarks";

/**
 * Encapsulates the transient UI state that should persist between sessions.
 */
export interface AppState {
  /** The ID of the currently active navigation tab (e.g., 'nav-recent', 'nav-benchmarks'). */
  activeTabId: string;
  /** The last selected difficulty level in the Benchmark view. */
  benchmarkDifficulty: DifficultyTier;
  /** Whether the visual settings menu is currently open. */
  isSettingsMenuOpen: boolean;
  /** The last recorded scroll position of the benchmark table. */
  benchmarkScrollTop: number;
  /** The name of the scenario that was last focused by an autoscroll. */
  focusedScenarioName: string | null;
}

/**
 * Manages persistence of UI-related state to ensure a consistent experience across restarts.
 */
export class AppStateService {
  private static readonly _storageKey: string = "raw_output_app_state";

  private readonly _state: AppState;

  /**
   * Initializes the service by loading state from local storage.
   */
  public constructor() {
    this._state = this._loadFromStorage();
  }

  /**
   * Retrieves the ID of the last active navigation tab.
   *
   * @returns The tab identifier.
   */
  public getActiveTabId(): string {
    return this._state.activeTabId;
  }

  /**
   * Persists the ID of the currently active navigation tab.
   *
   * @param tabId - The unique identifier of the tab.
   */
  public setActiveTabId(tabId: string): void {
    this._state.activeTabId = tabId;

    this._saveToStorage();
  }

  /**
   * Retrieves the last selected benchmark difficulty.
   *
   * @returns The difficulty tier.
   */
  public getBenchmarkDifficulty(): DifficultyTier {
    return this._state.benchmarkDifficulty;
  }

  /**
   * Persists the selected benchmark difficulty.
   *
   * @param difficulty - The difficulty tier to save.
   */
  public setBenchmarkDifficulty(difficulty: DifficultyTier): void {
    this._state.benchmarkDifficulty = difficulty;

    this._saveToStorage();
  }

  /**
   * Retrieves whether the visual settings menu should be open.
   *
   * @returns True if the menu is open.
   */
  public getIsSettingsMenuOpen(): boolean {
    return this._state.isSettingsMenuOpen;
  }

  /**
   * Persists the open state of the visual settings menu.
   *
   * @param isOpen - The new visibility state.
   */
  public setIsSettingsMenuOpen(isOpen: boolean): void {
    this._state.isSettingsMenuOpen = isOpen;

    this._saveToStorage();
  }

  /**
   * Retrieves the last persisted scroll position of the benchmark table.
   *
   * @returns The scroll offset in pixels.
   */
  public getBenchmarkScrollTop(): number {
    return this._state.benchmarkScrollTop;
  }

  /**
   * Persists the current scroll position of the benchmark table.
   *
   * @param scrollTop - The vertical scroll offset in pixels.
   */
  public setBenchmarkScrollTop(scrollTop: number): void {
    this._state.benchmarkScrollTop = scrollTop;

    this._saveToStorage();
  }

  /**
   * Retrieves the name of the last focused scenario.
   *
   * @returns The scenario name or null if none.
   */
  public getFocusedScenarioName(): string | null {
    return this._state.focusedScenarioName;
  }

  /**
   * Persists the name of the last focused scenario.
   *
   * @param scenarioName - The name of the scenario.
   */
  public setFocusedScenarioName(scenarioName: string | null): void {
    this._state.focusedScenarioName = scenarioName;

    this._saveToStorage();
  }

  private _loadFromStorage(): AppState {
    try {
      const serializedState: string | null = localStorage.getItem(
        AppStateService._storageKey,
      );

      if (serializedState) {
        const parsedState: Partial<AppState> = JSON.parse(
          serializedState,
        ) as unknown as Partial<AppState>;

        return {
          ...this._getDefaults(),
          ...this._getValidatedState(parsedState),
        };
      }
    } catch {
      // Fallback to defaults on corruption or access error
    }

    return this._getDefaults();
  }

  private _getValidatedState(
    parsedState: Partial<AppState>,
  ): Partial<AppState> {
    const validatedState: Partial<AppState> = { ...parsedState };

    const isDifficultyValid: boolean = this._isDifficultyValid(
      parsedState.benchmarkDifficulty,
    );

    if (!isDifficultyValid) {
      delete validatedState.benchmarkDifficulty;
    }

    return validatedState;
  }

  private _isDifficultyValid(
    difficulty: unknown,
  ): difficulty is DifficultyTier {
    return (
      difficulty === "easier" ||
      difficulty === "medium" ||
      difficulty === "harder"
    );
  }

  private _getDefaults(): AppState {
    return {
      activeTabId: "nav-benchmarks",
      benchmarkDifficulty: "medium",
      isSettingsMenuOpen: false,
      benchmarkScrollTop: 0,
      focusedScenarioName: null,
    };
  }

  private _saveToStorage(): void {
    try {
      const serializedState: string = JSON.stringify(this._state);

      localStorage.setItem(AppStateService._storageKey, serializedState);
    } catch {
      // Ignore storage errors to prevent app crashes
    }
  }
}
