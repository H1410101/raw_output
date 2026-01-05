# Technical Architecture

## Language and Framework
- **Language**: TypeScript
- **Frontend Framework**: (Likely React or Next.js, to be confirmed)
- **Styling**: Vanilla CSS or a modern utility-first framework for premium aesthetics.

## Browser APIs
- **File System Access API**: The core of the application, used to read the Kovaak's stats directory.
- **IndexedDB**: Used for persisting file handles and caching parsed data to avoid re-parsing large amounts of history on every load.
- **Web Workers**: (Potential) To handle heavy CSV parsing tasks off the main thread, ensuring the UI remains fluid.

## Data Schema
- **Scenario Record**: 
    - `id`: Unique identifier
    - `name`: Scenario name (matched to Viscose Benchmark list)
    - `score`: Raw score
    - `accuracy`: Percentage
    - `timestamp`: Date and time of completion
    - `isThresholdMet`: Boolean flag based on the scenario's defined repeatable standard
    - `metrics`: Supplementary data (EMA, Median, and trailing averages)

## Security & Privacy
- **Client-Side Operations**: All parsing and storage happen strictly in the browser.
- **No Backend Store**: No user data is sent to a centralized server, eliminating the risk of data breaches.
- **Handle Expiry**: Browser security policies require users to re-verify directory access periodically; Raw Output should handle these prompts gracefully.
