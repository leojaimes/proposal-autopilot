# Universal Website Studio Verification Requirement

## Objective
Verify the end-to-end integration of the Automated Deep Cloning Pipeline with the Universal Website Studio in `proposal-autopilot` (:7001) connected to `publications` backend (:3007).

## Acceptance Criteria
1. The Studio modal loads cleanly when passing `?studio=<slug>`.
2. The center canvas renders the reconstructed live preview iframe.
3. The left blocks panel displays all parsed semantic sections (`HEADER`, `HERO`, `SERVICES`, `WHY_US`, `FOOTER`).
4. The R2 assets tab displays extracted WebP assets deduplicated and categorized by taxonomy (`branding`, `hero`, `content`).
5. Section inspection supports real-time editing and asset comparison.
