# Raw Output - Project Roadmap

## Phase 1: The Core Engine (Foundation & Monitoring)

### Checkpoint 1.1: Project Initialization (Done)
### Checkpoint 1.2: Folder Picker Connectivity (Done)
### Checkpoint 1.3: Session Persistence (Done)
### Checkpoint 1.4: Recent Runs UI (Done)
### Checkpoint 1.5: Static CSV Parsing (Done)
### Checkpoint 1.6: Deep Directory Discovery (Done)
### Checkpoint 1.7: Real-time File Ingestion (Done)

## Phase 2: Benchmark Table

### Checkpoint 2.1: Benchmark Filtering (Done)
### Checkpoint 2.2: Benchmark View & Data Loading (Done)
### Checkpoint 2.3: Benchmark Categories & Layout (Done)
### Checkpoint 2.4: Rank Tags (Done)
### Checkpoint 2.5: Scenario Launch Interactions (Done)
### Checkpoint 2.6: Live Session Best (Done)
### Checkpoint 2.7: New Runs View (Done)
### Checkpoint 2.8: Visualization & Fluid Typography (Done)
### Checkpoint 2.8.1: Dot Cloud Vertical Alignment Refinement (Done)
### Checkpoint 2.9: Visual Settings Placeholder (Done)
### Checkpoint 2.10: Visual Settings Wiring (Done)
### Checkpoint 2.11: Session Interval Settings (Done)
### Checkpoint 2.11.1: Reactive Session Expiration (Done)
### Checkpoint 2.12: Inter-session Behaviour (Done)
### Checkpoint 2.13: Visual & Tactile Identity (Done)
### Checkpoint 2.13.1: Background Dynamics (Done)
### Checkpoint 2.13.2: Scroll Track Cut-out (Done)
### Checkpoint 2.13.3: Colour & Transparency Tuning (Done)
### Checkpoint 2.14.0: Technical Debt Payoff I (Done)
### Checkpoint 2.14.1: Technical Debt Payoff II (Done)
### Checkpoint 2.14.2: ESLint Setup (Done)
### Checkpoint 2.15: Visual Tuning Refinement (Done)

### Checkpoint 2.16: Visual and Tactile Polish

#### Checkpoint 2.16.0: Auto Focus Run (Done)
- **Deliverable**: New runs refresh the benchmark row, and automatically scroll so that it is centered.
- **Commit Goal**: Doing a new Kovaak's run automatically makes the UI jump to the appropriate difficulty, and scrolls so that the session rank is shown.

#### Checkpoint 2.16.1: Settings Cleanup & Refinement (Done)
- **Deliverable**: Visual setting renames and slider tactile improvements.
- **Commit Goal**: Audio placeholder slider uses 10% increments, and settings are reorganized for better clarity.

#### Checkpoint 2.16.2: Lazy Re-rendering Fixes (Done)
- **Deliverable**: Resolved synchronization issues in dot cloud rendering.
- **Commit Goal**: Dot clouds re-render reliably and efficiently when settings or data change.

#### Checkpoint 2.16.3: Settings Functionality (Done)
- **Deliverable**: Functional implementation of remaining placeholder settings.
- **Commit Goal**: Settings like Master Scaling and audio placeholders are wired to functional systems.

#### Checkpoint 2.16.4: Dot Cloud Spread (Done)
- **Deliverable**: Refined dot cloud distribution logic.
- **Commit Goal**: The spread of performance dots is tuned for better readability and aesthetic balance.

#### Checkpoint 2.16.5: Horizontal Scaling (Done)
- **Deliverable**: Dynamic horizontal scale adjustment for exceeded ranks.
- **Commit Goal**: When performance exceeds the highest rank, the horizontal scale adjusts so the highest score is near the right edge.

#### Checkpoint 2.16.6: Stable Dot Cloud (Done)
- **Deliverable**: Fixed visual jitter and z-ordering in dot cloud.
- **Commit Goal**: Dots use timestamps for jitter seeding to prevent "shuffling", and the latest score is always rendered on top.

