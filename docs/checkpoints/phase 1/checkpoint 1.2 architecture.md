# System Architecture - Checkpoint 1.2

This document describes the architectural state of **Raw Output** at the end of Checkpoint 1.2 (Folder Picker Connectivity).

## 1. High-Level Overview
Checkpoint 1.2 introduces interactivity via the **File System Access API**. The architecture is extended with a service-oriented layer to handle persistent browser permissions and directory navigation.

## 2. Core Components

### 2.1 The Interface ([`index.html`](../index.html))
The UI now includes an interactive action layer:
- **Link Button**: A [`#link-folder-button`](../index.html#L109) with premium hover/active states.
- **Folder Status**: A [`#folder-status`](../index.html#L110) display area that dynamically updates upon successful link.

#### Component Diagram
```mermaid
graph TD
    UI[index.html] --> Main[src/main.ts]
    Main --> Disp[ApplicationStatusDisplay]
    Main --> Serv[DirectoryAccessService]
    Serv -->|Web API| FS[File System Access API]
    Disp -->|Updates| UI
```
- **Entities**: [`index.html`](../index.html) | [`src/main.ts`](../src/main.ts) | [`DirectoryAccessService`](../src/services/DirectoryAccessService.ts#L6)

### 2.2 Directory Access Layer ([`src/services/DirectoryAccessService.ts`](../src/services/DirectoryAccessService.ts))
A dedicated service for managing folder handles.
- **`requestDirectoryLink()`**: Triggers the OS folder picker.
- **Type Safety**: Supported by custom definitions in [`src/types/fileSystem.d.ts`](../src/types/fileSystem.d.ts).

#### Connectivity Flow
```mermaid
sequenceDiagram
    participant U as User
    participant B as link-folder-button
    participant S as src/main.ts
    participant D as DirectoryAccessService
    participant API as showDirectoryPicker()

    U->>B: Clicks Button
    B->>S: Emits Click Event
    S->>D: calls requestDirectoryLink()
    D->>API: Invokes Browser API
    API-->>U: Shows OS Folder Picker
    U-->>API: Selects Folder
    API-->>D: Returns FileSystemDirectoryHandle
    D-->>S: Returns Handle
    S->>S: calls reportFolderLinked(handle.name)
```
- **Entities**: [`link-folder-button`](../index.html#L109) | [`DirectoryAccessService`](../src/services/DirectoryAccessService.ts#L6)
- **Messages**: [`requestDirectoryLink()`](../src/services/DirectoryAccessService.ts#L13) | [`showDirectoryPicker()`](../src/types/fileSystem.d.ts#L10) | [`reportFolderLinked()`](../src/main.ts#L20)

## 3. Current State Machine
The application now supports two primary states.

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> FolderLinked: User selects folder
    FolderLinked --> FolderLinked: Change folder
```
- **Entities**: [`Ready`](../src/main.ts#L12) | [`FolderLinked`](../src/main.ts#L20)
- **Transitions**: [`User selects folder`](../src/main.ts#L42)
