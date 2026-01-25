# External Documentation

## External Interactions Diagram

```mermaid
graph TD
    subgraph "Test Suite"
        Test[Test File]
    end

    subgraph "Infrastructure"
        Factory[MockServiceFactory]
        Mocks[Service Mocks]
    end

    subgraph "Target"
        CUT[Component Under Test]
    end

    Test -->|Uses| Factory
    Test -->|Instantiates| CUT
    Factory -->|Creates| Mocks
    CUT -->|Consumes| Mocks
```

## Exposed Internal API

### `MockServiceFactory`
A centralized class for creating standard, composable mocks for services like `BenchmarkService`, `RankEstimator`, and `AppStateService`.
- **Purpose**: Reduces boilerplate and ensures consistent mock behavior across tests.

### `_waitForSelector`
A helper function to wait for elements to appear in the JSDOM, essential for async rendering cycles.

# Internal Documentation

## Internal Interactions Diagram

```mermaid
graph TD
    subgraph "Internal Infrastructure"
        Factory[MockServiceFactory]
        Helpers[Test Helpers]
    end
    
    Factory -->|Uses| Helpers
```

## Internal Files and API

To ensure consistency and reduce boilerplate, tests should utilize the centralized mock factory.

### Abstracting Test Logic

As per the "Abstraction and Composition" principle, repetitive test setup and assertion logic should be extracted into helper functions (prefixed with `_`) within the test file or moved to a shared utility if used across multiple files.

#### Example Refactoring

Before:
```typescript
it("should test something", () => {
    const dep1 = { ... };
    const dep2 = { ... };
    const view = new View(dep1, dep2);
    // ... many lines of DOM setup
});
```

After:
```typescript
it("should test something", async () => {
    const deps = MockServiceFactory.createViewDependencies();
    const view = await _mountView(deps);
    _assertCorrectState(view);
});
```
