# System Architecture - Checkpoint 1.4

This document describes the architectural state of **Raw Output** at the end of Checkpoint 1.4 (Recent Runs UI).

## 1. High-Level Overview
Checkpoint 1.4 transitions the application from a single-card landing page to a **Dashboard Layout**. It introduces the first functional UI component for data visualization: the `RecentRunsDisplay`.

## 2. Core Components

### 2.1 Dashboard Layout ([`index.html`](../../../index.html))
The layout now uses a CSS Grid system to separate administrative controls from data displays.
- **Sidebar (`aside`)**: Contains the application title, connection status, and folder selection controls.
- **Main Panel (`main`)**: A dedicated glassmorphic container for the Recent Runs list.

### 2.2 Recent Runs Display ([`src/components/RecentRunsDisplay.ts`](../../../src/components/RecentRunsDisplay.ts))
A specialized component responsible for rendering a list of training sessions.
- **Data Driven**: Accepts `TrainingRun` objects and generates corresponding DOM elements.
- **Placeholder Engine**: Includes a generator for mock data to demonstrate the premium layout during development.

#### Component Diagram
```mermaid
graph TD
    App[src/main.ts] --> Status[ApplicationStatusDisplay]
    App --> Runs[RecentRunsDisplay]
    Runs --> Type[TrainingRun Type]
    Status --> UI_Sidebar[Sidebar Actions]
    Runs --> UI_Main[Dashboard Panel]
```
- **Entities**: [`RecentRunsDisplay`](../../../src/components/RecentRunsDisplay.ts#L3) | [`TrainingRun`](../../../src/types/training.ts#L1)

### 2.3 Application Orchestration ([`src/main.ts`](../../../src/main.ts))
The entry point has been updated to handle the dual initialization of the status display and the runs display.

#### Initialization Flow
```mermaid
sequenceDiagram
    participant S as src/main.ts
    participant D as RecentRunsDisplay
    participant A as ApplicationStatusDisplay

    S->>A: initialize()
    S->>D: initialize(mountPoint)
    S->>A: reportReady()
    S->>D: renderPlaceholders()
    Note right of D: Displays mock training data
```

## 3. Visual Specifications
- **Glassmorphism**: 12px backdrop blur with `rgba(255, 255, 255, 0.03)` background and subtle borders.
- **Typography**: Uses the 'Outfit' font family with varying weights to establish hierarchy.
- **Interactivity**: Custom scrollbar styling and hover micro-animations on list items.

## 4. Current State Machine
The application maintains the previous states but now populates UI data immediately upon reaching the `Ready` state.

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> FolderLinked: User selects folder
    Ready --> Reconnecting: Auto-start
    FolderLinked --> FolderLinked: Update data
```
- **Entities**: [`Ready`](../../../src/main.ts#L54) | [`renderPlaceholders`](../../../src/components/RecentRunsDisplay.ts#L18)
