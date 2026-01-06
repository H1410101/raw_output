# Checkpoint 2.5 Architecture: Scenario Launch Interactions

This checkpoint introduces the ability for users to launch Kovaak's scenarios directly from the Benchmark Table, closing the loop between data analysis and practice.

## URI Scheme Integration

The primary mechanism for launching scenarios is the Kovaak's custom URI scheme. This allows the application to trigger game actions through the browser.

### URI Structure
The application constructs URIs using the following format:
`steam://run/824270/?action=jump-to-scenario;name=${encodedName};mode=challenge`

-   **App ID**: `824270` (Kovaaks)
-   **Action**: `jump-to-scenario`
-   **Name**: The URL-encoded scenario name.
-   **Mode**: Hardcoded to `challenge` to ensure the user is placed in the ranked environment.

## Component Interactions

### BenchmarkView Implementation
The `BenchmarkView` class is responsible for generating the interaction elements within each scenario row.

-   **`_createPlayButton`**: A private helper method that creates a button element. It prevents event propagation to avoid triggering row selection when the user intends to launch the game.
-   **`_launchScenario`**: A dedicated method that performs the URL encoding and assigns the URI to `window.location.href`.

## UI Design

### Action Column
Each row in the benchmark table now terminates with a "Play" action.

-   **Visual Affordance**: The button uses a consistent "Action" style, designed to be accessible without distracting from the rank data.
-   **Tooltip**: Hovering over the button provides a dynamic tooltip: `Launch [Scenario Name]`.
-   **Placement**: Positioned at the far right of the `row-right-content` container for easy mouse access during rapid browsing.

## Execution Flow
1.  **User Click**: User clicks the "Play" button on a specific scenario row.
2.  **Propagation Stop**: The click event is captured and prevented from bubbling to the row container.
3.  **Encoding**: The scenario name (e.g., "VT 1w2ts") is URL-encoded (e.g., "VT%201w2ts").
4.  **Redirection**: The browser attempts to navigate to the `steam://` URI.
5.  **OS Hand-off**: The Operating System intercepts the URI and passes the command line arguments to the Kovaak's executable (via Steam).