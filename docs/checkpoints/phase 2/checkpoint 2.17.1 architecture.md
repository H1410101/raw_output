```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.1 architecture.md#L1-43
# Checkpoint Architecture 2.17.1: Advanced Folder Settings View

## Purpose
The goal of this checkpoint is to implement a new "Folder Settings" view that replaces the standard benchmark table under specific conditions. This view provides a user-friendly introduction to the application alongside essential folder management actions, improving the onboarding experience and clarifying the application's connection status.

## Components

### 1. `FolderSettingsView`
A new UI component responsible for rendering the two-column layout:
- **Left Column**: Centered vertical display of the folder link status and related actions. Spacing is dynamic, scaling off 0.5rem (actions) and 0.7rem (status) base distances, affected by master and vertical scaling.
- **Right Column**: A vertically centered introduction and setup guide. This section is designed to fit without scrolling.

### 2. `BenchmarkView` Logic Update
The `BenchmarkView` will be updated to act as a conditional router:
- It will monitor the folder connection status via `DirectoryAccessService` and `HistoryService`.
- It will track a "Manual Folder Menu" state triggered by the header's folder icon.
- If no folder is connected, or if stats cannot be found, it will automatically display the `FolderSettingsView`.
- If the folder icon in the header is pressed, it will toggle the `FolderSettingsView`.

### 3. State Management
- **Scroll Persistence**: When switching from the benchmark table to the folder view due to a connection loss, the current scroll position and active difficulty will be remembered.
- **View Recovery**: Once a folder is connected or the manual menu is closed, the view will restore the previous scroll position or default to the first (leftmost) benchmark if no previous state exists.
- **Auto-Dismissal**: Any successful folder-related action (like linking a folder) will automatically exit the folder menu and return to the benchmark view.

## Styling
- The layout will use CSS Grid or Flexbox to achieve the two-column split.
- Actions and status spacing are reactive to Master Scaling and Vertical Scaling settings.
- The introduction column is vertically centered and does not implement custom scrollbars, unlike the benchmark table.

## Transitions
- The switch between the Benchmark Table and the Folder Settings View will be immediate or involve a subtle fade to maintain the "fluid" identity of the application.
