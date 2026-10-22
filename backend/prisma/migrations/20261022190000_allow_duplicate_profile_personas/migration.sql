-- A persona label is editable display text, not an identity. Synthesized profiles
-- carry their own UUID so multiple runs with the same AI-derived name coexist.
DROP INDEX IF EXISTS "positioning_profiles_tenant_id_persona_name_key";