#### Checkpoint 2.16.7: Dot Cloud Selection Highlights Fix (Done)
- **Deliverable**: Corrected color transitions for selected rows.
- **Commit Goal**: Metadata and dots transition correctly between lower-band and upper-band palettes upon selection.

#### Checkpoint 2.16.8: Centralized Colour Palette (Done)
- **Deliverable**: Decoupled color palette and strict linting.
- **Commit Goal**: All color literals are moved to `src/styles/palette.css`, and color usage is strictly enforced.

#### Checkpoint 2.16.9: Settings Refinement & Auto-Dismissal (Done)
- **Deliverable**: Unified settings sections and reactive dismissal.
- **Commit Goal**: Settings are reorganized into "Elements", session intervals are configurable, and settings auto-close on new scores.

#### Checkpoint 2.16.10: Persist Scroll with Auto-Jump (Done)
- **Deliverable**: Scroll position persistence and intelligent focus transitions.
- **Commit Goal**: The application remembers its scroll position across view changes and intelligently jumps to relevant scenarios.

#### Checkpoint 2.16.11: Navigation Consolidation & Slider Polish (Done)
- **Deliverable**: Simplified navigation, dynamic benchmarks, and slider animation fixes.
- **Commit Goal**: Recent/New views are removed, difficulty tabs are dynamic, and volume slider animations are corrected.

#### Checkpoint 2.16.12: Header Layout & Scroll Precision (Done)
- **Deliverable**: Centered navigation, "Not Soon" styling, and synchronized custom scrollbars.
- **Commit Goal**: Navigation is centered, "Not Soon" has non-interactive hover states, and scroll thumbs are perfectly aligned across all views.

#### Checkpoint 2.16.13: Visual Rounding Consistency (Done)
- **Deliverable**: Harmonized border-radius between settings menu and benchmark table.
- **Commit Goal**: Settings menu rounding is updated to 1rem to match the benchmark table source of truth.

#### Checkpoint 2.16.14: Reactive Title Glow (Done)
- **Deliverable**: Subtle glow shadow behind the "Raw Output" title that reacts to background ripples.
- **Commit Goal**: The application title exhibits a dynamic glow in sync with the background grid's ripple effects.

### Checkpoint 2.17: UI Redesign & Navigation

#### Checkpoint 2.17.0: Triple Action Header (Done)
- **Deliverable**: Updated header with three action buttons.
- **Commit Goal**: Top right header contains folder, theme, and settings buttons in that order.

#### Checkpoint 2.17.1: Advanced Folder Settings View (Done)
- **Deliverable**: Two-column layout for folder configuration.
- **Commit Goal**: Folder settings are presented in a clear, two-column interface.

#### Checkpoint 2.17.2: Dual Theme Support (Done)
- **Deliverable**: Implementation of Light Mode alongside Dark Mode.
- **Commit Goal**: The application supports switching between light and dark themes.

#### Checkpoint 2.17.3: UI & Navigation Consolidation (Done)
- **Deliverable**: Combined implementation of unit linting, dynamic label sizing, theme fine-tuning, folder refinement, and glass aesthetic scaling.
- **Commit Goal**: Codebase is linted for rem units, labels scale without clipping, interaction states are unified, and glass panels/scrollbars respond dynamically to vertical density.

#### Checkpoint 2.17.4: Advanced Rank Visualization & Data Refinement (Done)
- **Deliverable**: Implementation of the "All-Rank" performance display, interactive UX refinements for popup stability, and the standardization of benchmark data.
- **Commit Goal**: Users can see all rank thresholds via a stable, interactive popup, and benchmark data is cleaned of individual highscore columns.

#### Checkpoint 2.17.5: Dynamic Benchmark Ordering (Done)
- **Deliverable**: The ability to sort or reorder benchmarks dynamically based on performance or manual configuration.
- **Commit Goal**: Benchmark list order responds to dynamic criteria beyond lexicographical sorting.

#### Checkpoint 2.17.6: Margin Spacing & Dashboard Fitting (Done)
- **Deliverable**: Implement "Margin Spacing" setting and make the dashboard panel fit the application container with dynamic padding.
- **Commit Goal**: Dashboard panel fills available space, and a new "Margin Spacing" setting controls internal and external density.

