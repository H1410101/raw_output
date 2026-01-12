# Master Behavior Document - Raw Output

This document aggregates all developer-requested behaviors for the Raw Output web application, using a strict **hierarchical identity system** to categorize assertions.

---

## 1. Header (identity: `header`)

### 1.1 Title (identity: `header.title`)
#### 1.1.1 User Perspective / Externals (identity: `header.title.ext`)
- **header.title.ext.viewport**: The "Raw Output" title remains strictly within the top 25% and left 25% of the browser viewport.
- **header.title.ext.alignment**: The left edge of the "Raw Output" text is perfectly vertically aligned with the left edge of the benchmark dashboard glass pane.
- **header.title.ext.click**: Clicking the "Raw Output" title reveals the "About" introduction popup.

#### 1.1.2 Internals (identity: `header.title.int`)
- **header.title.int.mount**: The title is rendered inside a container with the class `app-title-container`.
- **header.title.int.audio**: Clicking the title button triggers an `AudioService.playHeavy()` call.

### 1.2 Navigation (identity: `header.nav`)
#### 1.2.1 User Perspective / Externals (identity: `header.nav.ext`)
- **header.nav.ext.symmetry**: The left edge of the "Benchmarks" button and the right edge of the "Ranked" button are exactly equidistant from the horizontal center of the screen.
- **header.nav.ext.scaling**: Increasing UI scale grows text and spacing proportionally without slot overlap.

#### 1.2.2 Internals (identity: `header.nav.int`)
- **header.nav.int.grid**: The `.app-header` implements a `display: grid` with `grid-template-columns: 1fr auto 1fr`.
- **header.nav.int.centering**: Slot 2 of the header grid contains the `nav-menu`, ensuring it is mathematically centered.

### 1.3 Controls (identity: `header.ctrl`)
#### 1.3.1 User Perspective / Externals (identity: `header.ctrl.ext`)
- **header.ctrl.ext.order**: The Action Group buttons (Top Right) follow the exact left-to-right order: **Folder Access**, **Theme Toggle**, **Settings**.
- **header.ctrl.ext.status**: The Folder icon is Cyan when connected and pulses Orange/Red when permission is pending.

#### 1.3.2 Internals (identity: `header.ctrl.int`)
- **header.ctrl.int.ids**: Button IDs are strictly mapped: `header-folder-btn`, `header-theme-btn`, `header-settings-btn`.
- **header.ctrl.int.pulse_logic**: The pulse animation is tied to the permission state `prompt`.

---

## 2. Data Lifecycle (identity: `data`)

### 2.1 Connectivity (identity: `data.conn`)
#### 2.1.1 User Perspective / Externals (identity: `data.conn.ext`)
- **data.conn.ext.reconnect**: Upon application reload, previous folder links are restored automatically.

#### 2.1.2 Internals (identity: `data.conn.int`)
- **data.conn.int.suffix**: `DirectoryAccessService` automatically appends `/Kovaaks/ExternalData/stats` when searching.
- **data.conn.int.storage**: Handles are stored in IndexedDB `DirectoryHandles` with key `activeDirectoryHandle`.

---

## 3. Dashboard (identity: `dash`)

### 3.1 Table Behavior (identity: `dash.table`)
#### 3.1.1 User Perspective / Externals (identity: `dash.table.ext`)
- **dash.table.ext.scroll_memory**: Switching difficulty tabs restores the exact previous `scrollTop` for that tab.
- **dash.table.ext.focus_pulse**: New scores cause the row to highlight/breathe for 2 seconds.

#### 3.1.2 Internals (identity: `dash.table.int`)
- **dash.table.int.state**: `AppStateService` stores `scrollTop` indexed by `DifficultyTier`.
- **dash.table.int.intelligent_scroll**: Auto-scroll is skipped if the row is already fully visible in the viewport.

### 3.2 Dot Cloud Rendering (identity: `dash.dots`)
#### 3.2.1 User Perspective / Externals (identity: `dash.dots.ext`)
- **dash.dots.ext.stability**: Dots must remain at constant coordinates across re-renders; no "jumping" jitter.

#### 3.2.2 Internals (identity: `dash.dots.int`)
- **dash.dots.int.jitter_seed**: Vertical jitter must use `ScoreEntry.timestamp` as the random seed.
- **dash.dots.int.z_indexing**: `DotCloudCanvasRenderer` renders the newest score (index 0) last.

---

## 4. Session Management (identity: `session`)

### 4.1 Logic & Timing (identity: `session.logic`)
#### 4.1.1 User Perspective / Externals (identity: `session.logic.ext`)
- **session.logic.ext.badge_expiration**: "Session Best" badges disappear automatically when the inactivity interval elapses.

#### 4.1.2 Internals (identity: `session.logic.int`)
- **session.logic.int.preservation**: Expired data remains in memory to support re-acquisition if timeout is increased.

---

## 5. Sensory Identity (identity: `ui`)

### 5.1 Scroll Layout (identity: `ui.scroll`)
#### 5.1.1 User Perspective / Externals (identity: `ui.scroll.ext`)
- **ui.scroll.ext.symmetry**: The visual gaps on both sides of the scroll trench must look identical.
- **ui.scroll.ext.jump**: Clicking the track jumps the thumb to that Y-coordinate.

#### 5.1.2 Internals (identity: `ui.scroll.int`)
- **ui.scroll.int.symmetry_math**: `Dist(Row.Right, Hole.Left) === Dist(Hole.Right, Panel.Right)` (tolerance < 0.1px).
- **ui.scroll.int.drag_centering**: Thumb stays centered under the mouse cursor during dragging.

### 5.2 Auditory Feedback (identity: `ui.audio`)
#### 5.2.1 User Perspective / Externals (identity: `ui.audio.ext`)
- **ui.audio.ext.tactile**: Moving mouse over categories produces a distinct "tick" sound.

#### 5.2.2 Internals (identity: `ui.audio.int`)
- **ui.audio.int.throttle**: `AudioService` enforces a 40ms silence between ticks.

### 5.3 UI Scaling (identity: `ui.scale`)
#### 5.3.1 User Perspective / Externals (identity: `ui.scale.ext`)
- **ui.scale.ext.responsive**: Changing `--ui-scale` or `--margin-spacing-multiplier` in `:root` immediately updates container padding and font sizes.

#### 5.3.2 Internals (identity: `ui.scale.int`)
- **ui.scale.int.variable_prop**: The `.container` padding is mathematically derived from `1.5rem * var(--margin-spacing-multiplier)`.
- **ui.scale.int.font_prop**: Root `font-size` is derived from `calc(...) * var(--ui-scale)`.

## 6. Engineering Constraints (identity: `eng`)

### 6.1 Code Standards (identity: `eng.code`)
#### 6.1.1 Internals (identity: `eng.code.int`)
- **eng.code.int.method_cap**: Methods must be strictly < 20 lines.
- **eng.code.int.typing**: Shorthand array syntax (`type[]`) is mandatory.

---

[End of Document]
