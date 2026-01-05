# Raw Output - Project Roadmap

This roadmap outlines the development phases for **Raw Output**. Each checkpoint is a commit-sized unit of work with a **verifiable, user-observable outcome**.

---

## Phase 1: The Core Engine (Foundation & Monitoring)
**Focus**: Establishing the technical bedrock and the "Zero Manual Effort" promise.

### Checkpoint 1.1: Project Initialization
- **Deliverable**: A configured Vite + TypeScript environment.
- **Commit Goal**: Running `npm run dev` serves a page displaying the "Raw Output" title and a "Ready" status.

### Checkpoint 1.2: Folder Picker Connectivity
- **Deliverable**: File System Access API integration.
- **Commit Goal**: Clicking a "Link Stats Folder" button opens the native OS folder picker and displays the selected folder's name on the UI.

### Checkpoint 1.3: Static CSV Parsing
- **Deliverable**: Kovaak's CSV parsing logic.
- **Commit Goal**: Manually selecting a single `.csv` file via the UI displays its Scenario Name, Score, and Date in a "Recent Runs" list.

### Checkpoint 1.4: Real-time File Ingestion
- **Deliverable**: Directory monitoring loop.
- **Commit Goal**: Dropping a new CSV into the linked folder automatically adds a new entry to the "Recent Runs" list without a page refresh.

---

## Phase 2: Domain Intelligence (Benchmark Logic & Persistence)
**Focus**: Integrating Viscose Benchmark rules and local data retention.

### Checkpoint 2.1: Scenario Identification
- **Deliverable**: Viscose Benchmark lookup table.
- **Commit Goal**: Parsed runs are visually tagged as either "Benchmark" or "Custom" based on the official Viscose scenario list.

### Checkpoint 2.2: Session Persistence
- **Deliverable**: IndexedDB storage layer.
- **Commit Goal**: Refreshing the browser preserves the folder link and the history of previously detected runs.

### Checkpoint 2.3: Threshold Validation
- **Deliverable**: Score-to-Threshold comparison logic.
- **Commit Goal**: Benchmark runs display a green "Threshold Met" badge if the score meets the scenario's repeatable standard.

---

## Phase 3: The Pulse (Analytics & Rank Decay)
**Focus**: Visualizing long-term consistency and the "rust" factor.

### Checkpoint 3.1: Premium Layout & Aesthetics
- **Deliverable**: Glassmorphic UI implementation.
- **Commit Goal**: The application displays a multi-pane layout (Sidebar/Dashboard) with modern typography and semi-transparent "glass" cards.

### Checkpoint 3.2: Rank-Decay (Rust) Visualization
- **Deliverable**: Decay algorithm implementation.
- **Commit Goal**: Scenarios not played for over 48 hours display a "Rusting" icon and a reduced "Current Skill Level" bar.

### Checkpoint 3.3: Consistency Trending
- **Deliverable**: EMA (Exponential Moving Average) charting.
- **Commit Goal**: Selecting a scenario opens a chart showing the raw score vs. the EMA trend line over time.

---

## Phase 4: Growth Engine (Weakness Targeting & Polish)
**Focus**: Proactive training guidance and performance scaling.

### Checkpoint 4.1: Weakness Analytics
- **Deliverable**: Data analysis engine.
- **Commit Goal**: A "Training Priorities" panel lists the three benchmark scenarios with the highest decay or worst threshold consistency.

### Checkpoint 4.2: Interactive Recommendations
- **Deliverable**: Recommendation UI.
- **Commit Goal**: A "Suggest Scenario" button selects and highlights a specific scenario's card based on identified weaknesses.

### Checkpoint 4.3: Background Indexing
- **Deliverable**: Web Worker integration.
- **Commit Goal**: The UI remains responsive (running a smooth micro-animation) while the app parses a folder containing 1,000+ historical logs.
