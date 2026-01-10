```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.3 architecture.md#L1-28
# Checkpoint 2.17.3 Architecture: Scaling Unit Linting

## Responsibility
To maintain a fluid and responsive UI, we must enforce the use of relative units (`rem`, `vw`, `vh`) or functional percentages over absolute units (`px`). This ensures that the application scales correctly across different resolutions and user-defined `ui-scale` settings.

## Implementation Strategy

### 1. Static Analysis Tooling
- **Script**: `scripts/verify_scaling.js`
- **Mechanism**: A Node.js script that scans the codebase for CSS length literals ending in `px`.
- **Scope**: Includes `.css`, `.ts`, `.tsx`, and `.html` files within the `src` directory and the root `index.html`.
- **Exceptions**:
    - Border widths of `1px` (standard hairline borders).
    - Coordinates used for off-screen positioning (e.g., `-1000px`, `-2000px`) where absolute scale is irrelevant.
    - `0px` (though `0` is preferred).
    - `1px` or `2px` for subtle box shadows or inner glows.

### 2. CI/CD Integration
- Added to `package.json` as `lint:scaling`.
- Integrated into the pre-commit hook via `husky` to prevent non-compliant units from entering the repository.

### 3. Regex Definition
The script uses a regex to find violations: `/(?<!-)\b(?<!\d)(\d+)(px)\b/gi`.
- Negative lookbehind ensures we don't flag negative coordinates used for hiding elements.
- Captures positive pixel values that should be converted to `rem` (calculated as `px / 16`).
