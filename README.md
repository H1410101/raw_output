# Raw Output

**Live Website:** [rawoutput.net](https://rawoutput.net)

A TypeScript-based web application for real-time monitoring and analysis of Kovaak's Aim Trainer statistics using the File System Access API.

## Documentation

Core documentation can be found in the `docs` folder:

- [Vision & Concept](docs/vision.md): High-level mission and target audience.
- [System Workflow](docs/workflow.md): How the app interacts with the local file system.
- [Ranked Mechanics](docs/ranked_mechanics.md): Detailed mathematical specification for the ranked mode.
- [Database Schema](docs/database_schema.md): Data persistence layout and schema definitions.

### Developer Documentation

This project follows an **Embedded Documentation** strategy. Detailed technical documentation is located directly alongside the code it describes. 

Look for `_docs.md` files within the `src` directories (e.g., `src/components/_docs.md`) for:
- **API Barriers**: Explanations of how external code interacts with the directory.
- **Architectural Diagrams**: Visualizations of internal relationships and control flow.
- **Sub-module Context**: Details on immediate children and their responsibilities.

## Getting Started

Follow these steps to run the project locally:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Access the App**:
   Open [http://localhost:5173](http://localhost:5173) in your browser.