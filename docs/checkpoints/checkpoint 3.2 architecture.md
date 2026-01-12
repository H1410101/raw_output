# Checkpoint 3.2 Architecture: Identity & Privacy Layer

Implemented a privacy-first identity system to support anonymous analytics without compromising user data.

## Core Components

### 1. IdentityService
- **Purpose**: Manages the local lifecycle of the anonymous Device identifier.
- **Persistence**: Uses `localStorage` to maintain a stable UUID across restarts.
- **Consent**: Tracks the "Anonymous Analytics" opt-in status.

### 2. UI Integration
- **Settings**: Added a toggle for "Anonymous Analytics" in the Elements section.
- **Security**: Ensures no telemetry is sent unless the user has explicitly granted consent.

## Data Model
- **Device ID**: A standard v4 UUID generated on the client.
- **Privacy Setting**: A boolean flag stored alongside the ID.

## Verification
- Verified that toggling the setting correctly enables/disables the `IdentityService` reporting capability.
