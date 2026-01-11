# Checkpoint 2.17.7 Architecture: Scroll Thumb Jump

This checkpoint introduces direct "jump-to-cursor" interaction for the custom scrolltrack and ensures the thumb remains vertically centered under the cursor during both initial clicks and subsequent dragging.

## 1. Scroll Interaction Overhaul

The interaction model for the benchmark view scrollbar has been transitioned from a relative drag-and-hover mechanism to an absolute positioning model during interaction.

### `BenchmarkScrollController.ts`

- **Track-Wide Interaction**: The `mousedown` event listener has been relocated from the scroll thumb to the `_hoverContainer` (which encompasses the entire visible track and its interactive margins).
- **Proportional Mapping**: The controller now calculates the desired thumb center based on the absolute `clientY` of the mouse relative to the track's viewport position.
- **Centered Dragging**: By updating the `scrollTop` based on the mouse's absolute position in every `mousemove` frame (when dragging), the thumb effectively stays "stuck" to the cursor's vertical center.
- **Boundary Clamping**: The calculated translation is strictly clamped between `0` and the `availableTrackSpan` to prevent the thumb from moving outside the designated glass "cut-out".

## 2. Refactoring for Abstraction

To adhere to the project's strict method length limits (< 20 lines) and improve maintainability, the scrolling logic was decomposed into high-level orchestrators and low-level math helpers.

### Implementation Helpers
- **`_calculateDesiredTranslation(mouseY)`**: Translates a global mouse coordinate into a track-relative translation for the thumb center.
- **`_updateScrollFromMousePosition(mouseY)`**: Orchestrates the conversion of a mouse position into a `scrollTop` value using the current scroll range and track dimensions.
- **`_getAvailableTrackSpan()`**: Provides the total vertical distance the thumb can travel within the "hole-in-glass".
- **`_getTotalScrollRange()`**: Calculates the difference between `scrollHeight` and `clientHeight`.

## 3. Aesthetic Persistence

The hover-follow behavior (where the thumb glides to meet the cursor when nearby, as introduced in earlier checkpoints) has been preserved.

- **`_evaluateHoverScrolling`**: Continues to detect proximity and apply a delta-based scroll shift when the mouse is NOT clicked.
- **Cursor State**: The `pointer` cursor is maintained for the entire track area to signal interactivity.

## 4. Technical Debt Mitigation

During the build and verification process, several unused dependencies and field declarations were removed to maintain a clean codebase and resolve lint errors.

- **`BenchmarkSettingsController.ts`**: Removed internal references to `_sessionSettingsService` and `SessionSettings` which were unused after recent UI refactoring.
- **`SettingsUiFactory.ts`**: Corrected a specific call to `_applyTransitionToItem` that had a legacy argument signature.
