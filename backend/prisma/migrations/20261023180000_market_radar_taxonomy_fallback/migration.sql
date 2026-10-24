-- Ensure unmatched jobs always have a safe, explicit taxonomy destination.
INSERT INTO "market_taxonomy_nodes" (
    "id",
    "source",
    "slug",
    "name",
    "kind",
    "parent_id",
    "taxonomy_version",
    "metadata",
    "is_active",
    "created_at",
    "updated_at"
)
VALUES (
    '3f6e6c21-3a43-4c37-9f51-6c8d02c9d8e4',
    'CUSTOM',
    'other-services',
    'Other digital services',
    'OCCUPATION',
    (SELECT "id" FROM "market_taxonomy_nodes" WHERE "slug" = 'digital-services'),
    1,
    '{"seed":"market-taxonomy-v1","fallback":true,"classification":{"includeTerms":[]}}'::jsonb,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
    "source" = 'CUSTOM',
    "name" = 'Other digital services',
    "kind" = 'OCCUPATION',
    "parent_id" = (SELECT "id" FROM "market_taxonomy_nodes" WHERE "slug" = 'digital-services'),
    "taxonomy_version" = 1,
    "metadata" = '{"seed":"market-taxonomy-v1","fallback":true,"classification":{"includeTerms":[]}}'::jsonb,
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;
