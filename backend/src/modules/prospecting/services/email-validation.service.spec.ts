import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { EmailValidationService, EmailValidationResultStatus } from './email-validation.service';
import * as dns from 'node:dns';

describe('EmailValidationService (node:test)', () => {
  let service: EmailValidationService;
  let originalResolveMx: any;
  let mockResolveMxResult: any = null;
  let mockResolveMxError: any = null;
  let resolveMxCalls = 0;

  beforeEach(() => {
    service = new EmailValidationService();
    service.clearCache();
    mockResolveMxResult = null;
    mockResolveMxError = null;
    resolveMxCalls = 0;

    originalResolveMx = dns.promises.resolveMx;
    dns.promises.resolveMx = (async (domain: string) => {
      resolveMxCalls++;
      if (mockResolveMxError) {
        throw mockResolveMxError;
      }
      return mockResolveMxResult || [{ exchange: 'mail.' + domain, priority: 10 }];
    }) as any;
  });

  describe('Syntax & Sanitization', () => {
    it('should reject empty or non-string inputs', async () => {
      const result = await service.validateEmail('');
      assert.equal(result.status, EmailValidationResultStatus.INVALID_SYNTAX);
      assert.equal(result.isDeliverableCandidate, false);
    });

    it('should reject syntactically invalid emails', async () => {
      const invalidEmails = [
        'plainaddress',
        '@missing-local.com',
        'missing-domain@.com',
        'spaces in@domain.com',
        'two@@at.com',
      ];

      for (const email of invalidEmails) {
        const result = await service.validateEmail(email);
        assert.equal(result.status, EmailValidationResultStatus.INVALID_SYNTAX);
        assert.equal(result.isDeliverableCandidate, false);
      }
    });

    it('should normalize valid email with whitespace and uppercase letters', async () => {
      mockResolveMxResult = [{ exchange: 'mail.clinicadental.mx', priority: 10 }];

      const result = await service.validateEmail('  Doctora.Perez@ClinicaDental.mx  ');
      assert.equal(result.status, EmailValidationResultStatus.VALID_DELIVERABLE);
      assert.equal(result.normalizedEmail, 'doctora.perez@clinicadental.mx');
      assert.equal(result.isDeliverableCandidate, true);
    });
  });

  describe('Template & Infrastructure Domain Disqualification', () => {
    it('should disqualify emails from example, wix, sentry, and wordpress domains without querying DNS', async () => {
      const templateEmails = [
        'contacto@example.com',
        'sales@subdomain.example.org',
        'support@wix.com',
        'admin@mysite.wixpress.com',
        'security@sentry.io',
        'hello@wordpress.org',
        'test@domain.com',
      ];

      for (const email of templateEmails) {
        const result = await service.validateEmail(email);
        assert.equal(result.status, EmailValidationResultStatus.DISQUALIFIED_TEMPLATE);
        assert.equal(result.isDeliverableCandidate, false);
        assert.ok(result.disqualificationReason?.includes('known CMS template or infrastructure domain'));
      }

      assert.equal(resolveMxCalls, 0);
    });

    it('should disqualify common placeholder local parts', async () => {
      const placeholderEmails = [
        'yourname@realbusiness.com',
        'email@realbusiness.com',
        'test@realbusiness.com',
        'user@realbusiness.com',
      ];

      for (const email of placeholderEmails) {
        const result = await service.validateEmail(email);
        assert.equal(result.status, EmailValidationResultStatus.DISQUALIFIED_TEMPLATE);
        assert.equal(result.isDeliverableCandidate, false);
        assert.ok(result.disqualificationReason?.includes('generic template placeholder'));
      }

      assert.equal(resolveMxCalls, 0);
    });
  });

  describe('DNS MX Verification & Error Classification', () => {
    it('should classify as VALID_DELIVERABLE when DNS MX records are found and sort by priority', async () => {
      mockResolveMxResult = [
        { exchange: 'mx2.google.com', priority: 20 },
        { exchange: 'mx1.google.com', priority: 10 },
      ];

      const result = await service.validateEmail('dr.perez@dentalymid.com');
      assert.equal(result.status, EmailValidationResultStatus.VALID_DELIVERABLE);
      assert.equal(result.isDeliverableCandidate, true);
      assert.deepEqual(result.mxRecords, [
        { exchange: 'mx1.google.com', priority: 10 },
        { exchange: 'mx2.google.com', priority: 20 },
      ]);
    });

    it('should classify as DOMAIN_NO_MX when DNS returns empty MX list', async () => {
      mockResolveMxResult = [];

      const result = await service.validateEmail('contacto@negocio-sin-correo.com');
      assert.equal(result.status, EmailValidationResultStatus.DOMAIN_NO_MX);
      assert.equal(result.isDeliverableCandidate, false);
    });

    it('should classify as DOMAIN_NO_MX when DNS throws ENOTFOUND or ENODATA', async () => {
      const error: any = new Error('getaddrinfo ENOTFOUND fake-clinic-domain.com');
      error.code = 'ENOTFOUND';
      mockResolveMxError = error;

      const result = await service.validateEmail('contacto@fake-clinic-domain.com');
      assert.equal(result.status, EmailValidationResultStatus.DOMAIN_NO_MX);
      assert.equal(result.isDeliverableCandidate, false);
      assert.ok(result.dnsError?.includes('ENOTFOUND'));
    });

    it('should classify as DNS_TEMPORARY_ERROR on network timeout or SERVFAIL', async () => {
      const timeoutError: any = new Error('DNS query ETIMEOUT');
      timeoutError.code = 'ETIMEOUT';
      mockResolveMxError = timeoutError;

      const result = await service.validateEmail('recepcion@hospital-merida.com');
      assert.equal(result.status, EmailValidationResultStatus.DNS_TEMPORARY_ERROR);
      assert.equal(result.isDeliverableCandidate, false);
      assert.ok(result.disqualificationReason?.includes('Temporary DNS resolution error'));
    });

    it('should cache DNS MX resolutions and avoid re-querying within TTL', async () => {
      mockResolveMxResult = [{ exchange: 'mail.hospital.com', priority: 10 }];

      const firstCall = await service.validateEmail('dr1@hospital.com');
      assert.equal(firstCall.status, EmailValidationResultStatus.VALID_DELIVERABLE);
      assert.equal(resolveMxCalls, 1);

      // Second call for a different user at the SAME domain:
      const secondCall = await service.validateEmail('dr2@hospital.com');
      assert.equal(secondCall.status, EmailValidationResultStatus.VALID_DELIVERABLE);
      // DNS resolveMx should NOT be called again due to memory cache
      assert.equal(resolveMxCalls, 1);
    });
  });
});
