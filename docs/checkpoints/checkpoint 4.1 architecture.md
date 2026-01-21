# Checkpoint 4.1 Architecture: Ranked Session State & Structure

## Gist
Checkpoint 4.1 established the foundation for the "Ranked Runs" feature. This involved creating the `RankedSessionService` to manage deterministic sequences of scenarios, tracking session lifecycle with unique IDs, and implementing a "Gauntlet" system where users complete an initial set of scenarios before entering an infinite progression loop. The UI was updated to provide guided navigation and prevent users from getting lost during their ranked sessions.

## Core Components

### RankedSessionService
The central orchestrator for ranked sessions.
- **State Management**: Persists session state (status, sequence, current index, difficulty) to `localStorage`.
- **Deterministic Sequences**: Uses a custom `Prng` seeded with the session start time and difficulty to ensure repeatable sequences if needed (though currently used to generate fresh ones).
- **Gauntlet Logic**: Enforces a 3-scenario "initial gauntlet" before allowing free progression.
- **Session Identity**: Generates a unique `rankedSessionId` to group scores for telemetry and session analysis.

### RankedView UI
The interface for interacting with ranked sessions.
- **Guided Navigation**: Highlights the "Next" scenario and dims others to guide the user through the gauntlet.
- **Summary State**: Displays an overall session rank summary upon completion of the initial gauntlet.
- **Dynamic Difficulty**: Syncs selected difficulty across views to maintain consistency.

## Data Flow
1. **Start**: User selects a difficulty and clicks "Start Ranked Session".
2. **Generation**: `RankedSessionService` generates an initial 3-scenario sequence.
3. **Play**: User plays the current scenario; `SessionService` records scores.
4. **Advance**: User manually advances to the next scenario in the sequence.
5. **Completion**: After 3 scenarios, the "Gauntlet Complete" state is triggered, showing a summary.
6. **Extension**: User can choose to "Continue" which extends the session indefinitely, one scenario at a time.

## Refinements & Fixes
- **UI Consistency**: Fixed navigation button styling for active/inactive states.
- **Regression Testing**: Added tests for difficulty tab synchronization to prevent future breakages in cross-view state.
