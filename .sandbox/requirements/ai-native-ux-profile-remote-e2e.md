# Requirement: Remote AI-Native UX Profile Creation

## Scope

Verify the deployed Proposal Autopilot application creates and activates an AI-Native UX positioning profile from the supplied positioning. The validation targets only the `proposal-autopilot` EasyPanel frontend and backend.

## Input source

The exact positioning source is `positioning.md` at the repository root. It defines the offer, target client, six proof stories, and proposal voice rules.

## Acceptance criteria

1. The profile-creation UI is available from a clean browser session.
2. The supplied positioning is entered and the application generates the profile configuration.
3. The generated profile includes the supplied offer, target client, proof stories, and voice rules.
4. Activating the profile closes the creation flow and the active-profile indicator shows the newly generated profile.
5. A backend read confirms the active profile is persisted in PostgreSQL, rather than browser-only storage.
6. The remote UI captures visual checkpoints for the creation screen, generated preview, and activated profile.
7. The remote run does not access or alter any EasyPanel project other than `proposal-autopilot`.

## Required runtime values

The remote runner receives `AI_NATIVE_UX_POSITIONING` from `positioning.md`. The declarative API assertion reads only the same selected frontend origin's `/api/config/workspace` path and requires the activated persisted profile, at least six proof stories, and at least one voice rule.
