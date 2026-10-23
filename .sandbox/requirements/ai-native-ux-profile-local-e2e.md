# Requirement: Local AI-Native UX Profile Creation

## Scope

Verify the local Proposal Autopilot stack can synthesize, activate, and persist the AI-Native UX positioning profile from `positioning.md`. This run is confined to `http://localhost:7001` and its local PostgreSQL database.

## Acceptance criteria

1. The profile-creation flow opens from a clean browser session.
2. The exact `positioning.md` content is supplied to the synthesis flow.
3. The generated preview is visible before activation.
4. Activating the profile persists an active profile with at least six proof stories and at least one voice rule.
5. The active-profile indicator is visible after the modal closes.
6. The run never targets EasyPanel, production, staging, or any other project.

## Runtime input

`AI_NATIVE_UX_POSITIONING` must contain the full contents of `positioning.md`.
