# Checkpoint 2.18 Architecture: Tactical Launch Button & Visual ID

This checkpoint introduces a "Tactical" interaction model for scenario launching and refines the visual language of the application's dot-based UI elements.

## Tactical Launch Button
The launch button in the benchmark view has been upgraded to a "hold-to-confirm" interaction.

### Visual Structure
- **Socket**: A concave (dented) circular background.
- **Triangle**: A classic play icon, optimized for the 1rem button size (0.3rem x 0.5rem).
- **Sphere Dot**: A convex (sphere) glow dot that appears on hover, covering the socket.
- **Healthbar**: A progress bar container that sits above the button.

### Logic & Interaction (`BenchmarkRowRenderer.ts`)
- **Hold Mechanism**:
    - `mousedown`: Initiates depletion (600ms total).
    - `mouseup`/`mouseleave`: Initiates regeneration at 2x depletion speed.
- **Healthbar Visibility**:
    - Only visible when not full (`holdProgress < 100`) AND hovering.
    - Upon full regeneration, stays visible for a **0.3s pause** before fading out.
    - Immediate fade on `mouseleave`.
- **Completion**:
    - On full depletion, triggers `_launchKovaksScenario` (Steam URI launch).
    - Applies a `highlighted` class for visual feedback.

## Visual Identity Refinement (`index.html`)
The application's lighting model for dot elements has been standardized to create a physical "sphere" and "recessed" look.

### Concave "Dent" Effect
Used for empty sockets and dull dots.
- **Shadow**: `inset 0.15rem 0.15rem` (top-left dark).
- **Highlight**: `inset -0.1rem -0.1rem` (bottom-right light).

### Convex "Sphere" Effect
Used for glowing dots, pills, and the hover-state launch dot.
- **Highlight**: `inset 0.1rem 0.1rem` (top-left bright).
- **Shadow**: `inset -0.15rem -0.15rem` (bottom-right dark).

### UI Scaling
- Base launch button size reduced to **1rem**.
- All dot components respect the `--launch-button-multiplier` and the global `--ui-scale`.
- Settings notches (active) now use solid fill without shadows for a cleaner tactical look.

## Performance & Optimization
- Timer management refactored to use a centralized `clearTimers` helper.
- Overlapping regeneration and depletion cycles are robustly handled.
- State-based CSS triggers (`.not-full`, `.holding`, `.highlighted`) minimize JS-driven style updates.
