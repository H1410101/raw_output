interface AppState {
  activeTabId: string;
  benchmarkDifficulty: BenchmarkDifficulty;
}

export class AppStateService {
  private static readonly _STORAGE_KEY = "app_state";
  private _state: AppState;

  constructor() {
    this._state = this._load_from_storage();
  }

  public get_active_tab_id(): string { ... }
  public set_active_tab_id(id: string): void { ... }
  
  public get_benchmark_difficulty(): BenchmarkDifficulty { ... }
  public set_benchmark_difficulty(difficulty: BenchmarkDifficulty): void { ... }

  private _load_from_storage(): AppState { ... }
  private _save_to_storage(): void { ... }
}
```

### VisualSettingsService & SessionSettingsService
These services already implement `localStorage` persistence in their constructors and update methods. No structural changes are required, but their integration will be verified.

## 3. UI Integration

### Navigation Restoration
The `setupNavigation` logic in `main.ts` will be refactored to:
1. Initialize the UI based on the `activeTabId` retrieved from `AppStateService`.
2. Update the service whenever a navigation button is clicked.

### Benchmark View Restoration
The `BenchmarkView` will be updated to:
1. Initialize its internal `_activeDifficulty` from `AppStateService` on construction.
2. Update `AppStateService` whenever the user switches difficulty tabs.

## 4. Initialization Flow

1. **Service Instantiation**: `AppStateService` loads the last known state from `localStorage`.
2. **Main Application Logic**: 
   - `BenchmarkView` is instantiated, pulling its initial difficulty from `AppStateService`.
   - `setupNavigation` is called, which checks `AppStateService` to determine which view and button should be marked as active/visible.
3. **User Interaction**: Any changes to tabs or difficulty levels are immediately persisted back to `localStorage` via the service.