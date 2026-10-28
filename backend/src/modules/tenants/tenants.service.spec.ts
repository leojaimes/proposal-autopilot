import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { TenantsService } from './tenants.service';

test('deleting a profile clears only historical profile links before removing it', async () => {
  const calls: string[] = [];
  const tenantId = 'tenant-1';
  const deletedProfileId = 'profile-old';
  const nextProfileId = 'profile-next';
  const tx = {
    positioningProfile: {
      findMany: async () => [
        { id: deletedProfileId, isActive: true },
        { id: nextProfileId, isActive: false },
      ],
      findFirst: async () => ({ id: nextProfileId, tenantId, searchKeywords: [] }),
      update: async ({ where }: any) => { calls.push(`activate:${where.id}`); },
      delete: async ({ where }: any) => { calls.push(`delete:${where.id}`); },
    },
    fitEvaluation: {
      updateMany: async ({ data, where }: any) => { calls.push(`fit:${where.positioningProfileId}:${data.positioningProfileId}`); },
    },
    proposal: {
      updateMany: async ({ data, where }: any) => { calls.push(`proposal:${where.positioningProfileId}:${data.positioningProfileId}`); },
    },
    scrapeConfig: {
      findFirst: async () => null,
      create: async () => { calls.push('scrape-config:create'); },
    },
  };
  const prisma = {
    $transaction: async (work: any) => work(tx),
    tenant: {
      findUnique: async () => ({ positioningProfiles: [], scrapeConfigs: [], credentials: [] }),
    },
  };
  const service = new TenantsService(prisma as any, {} as any);

  await service.deleteProfile(tenantId, deletedProfileId);

  assert.deepEqual(calls, [
    `activate:${nextProfileId}`,
    'scrape-config:create',
    `fit:${deletedProfileId}:null`,
    `proposal:${deletedProfileId}:null`,
    `delete:${deletedProfileId}`,
  ]);
});

test('profile deletion migration preserves historical evaluations and proposals', async () => {
  const migration = await readFile(
    resolve(__dirname, '../../../prisma/migrations/20261022173000_preserve_profile_history_on_delete/migration.sql'),
    'utf8',
  );
  assert.match(migration, /fit_evaluations_positioning_profile_id_fkey[\s\S]*ON DELETE SET NULL/u);
  assert.match(migration, /proposals_positioning_profile_id_fkey[\s\S]*ON DELETE SET NULL/u);
});

test('getProfileCv returns stored baseCv or default template', async () => {
  const tenantId = 'tenant-1';
  const profileId = 'profile-1';
  const prismaWithCv = {
    positioningProfile: {
      findFirst: async () => ({ id: profileId, baseCv: { slug: 'ats-cv', name: 'Custom ATS CV' } }),
    },
  };
  const service = new TenantsService(prismaWithCv as any, {} as any);
  const cv = await service.getProfileCv(tenantId, profileId);
  assert.equal(cv.name, 'Custom ATS CV');
  assert.equal(cv.slug, 'ats-cv');
});

test('updateProfileCv persists baseCv JSON in positioningProfile', async () => {
  const tenantId = 'tenant-1';
  const profileId = 'profile-1';
  let savedData: any = null;
  const prisma = {
    positioningProfile: {
      findFirst: async () => ({ id: profileId }),
      update: async ({ data }: any) => {
        savedData = data;
        return { id: profileId, baseCv: data.baseCv };
      },
    },
  };
  const service = new TenantsService(prisma as any, {} as any);
  const res = await service.updateProfileCv(tenantId, profileId, {
    name: 'Updated Leonardo CV ATS',
    slug: 'ats-cv',
    css: '',
    translations: {} as any,
  });
  assert.equal(res.success, true);
  assert.equal(savedData.baseCv.name, 'Updated Leonardo CV ATS');
});
