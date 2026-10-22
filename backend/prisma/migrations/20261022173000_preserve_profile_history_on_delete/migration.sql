-- Historical evaluations and proposals outlive the editable profile that created them.
-- SetNull retains those records while allowing a profile to be removed.
ALTER TABLE "fit_evaluations"
  DROP CONSTRAINT IF EXISTS "fit_evaluations_positioning_profile_id_fkey";

ALTER TABLE "fit_evaluations"
  ADD CONSTRAINT "fit_evaluations_positioning_profile_id_fkey"
  FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposals"
  DROP CONSTRAINT IF EXISTS "proposals_positioning_profile_id_fkey";

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_positioning_profile_id_fkey"
  FOREIGN KEY ("positioning_profile_id") REFERENCES "positioning_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
