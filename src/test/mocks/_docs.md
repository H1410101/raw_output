# External Documentation

## External Interactions Diagram

```mermaid
graph LR
    subgraph "Test Suites"
        Tests[*.test.ts]
    end

    subgraph "src/test/mocks"
        FSMocks[fileSystemMocks.ts]
    end

    Tests -->|Import| FSMocks
```

## Exposed Internal API

### `fileSystemMocks.ts`
Provides mock implementations for the Browser File System Access API.
- **Classes**: `MockFileSystemHandle`, `MockFileSystemDirectoryHandle`, `MockFileSystemFileHandle`.
- **Usage**: Used when testing services that interact with local files (e.g., `DirectoryAccessService`, `RunIngestionService`).

# Internal Documentation

## Internal Interactions Diagram

```mermaid
graph TD
    subgraph "src/test/mocks"
        FSMocks[fileSystemMocks.ts]
    end
```

## Internal Files and API

### `fileSystemMocks.ts`
Implements a simplified in-memory version of the file system handles.
- **Async Iterators**: Correctly mocks `values()` and `entries()` as async generators.
- **Permission State**: Mocks `queryPermission` and `requestPermission` to always return 'granted' by default or be configurable.
