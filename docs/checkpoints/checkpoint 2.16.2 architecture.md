# Checkpoint 2.16.2 Architecture: Lazy Dot Cloud Synchronization

## 1. Objective
Address and resolve synchronization issues and rendering artifacts within the Dot Cloud visualization. The focus is on ensuring that the Canvas-based dots react instantly and accurately to both data updates (new runs) and setting changes (opacity, jitter, highlights) without leaving orphaned elements or displaying stale data.

## 2. Identified Issues
- **Rendering Latency**: A noticeable delay between a setting change (e.g., toggling "Highlight Latest Run") and the visual update on the Canvas.
- **Canvas Orphans**: In specific re-render scenarios, multiple Canvas elements may be appended to the same container, or old frames may not be fully cleared.
- **State Mismatch**: The "latest run" logic occasionally highlights the wrong dot if the history array is updated while a render cycle is in progress.

## 3. Technical Strategy

### 3.1 Lifecycle Management
The `DotCloudComponent` will implement a more rigorous `requestAnimationFrame` (rAF) loop management system:
- **Explicit Disposal**: Every redraw request will first check for a pending frame and cancel it to prevent race conditions.
- **Container Sanitization**: The component will ensure the DOM container is cleared of any legacy Canvas elements before a new renderer is initialized.

### 3.2 Reactive Triggering
The component will be updated to subscribe more granularly to state changes:
- **Setting-Specific Redraws**: Instead of a global "update" call, the renderer will differentiate between changes that require a full layout recalculation (e.g., bounds mode) versus those that only require a visual repaint (e.g., opacity).
- **Data-Driven invalidation**: When `HistoryService` emits a new score event, the `DotCloudComponent` will invalidate its internal cache and force a high-priority redraw.

### 3.3 Canvas Buffer Optimization
- **ClearRect Enforcement**: Ensure `context.clearRect` covers the full pixel-ratio-adjusted dimensions of the canvas at the start of every `draw()` call.
- **Snapshot Logic**: For "Aligned" scaling modes, the renderer will snapshot the vertical rank intervals to prevent "jumping" dots during rapid scrolling or window resizing.

## 4. Component Refinements

### 4.1 `DotCloudComponent.ts`
- Introduce a `private _isDirty: boolean` flag to batch multiple setting updates into a single frame.
- Add a `destroy()` method to cleanly unbind listeners and cancel animation frames when a benchmark row is recycled.

### 4.2 `DotCloudCanvasRenderer.ts`
- Refactor the drawing loop to take a `RenderContext` object, ensuring all parameters used for the draw (opacity, colors, data) are captured at the moment the frame is requested.

## 5. Verification Plan
- [ ] Verify that rapidly toggling "Highlight Latest Run" does not cause flickering or multiple highlights.
- [ ] Confirm that resizing the window results in smooth, correctly-scaled dot clouds without "orphaned" canvas artifacts at the edges.
- [ ] Verify that doing a new run instantly updates the specific scenario row's dot cloud with the new data point.
