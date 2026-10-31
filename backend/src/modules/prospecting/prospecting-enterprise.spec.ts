import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  BusinessOwnershipType,
  CompanyPainCategory,
  ContactChannel,
  ContactOutcome,
  EmailDeliverabilityStatus,
  EmailDeliveryEvent,
  PhoneLineType,
  ProspectedLeadStatus,
  RecipientRole,
} from '@prisma/client';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { TenantMiddleware } from '../../core/middleware/tenant.middleware';
import { AdminRoleGuard } from '../../core/guards/admin-role.guard';
import { HmacWebhookGuard } from './guards/hmac-webhook.guard';
import {
  isPrivateOrReservedIp,
  validateExternalBusinessUrlSync,
} from './utils/url-safety.util';
import { PhoneNormalizerService } from './services/phone-normalizer.service';
import { ChainDetectorService } from './services/chain-detector.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { ContactCooldownPolicyService } from './services/contact-cooldown.service';

const TEST_JWT_SECRET = 'unit_test_jwt_secret_2026_enterprise';
const TEST_LAMBDA_SECRET = 'unit_test_lambda_hmac_secret_2026';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const makeMockConfig = (values: Record<string, string>): ConfigService =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('Geo-Radar Enterprise Security, Domain & CRM Suite', () => {
  describe('1. Zero-Trust TenantMiddleware & AdminRoleGuard (SEC-01..04, SEC-15..16)', () => {
    const tenantContext = new TenantContextService();
    const jwtService = new JwtService({ secret: TEST_JWT_SECRET });
    const configService = makeMockConfig({
      JWT_SECRET: TEST_JWT_SECRET,
      DEFAULT_TENANT_ID: TENANT_A,
    });
    const middleware = new TenantMiddleware(tenantContext, jwtService, configService);
    const adminGuard = new AdminRoleGuard(tenantContext);

    it('SEC-01 & SEC-02: Accepts valid signed JWT and populates authenticated context', (_, done) => {
      const token = jwtService.sign({
        sub: 'user-owner-1',
        tenantId: TENANT_A,
        email: 'owner@spotlightus.org',
        role: 'OWNER',
      });

      const req: any = {
        originalUrl: '/api/prospecting/leads',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A,
        },
      };

      middleware.use(req, {} as any, () => {
        assert.equal(tenantContext.getTenantId(), TENANT_A);
        assert.equal(tenantContext.isAuthenticated(), true);
        assert.equal(tenantContext.getUserRole(), 'OWNER');
        assert.equal(adminGuard.canActivate({} as any), true);
        done();
      });
    });

    it('SEC-03: Rejects forged unsigned Base64 JWT with 401 Unauthorized', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ tenantId: TENANT_B, role: 'OWNER' })).toString(
        'base64url',
      );
      const forgedToken = `${header}.${payload}.forged_sig`;

      const req: any = {
        originalUrl: '/api/prospecting/leads',
        headers: { authorization: `Bearer ${forgedToken}` },
      };

      assert.throws(() => middleware.use(req, {} as any, () => {}), UnauthorizedException);
    });

    it('SEC-04: Blocks cross-tenant X-Tenant-Id header spoofing with 403 Forbidden (Anti-IDOR)', () => {
      const tokenTenantA = jwtService.sign({
        sub: 'user-1',
        tenantId: TENANT_A,
        email: 'user@tenanta.com',
        role: 'OWNER',
      });

      const req: any = {
        originalUrl: '/api/prospecting/leads',
        headers: {
          authorization: `Bearer ${tokenTenantA}`,
          'x-tenant-id': TENANT_B, // Attempting to access Tenant B's leads
        },
      };

      assert.throws(() => middleware.use(req, {} as any, () => {}), ForbiddenException);
    });

    it('SEC-15 & SEC-16: AdminRoleGuard blocks unauthenticated or non-admin users', async () => {
      await tenantContext.runWithContext(
        { tenantId: TENANT_A, role: 'MEMBER', isAuthenticated: true },
        async () => {
          assert.throws(() => adminGuard.canActivate({} as any), ForbiddenException);
        },
      );

      await tenantContext.runWithContext(
        { tenantId: TENANT_A, isAuthenticated: false },
        async () => {
          assert.throws(() => adminGuard.canActivate({} as any), ForbiddenException);
        },
      );
    });
  });

  describe('2. Fail-Closed HMAC Webhook Guard & Anti-Replay (SEC-05..09)', () => {
    const reflector = {
      get: () => 'LAMBDA',
    } as unknown as Reflector;
    const config = makeMockConfig({
      LAMBDA_WEBHOOK_SECRET: TEST_LAMBDA_SECRET,
      NODE_ENV: 'production',
    });
    const guard = new HmacWebhookGuard(reflector, config);

    const buildExecutionContext = (headers: Record<string, string>, rawBodyStr: string): any => ({
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          rawBody: Buffer.from(rawBodyStr, 'utf8'),
          body: JSON.parse(rawBodyStr),
        }),
      }),
    });

    it('SEC-05: Allows valid UTF-8 rawBody HMAC-SHA256 signature within replay window', () => {
      const bodyStr = JSON.stringify({
        event: 'LEADS_DISCOVERED',
        scanId: 'scan-merida-1',
        tenantId: TENANT_A,
        city: 'Mérida ⭐',
      });
      const sig = createHmac('sha256', TEST_LAMBDA_SECRET).update(bodyStr, 'utf8').digest('hex');
      const nowSec = String(Math.floor(Date.now() / 1000));

      const ctx = buildExecutionContext(
        { 'x-signature': `sha256=${sig}`, 'x-timestamp': nowSec },
        bodyStr,
      );
      assert.equal(guard.canActivate(ctx), true);
    });

    it('SEC-06: Fails closed with 401 when x-signature header is omitted', () => {
      const bodyStr = JSON.stringify({ event: 'SCAN_STARTED', scanId: 's1', tenantId: TENANT_A });
      const ctx = buildExecutionContext({}, bodyStr);
      assert.throws(() => guard.canActivate(ctx), UnauthorizedException);
    });

    it('SEC-07: Rejects tampered payload body with 401', () => {
      const original = JSON.stringify({ event: 'SCAN_STARTED', scanId: 's1', tenantId: TENANT_A });
      const tampered = JSON.stringify({ event: 'SCAN_STARTED', scanId: 's1', tenantId: TENANT_B });
      const sig = createHmac('sha256', TEST_LAMBDA_SECRET).update(original, 'utf8').digest('hex');

      const ctx = buildExecutionContext({ 'x-signature': sig }, tampered);
      assert.throws(() => guard.canActivate(ctx), UnauthorizedException);
    });

    it('SEC-08: Rejects expired replay timestamp (> 300s drift) with 401', () => {
      const bodyStr = JSON.stringify({ event: 'SCAN_STARTED', scanId: 's1', tenantId: TENANT_A });
      const sig = createHmac('sha256', TEST_LAMBDA_SECRET).update(bodyStr, 'utf8').digest('hex');
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 900);

      const ctx = buildExecutionContext(
        { 'x-signature': sig, 'x-timestamp': staleTimestamp },
        bodyStr,
      );
      assert.throws(() => guard.canActivate(ctx), UnauthorizedException);
    });

    it('SEC-09: Rejects malformed/short hex signature cleanly without RangeError', () => {
      const bodyStr = JSON.stringify({ event: 'SCAN_STARTED' });
      const ctx = buildExecutionContext({ 'x-signature': 'deadbeef' }, bodyStr);
      assert.throws(() => guard.canActivate(ctx), UnauthorizedException);
    });
  });

  describe('3. Anti-SSRF URL Safety Validator (SEC-10..14)', () => {
    it('SEC-10 & SEC-11: Accepts public domains and detects social/directory domains', () => {
      const corp = validateExternalBusinessUrlSync('https://www.dentalmontejo.com.mx/citas');
      assert.equal(corp.isSafe, true);
      assert.equal(corp.rootDomain, 'dentalmontejo.com.mx');
      assert.equal(corp.isSocialOrDirectory, false);

      const social = validateExternalBusinessUrlSync('https://www.instagram.com/dentalmontejo');
      assert.equal(social.isSafe, true);
      assert.equal(social.isSocialOrDirectory, true);
    });

    it('SEC-12..14: Blocks AWS IMDS 169.254.169.254, loopback, RFC1918, IPv6 internal, and file://', () => {
      const maliciousUrls = [
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'http://127.0.0.1:7000/api/prospecting/leads',
        'http://localhost:5438/',
        'http://10.0.0.12:8080/',
        'http://172.18.0.3:5432/',
        'http://192.168.1.1/admin',
        'http://[::1]:7000/',
        'http://[::ffff:169.254.169.254]/',
        'file:///etc/passwd',
        'http://postgres.internal:5432',
      ];

      for (const bad of maliciousUrls) {
        const res = validateExternalBusinessUrlSync(bad);
        assert.equal(res.isSafe, false, `Expected unsafe URL to be blocked: ${bad}`);
      }

      assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
      assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
    });
  });

  describe('4. Phone E.164 Normalizer & Mobile vs Landline Classifier (DOM-11..14)', () => {
    const phoneNormalizer = new PhoneNormalizerService();

    it('DOM-11 & DOM-12: Normalizes Mexican +52 1 legacy mobile numbers and detects PBX/Toll-Free landlines', () => {
      const mxMobile = phoneNormalizer.normalize('+52 1 (999) 123-4567', 'Mexico');
      assert.equal(mxMobile.phoneE164, '+529991234567');
      assert.equal(mxMobile.whatsappDigits, '529991234567');
      assert.equal(mxMobile.phoneType, PhoneLineType.MOBILE);

      const mxPbx = phoneNormalizer.normalize('+52 55 5200 1234 ext. 205', 'Mexico');
      assert.equal(mxPbx.phoneE164, '+525552001234');
      assert.equal(mxPbx.whatsappDigits, null);
      assert.equal(mxPbx.phoneType, PhoneLineType.LANDLINE);

      const mx800 = phoneNormalizer.normalize('800 123 4567', 'MX');
      assert.equal(mx800.phoneType, PhoneLineType.LANDLINE);
    });

    it('DOM-13 & DOM-14: Distinguishes Colombian 3xx mobile vs 60x landline and validates US numbers', () => {
      const coMobile = phoneNormalizer.normalize('+57 300 456 7890', 'Colombia');
      assert.equal(coMobile.phoneE164, '+573004567890');
      assert.equal(coMobile.phoneType, PhoneLineType.MOBILE);

      const coLandline = phoneNormalizer.normalize('601 234 5678', 'CO');
      assert.equal(coLandline.phoneE164, '+576012345678');
      assert.equal(coLandline.phoneType, PhoneLineType.LANDLINE);
      assert.equal(coLandline.whatsappDigits, null);

      const usMobile = phoneNormalizer.normalize('(512) 555-0199', 'United States');
      assert.equal(usMobile.phoneE164, '+15125550199');
      assert.equal(usMobile.phoneType, PhoneLineType.MOBILE);

      const invalid = phoneNormalizer.normalize('1234', 'Mexico');
      assert.equal(invalid.phoneType, PhoneLineType.INVALID);
    });
  });

  describe('5. Parent-Child Franchise & Chain Detector (DOM-01..04)', () => {
    it('DOM-01..04: Resolves known franchises, strips branch syntax, clusters corporate domains, and ignores shared Instagram links', async () => {
      let simulatedDomainSiblings = 0;
      const mockPrisma: any = {
        corporateBrand: {
          findMany: async () => [],
          findUnique: async () => null,
          upsert: async ({ create }: any) => ({ id: 'brand-uuid-1', ...create }),
          create: async ({ data }: any) => ({ id: 'cluster-uuid-1', ...data }),
        },
        prospectedBusiness: {
          count: async ({ where }: any) =>
            where.rootDomain === 'grupodentalmayab.com.mx' ? simulatedDomainSiblings : 0,
          updateMany: async () => ({ count: 1 }),
        },
      };

      const detector = new ChainDetectorService(mockPrisma);

      const indep = await detector.resolveChainHierarchy({
        tenantId: TENANT_A,
        placeId: 'p1',
        name: 'Consultorio Dental Dr. Roberto Pech',
        websiteUrl: 'https://instagram.com/drpechmerida',
      });
      assert.equal(indep.ownershipType, BusinessOwnershipType.INDEPENDENT);
      assert.equal(indep.isChain, false);
      assert.equal(indep.rootDomain, null); // Social domain must never become corporate rootDomain

      const franchise = await detector.resolveChainHierarchy({
        tenantId: TENANT_A,
        placeId: 'p2',
        name: 'Dentalia Plaza Altabrisa',
        websiteUrl: 'https://dentalia.com/clinicas/merida-altabrisa',
      });
      assert.equal(franchise.ownershipType, BusinessOwnershipType.CHAIN_BRANCH);
      assert.equal(franchise.brandName, 'Dentalia');
      assert.equal(franchise.branchIdentifier, 'Plaza Altabrisa');

      simulatedDomainSiblings = 2;
      const domainCluster = await detector.resolveChainHierarchy({
        tenantId: TENANT_A,
        placeId: 'p3',
        name: 'Clínica Mayab Norte',
        websiteUrl: 'https://grupodentalmayab.com.mx/norte',
      });
      assert.equal(domainCluster.ownershipType, BusinessOwnershipType.CHAIN_BRANCH);
      assert.equal(domainCluster.detectionSource, 'ROOT_DOMAIN_CLUSTER');
    });
  });

  describe('6. Multi-Pain Analyzer, Price Tier Multiplier & 3-Tone Templates (DOM-15..18)', () => {
    const analyzer = new CompanyPainAnalyzerService();

    it('DOM-15: Detects multiple simultaneous pains and ranks primary pain deterministically', () => {
      const result = analyzer.analyze({
        name: 'Clínica Dental Montejo',
        city: 'Mérida',
        websiteUrl: 'https://facebook.com/dentalmontejo',
        rating: 4.1,
        reviewsCount: 64,
        reviewsSnippets: [
          'Excelente dentista pero tardan mucho en agendar cita y te hacen esperar.',
          'Mandas mensaje por WhatsApp y nadie contesta el teléfono.',
        ],
        priceLevel: 3, // $$$ -> 1.5x ticket multiplier
      });

      const codes = result.detectedPains.map((p) => p.code);
      assert.ok(codes.includes('NO_WEBSITE'));
      assert.ok(codes.includes('NO_ONLINE_BOOKING'));
      assert.ok(codes.includes('UNRESPONSIVE_CUSTOMER_SERVICE'));
      assert.equal(result.primaryPain, CompanyPainCategory.NO_WEBSITE);
      assert.equal(result.detectedPains[0].isPrimary, true);
      // Base ticket for NO_WEBSITE is $450 * 1.5 = $675
      assert.equal(result.estimatedTicketUsd, 675);
      assert.ok(result.detectedPains[0].pitchGatekeeper.includes('Clínica Dental Montejo'));
      assert.ok(result.detectedPains[0].pitchEnterprise.includes('Mérida'));
    });

    it('DOM-16: Elevates broken/expired domain (HTTP 404 / DNS NXDOMAIN) to WEBSITE_DOWN_OR_EXPIRED with 0.99 confidence', () => {
      const result = analyzer.analyze({
        name: 'Ortodoncia Avanzada',
        city: 'Bogotá',
        websiteUrl: 'https://ortodonciaavanzadabogota.com.co',
        websiteHttpStatus: 404,
        isBrokenWebsite: true,
        rating: 4.7,
        reviewsCount: 95,
      });

      assert.equal(result.primaryPain, CompanyPainCategory.WEBSITE_DOWN_OR_EXPIRED);
      assert.equal(result.painConfidence, 0.99);
    });
  });

  describe('7. Contact Cooldown, Blacklist & Email Telemetry Policy (DOM-05..08, DOM-22)', () => {
    const tenantContext = new TenantContextService();
    const configService = makeMockConfig({ PROSPECT_COOLDOWN_DAYS: '30' });

    it('DOM-05..08: Enforces 30d cooldown, permits MEETING_SCHEDULED follow-up, and blocks blacklisted leads', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      let businessState: any = {
        id: 'biz-1',
        tenantId: TENANT_A,
        name: 'Clínica Campestre',
        doNotContact: false,
        doNotContactReason: null,
        contactCooldownUntil: null,
        contactLogs: [],
      };

      const mockPrisma: any = {
        prospectedBusiness: {
          findFirst: async () => businessState,
        },
        companyPainCatalog: {
          findUnique: async () => ({ id: 'pain-cat-1', code: 'NO_WEBSITE' }),
        },
        $transaction: async (cb: any) =>
          cb({
            prospectContactLog: {
              create: async ({ data }: any) => ({ id: 'log-1', ...data }),
            },
            prospectedBusiness: {
              update: async ({ data }: any) => {
                businessState = {
                  ...businessState,
                  ...data,
                  contactAttemptsCount: (businessState.contactAttemptsCount || 0) + 1,
                };
                return businessState;
              },
            },
            prospectedBusinessPain: {
              updateMany: async () => ({ count: 1 }),
            },
          }),
      };

      const service = new ContactCooldownPolicyService(mockPrisma, tenantContext, configService);

      await tenantContext.runWithContext(
        { tenantId: TENANT_A, userEmail: 'sales@spotlightus.org', role: 'MEMBER', isAuthenticated: true },
        async () => {
          // 1. First contact succeeds and sets 30-day cooldown
          const first = await service.recordContactInteraction({
            businessId: 'biz-1',
            painCode: 'NO_WEBSITE',
            channel: ContactChannel.WHATSAPP,
            recipientRole: RecipientRole.BUSINESS_OWNER,
            outcome: ContactOutcome.CONNECTED_PITCHED,
            notes: 'Initial WhatsApp pitch sent',
          });
          assert.equal(first.businessSummary.status, ProspectedLeadStatus.CONTACTED);
          assert.ok(first.businessSummary.contactCooldownUntil! > new Date());

          // 2. Immediate second attempt within 30d throws 409 Conflict
          businessState.contactLogs = [{ outcome: ContactOutcome.CONNECTED_PITCHED }];
          await assert.rejects(
            () =>
              service.recordContactInteraction({
                businessId: 'biz-1',
                channel: ContactChannel.WHATSAPP,
                outcome: ContactOutcome.NO_ANSWER,
              }),
            ConflictException,
          );

          // 3. Follow-up is permitted if prior interaction was MEETING_SCHEDULED
          businessState.contactCooldownUntil = futureDate;
          businessState.contactLogs = [{ outcome: ContactOutcome.MEETING_SCHEDULED }];
          const followup = await service.recordContactInteraction({
            businessId: 'biz-1',
            channel: ContactChannel.PHONE_CALL,
            outcome: ContactOutcome.CLOSED_WON,
          });
          assert.equal(followup.contactLog.outcome, ContactOutcome.CLOSED_WON);

          // 4. Blacklisted business blocks all outbound outreach
          businessState.doNotContact = true;
          businessState.doNotContactReason = 'Requested removal';
          await assert.rejects(
            () =>
              service.recordContactInteraction({
                businessId: 'biz-1',
                channel: ContactChannel.EMAIL,
                outcome: ContactOutcome.EMAIL_SENT,
              }),
            ConflictException,
          );
        },
      );
    });

    it('DOM-22: Email BOUNCED marks INVALID_BOUNCE and SPAM_COMPLAINT activates doNotContact', async () => {
      const updates: any[] = [];
      const mockPrisma: any = {
        prospectContactLog: {
          findUnique: async () => ({ id: 'log-email-1', businessId: 'biz-email-1' }),
        },
        $transaction: async (cb: any) =>
          cb({
            prospectContactLog: { update: async () => ({}) },
            prospectedBusiness: {
              update: async ({ data }: any) => {
                updates.push(data);
                return data;
              },
            },
          }),
      };

      const service = new ContactCooldownPolicyService(mockPrisma, tenantContext, configService);
      await service.handleEmailTelemetryWebhook({
        emailMessageId: 'msg_123',
        event: EmailDeliveryEvent.BOUNCED,
      });
      assert.equal(updates[0].emailDeliverability, EmailDeliverabilityStatus.INVALID_BOUNCE);

      await service.handleEmailTelemetryWebhook({
        emailMessageId: 'msg_123',
        event: EmailDeliveryEvent.SPAM_COMPLAINT,
      });
      assert.equal(updates[1].doNotContact, true);
      assert.equal(updates[1].status, ProspectedLeadStatus.DISQUALIFIED);
    });
  });
});
