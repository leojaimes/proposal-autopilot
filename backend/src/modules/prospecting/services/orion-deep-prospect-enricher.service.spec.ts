import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { OrionDeepProspectEnricherService } from './orion-deep-prospect-enricher.service';
import { PhoneLineType, EmailDeliverabilityStatus } from '@prisma/client';
import { EmailValidationResultStatus } from './email-validation.service';

describe('OrionDeepProspectEnricherService (node:test)', () => {
  let service: OrionDeepProspectEnricherService;
  let prismaMock: any;
  let orionSearchMock: any;
  let phoneNormalizerMock: any;
  let emailValidationMock: any;
  let lambdaMock: any;
  let updateCalls: any[] = [];
  let contactUpsertCalls: any[] = [];
  let socialUpsertCalls: any[] = [];

  beforeEach(() => {
    updateCalls = [];
    contactUpsertCalls = [];
    socialUpsertCalls = [];

    prismaMock = {
      prospectedBusiness: {
        findUnique: null,
        update: async (args: any) => {
          updateCalls.push(args);
          return args.data;
        },
      },
      prospectedBusinessContact: {
        upsert: async (args: any) => {
          contactUpsertCalls.push(args);
          return args;
        },
      },
      prospectedBusinessSocial: {
        upsert: async (args: any) => {
          socialUpsertCalls.push(args);
          return args;
        },
      },
      $transaction: async (cb: any) => {
        return cb(prismaMock);
      },
    };

    orionSearchMock = {
      search: async () => [],
    };

    phoneNormalizerMock = {
      normalize: (phone: string) => ({
        phoneE164: phone.startsWith('+') ? phone : `+52${phone.replace(/\D/g, '')}`,
        phoneType: PhoneLineType.MOBILE,
        whatsappDigits: phone.replace(/\D/g, ''),
      }),
    };

    emailValidationMock = {
      validateEmail: async () => ({
        status: EmailValidationResultStatus.VALID_DELIVERABLE,
        normalizedEmail: 'test@domain.com',
        isDeliverableCandidate: true,
      }),
    };

    lambdaMock = {
      deepEnrichBusiness: async () => ({
        channels: {},
        decisionMakers: [],
        verifiedPlatforms: [],
      }),
    };

    service = new OrionDeepProspectEnricherService(
      prismaMock,
      orionSearchMock,
      phoneNormalizerMock,
      emailValidationMock,
      lambdaMock,
    );
  });

  const baseLead = {
    id: 'lead-123',
    tenantId: 'tenant-abc',
    name: 'Dentaly Clínica Dental',
    city: 'Mérida',
    country: 'Mexico',
    phone: null,
    phoneE164: null,
    phoneType: PhoneLineType.UNKNOWN,
    email: null,
    emailDeliverability: EmailDeliverabilityStatus.UNVERIFIED,
    websiteUrl: 'https://dentalymid.com',
    contacts: [],
    socialProfiles: [],
    rawGoogleData: {},
  };

  it('should validate and persist valid email as VERIFIED and create relational contacts and socials', async () => {
    prismaMock.prospectedBusiness.findUnique = async () => ({ ...baseLead });

    orionSearchMock.search = async () => [
      {
        url: 'https://dentalymid.com/contacto',
        content: 'Contacto: info@dentalymid.com o al tel 9991234567. Directora: Dra. Cecilia Beatriz Pérez.',
      },
    ];

    lambdaMock.deepEnrichBusiness = async () => ({
      channels: {
        email: 'contacto@dentalymid.com',
        phone: '+529991234567',
        whatsappUrl: 'https://wa.me/529991234567',
        facebookUrl: 'https://facebook.com/dentalymid',
      },
      decisionMakers: [
        { name: 'Dra. Cecilia Beatriz Pérez', role: 'Doctora Especialista', sourceUrl: 'https://dentalymid.com/about' },
      ],
      verifiedPlatforms: ['FACEBOOK'],
    });

    emailValidationMock.validateEmail = async () => ({
      status: EmailValidationResultStatus.VALID_DELIVERABLE,
      normalizedEmail: 'contacto@dentalymid.com',
      isDeliverableCandidate: true,
    });

    const result = await service.enrichLeadDeeply('lead-123');

    assert.equal(result.foundChannels.email, 'contacto@dentalymid.com');
    assert.ok(result.decisionMakers.length > 0);
    assert.equal(result.decisionMakers[0].name, 'Cecilia Beatriz Pérez');
    assert.equal(result.decisionMakers[0].honorific, 'Dra.');

    // Check updates
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].where.id, 'lead-123');
    assert.equal(updateCalls[0].data.email, 'contacto@dentalymid.com');
    assert.equal(updateCalls[0].data.emailDeliverability, EmailDeliverabilityStatus.VERIFIED);
    assert.equal(updateCalls[0].data.phoneE164, '+529991234567');
    assert.equal(updateCalls[0].data.enrichmentStatus, 'ENRICHED');

    // Verify contact upsert
    assert.equal(contactUpsertCalls.length, 1);
    assert.equal(contactUpsertCalls[0].where.uq_business_contact_name.fullName, 'Cecilia Beatriz Pérez');
    assert.equal(contactUpsertCalls[0].create.fullName, 'Cecilia Beatriz Pérez');
    assert.equal(contactUpsertCalls[0].create.honorific, 'Dra.');
    assert.equal(contactUpsertCalls[0].create.isPrimary, true);

    // Verify social upsert
    assert.equal(socialUpsertCalls.length, 2); // FACEBOOK and WHATSAPP
    assert.ok(socialUpsertCalls.some((c: any) => c.where.uq_business_social_platform.platform === 'FACEBOOK'));
  });

  it('should NOT overwrite manually verified SDR data', async () => {
    const protectedLead = {
      ...baseLead,
      email: 'doctora.personal@merida.com',
      phone: '+529998887766',
      phoneE164: '+529998887766',
      phoneType: PhoneLineType.MOBILE,
      rawGoogleData: {
        isManuallyVerified: true,
      },
      contacts: [{ id: 'contact-1', fullName: 'Dra. Cecilia', isManuallyVerified: true }],
    };

    prismaMock.prospectedBusiness.findUnique = async () => protectedLead;

    lambdaMock.deepEnrichBusiness = async () => ({
      channels: {
        email: 'contacto-temporal@gmail.com',
        phone: '+529990001122',
      },
      decisionMakers: [],
    });

    await service.enrichLeadDeeply('lead-123');

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.email, undefined);
    assert.equal(updateCalls[0].data.phone, undefined);
    assert.equal(updateCalls[0].data.phoneE164, undefined);
  });

  it('should promote mobile WhatsApp over existing landline phone', async () => {
    const landlineLead = {
      ...baseLead,
      phone: '9999201122',
      phoneE164: '+529999201122',
      phoneType: PhoneLineType.LANDLINE,
      rawGoogleData: {},
    };

    prismaMock.prospectedBusiness.findUnique = async () => landlineLead;

    lambdaMock.deepEnrichBusiness = async () => ({
      channels: {
        phone: '+529995554433',
        whatsappUrl: 'https://wa.me/529995554433',
      },
    });

    await service.enrichLeadDeeply('lead-123');

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.phoneType, PhoneLineType.MOBILE);
    assert.equal(updateCalls[0].data.phoneE164, '+529995554433');
  });

  it('should discard template / infrastructure emails and not persist them', async () => {
    prismaMock.prospectedBusiness.findUnique = async () => baseLead;

    orionSearchMock.search = async () => [
      { url: 'https://template.com', content: 'Designed with Wix: user@wix.com' },
    ];

    emailValidationMock.validateEmail = async () => ({
      status: EmailValidationResultStatus.DISQUALIFIED_TEMPLATE,
      isDeliverableCandidate: false,
    });

    await service.enrichLeadDeeply('lead-123');

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.email, undefined);
  });
});
