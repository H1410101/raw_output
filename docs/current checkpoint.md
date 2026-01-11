# Current Checkpoint - Refine Scrollbar Interaction

## Goal
Implement "jump-to-cursor" behavior for the custom scrollbar on the benchmark view and ensure the thumb remains centered under the cursor during clicks and drags.

## Changes
- **BenchmarkScrollController.ts**:
    - Updated `_setupDragInteraction` to listen for `mousedown` on the `_hoverContainer` (track area) instead of just the thumb.
    - Implemented `_handleTrackMousedown` to trigger an immediate jump to the clicked position.
    - Simplified `_handleGlobalMouseMove` to use absolute positioning (centering the thumb on the cursor) during drag.
    - Refactored scroll calculation logic into several helper methods (`_updateScrollFromMousePosition`, `_calculateDesiredTranslation`, `_getAvailableTrackSpan`, etc.) to keep method lengths strictly under 20 lines.
    - Removed unused fields and legacy methods.
- **BenchmarkSettingsController.ts**:
    - Removed unused `_sessionSettingsService` and `SessionSettings` type to resolve lint errors after logic changes.
- **SettingsUiFactory.ts**:
    - Fixed a call to `_applyTransitionToItem` with an incorrect argument count.

## Verification
- Ran `npm run build` successfully.
- Logic ensures thumb center aligns with `event.clientY` (clamped to track bounds).
- Hover-follow behavior in `_evaluateHoverScrolling` remains intact.