#### Checkpoint 2.17.7: Scroll Thumb Jump (Done)
- **Deliverable**: Interactive scrollbar track that jumps the view directly to the clicked position.
- **Commit Goal**: Clicking the scrollbar track moves the scroll thumb and view content to that exact proportional height, with centered dragging behavior.

#### Checkpoint 2.17.8: Strategic Introduction placement (Done)
- **Deliverable**: Relocation of application introduction and setup instructions behind the primary title button.
- **Commit Goal**: The main title acts as a gateway to the introduction text, cleaning up the primary dashboard real estate.

### Checkpoint 2.18: Tactical Launch Button & Visual ID (Done)
- **Deliverable**: Hold-to-confirm launch button and standardized sphere/dent lighting model.
- **Commit Goal**: Interactive launch button with 2x regeneration and directional inset shadows for all dot elements.

#### Checkpoint 2.18.1: About Popup Content & Refinement (Done)
- **Deliverable**: Populated "About" popup with premium styling, button-style links, and social icons.
- **Commit Goal**: High-fidelity content integration with stabilized tactical link buttons and corrected AI references.

### Checkpoint 2.19: SFX Identity (Done)
- **Deliverable**: Sound effects for relevant interactions.
- **Commit Goal**: The application has a distinctive sound bank that matches the theme.

## Phase 3: Cloudflare Analytics & Session Pulse
- **Goal**: Collect anonymous session statistics to balance benchmark ranks and understand device distribution.

### Checkpoint 3.1: Edge infrastructure & Handshake (Done)
- **Deliverable**: Wrangler initialization, D1 database creation, and a "Health Check" endpoint.

### Checkpoint 3.2: Identity & Privacy Layer (Done)
- **Deliverable**: `DeviceIdentifierService` for local UUIDs and the "Anonymous Analytics" toggle in Settings.

### Checkpoint 3.3: Session Pulse & D1 Integration (Done)
- **Deliverable**: Integration with `SessionService` to sync highscores to D1 via the Pulse API.

### Checkpoint 3.4: Telemetry Reliability & Robustness
- **Deliverable**: Session persistence, Telemetry Outbox for retries, and anonymous date tracking.
- **Commit Goal**: v3.4 tag ensures no data loss on refresh/failure.

### Checkpoint 3.5: Production Deployment
- **Deliverable**: Git connection to Cloudflare Pages and remote database migration.

## Phase 4: Ranked Runs

### Checkpoint 4.1: Ranked Session State & Structure (Done)
- **Deliverable**: Core `RankedSessionService`, One-time Gauntlet, Cyclic Scenarios, and UI State.
- **Commit Goal**: v4.1 tag establishes the backend and basic UI for ranked runs.

### Checkpoint 4.2: HUD & Progress Visualization (Done)
- **Deliverable**: HUD Timer, Progress Bar, and Daily Rank Decay Logic.
### Checkpoint 4.3: Rank Estimator & Prediction Math (Done)
### Checkpoint 4.4: Ranked UI Zen & Symmetry (Done)
- **Deliverable**: Pixel-perfect centering, icon-based controls, and layout stability.
### Checkpoint 4.5: HUD Integration & Live Feedback
### Checkpoint 4.6: Scenario Transitions & Flow
### Checkpoint 4.6: Target Bar & HUD Visuals
### Checkpoint 4.7: Audio Feedback
### Checkpoint 4.8: Visual System Unification & Theme
### Checkpoint 4.9: Infinite Progression
### Checkpoint 4.10: Final Polish & Verification

## Phase 5: Focus-Based Dynamics

### Checkpoint 5.1: Dynamic Rank Indicator
### Checkpoint 5.2: Window Focus Awareness
### Checkpoint 5.3: Focus-Delayed Animations
### Checkpoint 5.4: Rank Up Ceremony
### Checkpoint 5.5: Infinite Progression Polish

## Phase 6: Ecosystem & Analytics (Refined)

### Checkpoint 6.1: Warm-up Analysis
### Checkpoint 6.2: Rank Distribution Visuals
