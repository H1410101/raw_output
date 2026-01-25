# External Documentation

## External Interactions Diagram

```mermaid
graph TD
    subgraph "Root"
        Vitest[vitest.config.ts]
    end

    subgraph "src/test"
        Setup[setup.ts]
    end

    Vitest -->|Configures| Setup
```

## Exposed Internal API

### `setup.ts`
Global test setup file executed before each test suite.
- **Environment**: Configures JSDOM extensions (e.g. `canvas` mock).
- **Cleanups**: Resets all mocks between tests to ensure isolation.
- **Extensions**: Adds custom matchers if any.

# Internal Documentation

## Internal Interactions Diagram

```mermaid
graph TD
    subgraph "src/test"
        Setup[setup.ts]
        subgraph "mocks"
            FSMocks[fileSystemMocks.ts]
        end
    end
```

## Internal Files and API

- `mocks/`: Specialized mocks for browser APIs (like File System Access API) that JSDOM doesn't support natively.
