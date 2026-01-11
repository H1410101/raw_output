# Checkpoint 2.14.2 Architecture: ESLint Setup

## Overview
This checkpoint establishes the automated enforcement of the project's strict coding standards. By integrating ESLint with specialized TypeScript and JSDoc plugins, the system will programmatically validate architectural constraints that were previously maintained manually.

## Linting Strategy

### 1. Structural Constraints
The configuration enforces the "short method" philosophy through multiple layers:
- **`max-lines-per-function`**: Set to 20 lines (ignoring blanks/comments) to ensure methods remain focused.
- **`no-multiple-empty-lines`**: Limited to allow for the 4-group maximum structure within functions.
- **`padding-line-between-statements`**: Mandates blank lines before returns to separate logic from output.

### 2. Naming & Accessibility
Automated enforcement of the "Self-Explanatory" principle:
- **`@typescript-eslint/naming-convention`**: Enforces the `_` prefix for private members and prohibits it for public ones.
- **`@typescript-eslint/explicit-member-accessibility`**: Requires explicit `public` or `private` modifiers on all class members.
- **`id-length`**: Prevents overly cryptic variable names (min 3 chars), with specific exceptions for mathematical/iterator conventions (`i`, `j`, `x`, `y`, etc.).

### 3. Type Safety & Documentation
Hardening the TypeScript implementation:
- **`@typescript-eslint/explicit-function-return-type`**: Forces explicit intent for all function outputs.
- **`@typescript-eslint/no-explicit-any`**: Hard ban on type escaping.
- **`jsdoc/require-jsdoc`**: Configured for `publicOnly` mode to ensure the public API is documented while allowing private helpers to remain self-documenting through naming.

## Integration & Workflow
- **`eslint.config.js`**: Uses the flat config format for compatibility with modern ESLint (v9+).
- **TypeScript Parser**: Connected to `tsconfig.json` to allow rules that require type information (like `prefer-readonly`).
- **NPM Scripts**: Added `lint` and `lint:fix` commands to the developer workflow.

## Compliance Constraints
- Any code failing the 20-line limit must be refactored into helpers.
- Comments are strictly forbidden except for JSDoc on public class/interface members.
- Every variable must have an explicit type, even if it could be inferred, to maintain the "No Surprises" readability standard.
