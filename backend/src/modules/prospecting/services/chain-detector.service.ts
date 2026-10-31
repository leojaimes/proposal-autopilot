import { Injectable, Logger } from '@nestjs/common';
import { BusinessOwnershipType } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { KNOWN_CORPORATE_BRANDS } from '../constants/corporate-brands.constants';
import {
  isSocialOrDirectoryDomain,
  validateExternalBusinessUrlSync,
} from '../utils/url-safety.util';

export interface ChainDetectionInput {
  tenantId: string;
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  category?: string | null;
}

export interface ChainDetectionResult {
  ownershipType: BusinessOwnershipType;
  corporateBrandId: string | null;
  brandName: string | null;
  branchIdentifier: string | null;
  rootDomain: string | null;
  isChain: boolean;
  detectionSource: 'CATALOG_BRAND' | 'ROOT_DOMAIN_CLUSTER' | 'BRANCH_SYNTAX' | 'INDEPENDENT';
}

interface CachedBrandEntry {
  id?: string;
  slug: string;
  name: string;
  normalizedName: string;
  rootDomain?: string | null;
}

const BRANCH_SYNTAX_REGEX =
  /\b(?:sucursal|suc\.|branch|plaza|mall|centro comercial|galer[ií]as|aeropuerto|terminal|altabrisa|harbor|la isla|perisur|andares|unicentro|santaf[eé]|sede|unidad|tienda\s*#?\d+|#\s*\d+)\b.*$/i;

const CORPORATE_HQ_REGEX = /\b(?:corporativo|oficinas?\s+centrales|headquarters|matriz\s+corporativa)\b/i;

@Injectable()
export class ChainDetectorService {
  private readonly logger = new Logger(ChainDetectorService.name);
  private cachedBrands: CachedBrandEntry[] | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache(): void {
    this.cachedBrands = null;
    this.cacheExpiresAt = 0;
  }

  extractBranchSyntax(rawName: string): { rootBrandName: string; branchIdentifier: string | null } {
    const trimmed = (rawName || '').trim();
    const match = trimmed.match(BRANCH_SYNTAX_REGEX);
    if (!match || match.index === undefined) {
      return { rootBrandName: trimmed, branchIdentifier: null };
    }

    const prefix = trimmed
      .slice(0, match.index)
      .replace(/[-–—|,:]+$/, '')
      .trim();
    const suffix = match[0].trim();

    if (prefix.length < 3) {
      return { rootBrandName: trimmed, branchIdentifier: null };
    }

    return {
      rootBrandName: prefix,
      branchIdentifier: suffix,
    };
  }

  async resolveChainHierarchy(input: ChainDetectionInput): Promise<ChainDetectionResult> {
    const urlCheck = validateExternalBusinessUrlSync(input.websiteUrl);
    const corporateRootDomain =
      urlCheck.rootDomain && !isSocialOrDirectoryDomain(urlCheck.rootDomain)
        ? urlCheck.rootDomain
        : null;

    const { rootBrandName, branchIdentifier } = this.extractBranchSyntax(input.name);
    const normalizedFull = this.normalizeText(input.name);
    const normalizedRoot = this.normalizeText(rootBrandName);
    const isHq = CORPORATE_HQ_REGEX.test(input.name);

    const brands = await this.loadBrands();

    // Layer 1: Exact root domain match or catalog brand match
    let matchedCatalog = corporateRootDomain
      ? brands.find((b) => b.rootDomain && b.rootDomain.toLowerCase() === corporateRootDomain)
      : undefined;

    if (!matchedCatalog) {
      matchedCatalog = brands.find((b) => {
        if (!b.normalizedName || b.normalizedName.length < 3) return false;
        return (
          normalizedFull === b.normalizedName ||
          normalizedRoot === b.normalizedName ||
          normalizedFull.startsWith(`${b.normalizedName} `) ||
          normalizedRoot.startsWith(`${b.normalizedName} `)
        );
      });
    }

    if (matchedCatalog) {
      const persistedBrandId = await this.ensureBrandPersistedAndIncrement(
        matchedCatalog,
        corporateRootDomain,
        input.category,
      );
      return {
        ownershipType: isHq ? BusinessOwnershipType.CORPORATE_HQ : BusinessOwnershipType.CHAIN_BRANCH,
        corporateBrandId: persistedBrandId,
        brandName: matchedCatalog.name,
        branchIdentifier,
        rootDomain: corporateRootDomain ?? matchedCatalog.rootDomain ?? null,
        isChain: true,
        detectionSource: 'CATALOG_BRAND',
      };
    }

    // Layer 2: Multi-branch clustering by shared corporate rootDomain across distinct placeIds
    if (corporateRootDomain) {
      const siblingCount = await this.countDistinctSiblingLocations(
        input.tenantId,
        corporateRootDomain,
        input.placeId,
      );

      if (siblingCount >= 1) {
        const slug = this.slugify(rootBrandName || corporateRootDomain.split('.')[0]);
        const clusterBrandId = await this.upsertClusterBrand({
          slug,
          name: rootBrandName || corporateRootDomain,
          rootDomain: corporateRootDomain,
          industry: input.category || undefined,
          branchCount: siblingCount + 1,
        });

        // Promote existing sibling(s) to CHAIN_BRANCH under the newly discovered parent
        await this.promoteSiblingsByDomain(input.tenantId, corporateRootDomain, clusterBrandId);

        return {
          ownershipType: isHq
            ? BusinessOwnershipType.CORPORATE_HQ
            : BusinessOwnershipType.CHAIN_BRANCH,
          corporateBrandId: clusterBrandId,
          brandName: rootBrandName || corporateRootDomain,
          branchIdentifier,
          rootDomain: corporateRootDomain,
          isChain: true,
          detectionSource: 'ROOT_DOMAIN_CLUSTER',
        };
      }
    }

    // Layer 3: Explicit multi-branch naming syntax ("Sucursal ...", "Branch #2")
    if (branchIdentifier && /\b(?:sucursal|suc\.|branch|sede|tienda\s*#?\d+|#\s*\d+)\b/i.test(branchIdentifier)) {
      const slug = this.slugify(rootBrandName);
      const syntaxBrandId = await this.upsertClusterBrand({
        slug,
        name: rootBrandName,
        rootDomain: corporateRootDomain,
        industry: input.category || undefined,
        branchCount: 1,
      });

      return {
        ownershipType: BusinessOwnershipType.CHAIN_BRANCH,
        corporateBrandId: syntaxBrandId,
        brandName: rootBrandName,
        branchIdentifier,
        rootDomain: corporateRootDomain,
        isChain: true,
        detectionSource: 'BRANCH_SYNTAX',
      };
    }

    return {
      ownershipType: BusinessOwnershipType.INDEPENDENT,
      corporateBrandId: null,
      brandName: null,
      branchIdentifier,
      rootDomain: corporateRootDomain,
      isChain: false,
      detectionSource: 'INDEPENDENT',
    };
  }

  private async loadBrands(): Promise<CachedBrandEntry[]> {
    const now = Date.now();
    if (this.cachedBrands && now < this.cacheExpiresAt) {
      return this.cachedBrands;
    }

    try {
      const dbBrands = await this.prisma.corporateBrand.findMany();
      if (dbBrands.length > 0) {
        this.cachedBrands = dbBrands.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          normalizedName: this.normalizeText(b.name),
          rootDomain: b.rootDomain,
        }));
        this.cacheExpiresAt = now + 5 * 60 * 1000;
        return this.cachedBrands;
      }
    } catch (err: any) {
      this.logger.debug(`Falling back to in-memory corporate brands seed: ${err?.message}`);
    }

    return KNOWN_CORPORATE_BRANDS.map((b) => ({
      slug: b.slug,
      name: b.name,
      normalizedName: this.normalizeText(b.name),
      rootDomain: b.rootDomain,
    }));
  }

  private async ensureBrandPersistedAndIncrement(
    entry: CachedBrandEntry,
    rootDomain: string | null,
    industry?: string | null,
  ): Promise<string | null> {
    try {
      const record = await this.prisma.corporateBrand.upsert({
        where: { slug: entry.slug },
        create: {
          slug: entry.slug,
          name: entry.name,
          rootDomain: entry.rootDomain || rootDomain || undefined,
          industry: industry || undefined,
          isKnownFranchise: true,
          totalBranchesTracked: 1,
        },
        update: {
          totalBranchesTracked: { increment: 1 },
        },
      });
      return record.id;
    } catch {
      return entry.id ?? null;
    }
  }

  private async countDistinctSiblingLocations(
    tenantId: string,
    rootDomain: string,
    currentPlaceId?: string | null,
  ): Promise<number> {
    try {
      return await this.prisma.prospectedBusiness.count({
        where: {
          tenantId,
          rootDomain,
          ...(currentPlaceId ? { NOT: { placeId: currentPlaceId } } : {}),
        },
      });
    } catch {
      return 0;
    }
  }

  private async upsertClusterBrand(params: {
    slug: string;
    name: string;
    rootDomain: string | null;
    industry?: string;
    branchCount: number;
  }): Promise<string | null> {
    try {
      const existing = params.rootDomain
        ? await this.prisma.corporateBrand.findUnique({ where: { rootDomain: params.rootDomain } })
        : await this.prisma.corporateBrand.findUnique({ where: { slug: params.slug } });

      if (existing) {
        const updated = await this.prisma.corporateBrand.update({
          where: { id: existing.id },
          data: {
            totalBranchesTracked: Math.max(existing.totalBranchesTracked + 1, params.branchCount),
          },
        });
        this.invalidateCache();
        return updated.id;
      }

      const created = await this.prisma.corporateBrand.create({
        data: {
          slug: `${params.slug}-${Date.now().toString(36).slice(-4)}`,
          name: params.name.slice(0, 150),
          rootDomain: params.rootDomain || undefined,
          industry: params.industry,
          isKnownFranchise: false,
          totalBranchesTracked: params.branchCount,
        },
      });
      this.invalidateCache();
      return created.id;
    } catch {
      return null;
    }
  }

  private async promoteSiblingsByDomain(
    tenantId: string,
    rootDomain: string,
    corporateBrandId: string | null,
  ): Promise<void> {
    if (!corporateBrandId) return;
    try {
      await this.prisma.prospectedBusiness.updateMany({
        where: {
          tenantId,
          rootDomain,
          ownershipType: BusinessOwnershipType.INDEPENDENT,
        },
        data: {
          ownershipType: BusinessOwnershipType.CHAIN_BRANCH,
          corporateBrandId,
        },
      });
    } catch {
      // Safe no-op in isolated unit mocks
    }
  }

  private normalizeText(input: string): string {
    return (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private slugify(input: string): string {
    return (
      this.normalizeText(input)
        .replace(/\s+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'brand'
    );
  }
}

