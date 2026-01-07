import { BenchmarkDifficulty } from "../data/benchmarks";

/**
 * Encapsulates the transient UI state that should persist between sessions.
 */
export interface AppState {
  /**
   * The ID of the currently active navigation tab (e.g., 'nav-recent', 'nav-benchmarks').
   */
  activeTabId: string;

  /**
   * The last selected difficulty level in the Benchmark view.
   */
  benchmarkDifficulty: BenchmarkDifficulty;

  /**
   * Whether the visual settings menu is currently open.
   */
  isSettingsMenuOpen: boolean;
}

/**
 * Responsibility: Manage persistence of UI-related state to ensure a consistent experience across restarts.
 */
export class AppStateService {
  private static readonly _STORAGE_KEY = "raw_output_app_state";

  private _state: AppState;

  constructor() {
    this._state = this._load_from_storage();
  }

  /**
   * Retrieves the ID of the last active navigation tab.
   */
  public get_active_tab_id(): string {
    return this._state.activeTabId;
  }

  /**
   * Persists the ID of the currently active navigation tab.
   */
  public set_active_tab_id(id: string): void {
    this._state.activeTabId = id;

    this._save_to_storage();
  }

  /**
   * Retrieves the last selected benchmark difficulty.
   */
  public get_benchmark_difficulty(): BenchmarkDifficulty {
    return this._state.benchmarkDifficulty;
  }

  /**
   * Persists the selected benchmark difficulty.
   */
  public set_benchmark_difficulty(difficulty: BenchmarkDifficulty): void {
    this._state.benchmarkDifficulty = difficulty;

    this._save_to_storage();
  }

  /**
   * Retrieves whether the visual settings menu should be open.
   */
  public get_is_settings_menu_open(): boolean {
    return this._state.isSettingsMenuOpen;
  }

  /**
   * Persists the open state of the visual settings menu.
   */
  public set_is_settings_menu_open(isOpen: boolean): void {
    this._state.isSettingsMenuOpen = isOpen;

    this._save_to_storage();
  }

  private _load_from_storage(): AppState {
    try {
      const serialized_state = localStorage.getItem(
        AppStateService._STORAGE_KEY,
      );

      if (serialized_state) {
        return {
          ...this._get_defaults(),
          ...JSON.parse(serialized_state),
        };
      }
    } catch (error) {
      // Fallback to defaults on corruption or access error
    }

    return this._get_defaults();
  }

  private _get_defaults(): AppState {
    return {
      activeTabId: "nav-benchmarks",
      benchmarkDifficulty: "Medium",
      isSettingsMenuOpen: false,
    };
  }

  private _save_to_storage(): void {
    try {
      const serialized_state = JSON.stringify(this._state);

      localStorage.setItem(AppStateService._STORAGE_KEY, serialized_state);
    } catch (error) {
      // Ignore storage errors to prevent app crashes
    }
  }
}
