import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { CompanyPainAnalyzerService } from './company-pain-analyzer.service';
import { CompanyPainCategory } from '@prisma/client';

describe('CompanyPainAnalyzerService - Unit Test Suite', () => {
  const analyzer = new CompanyPainAnalyzerService();

  it('should categorize business without website as NO_WEBSITE with high confidence', () => {
    const result = analyzer.analyze({
      name: 'Taller Mecánico El Tuercas',
      city: 'Querétaro',
      websiteUrl: undefined,
      rating: 4.6,
      reviewsCount: 50,
    });

    assert.strictEqual(result.primaryPain, CompanyPainCategory.NO_WEBSITE);
    assert.ok(result.painConfidence >= 0.9);
    assert.ok(result.salesPitchDraft.includes('sitio web oficial propio'));
  });

  it('should categorize business with appointment friction reviews as NO_ONLINE_BOOKING', () => {
    const result = analyzer.analyze({
      name: 'Dental Smile Center',
      city: 'Guadalajara',
      websiteUrl: 'https://dentalsmile.com',
      rating: 4.0,
      reviewsCount: 30,
      reviewsSnippets: ['Fui a mi cita y esperé 2 horas', 'Es un relajo agendar cita por teléfono'],
    });

    assert.strictEqual(result.primaryPain, CompanyPainCategory.NO_ONLINE_BOOKING);
    assert.ok(result.suggestedOffer.includes('Agendamiento'));
  });

  it('should categorize business with unanswered calls as UNRESPONSIVE_CUSTOMER_SERVICE', () => {
    const result = analyzer.analyze({
      name: 'Notaría Pública 15',
      city: 'Monterrey',
      websiteUrl: 'https://notaria15.mx',
      rating: 3.8,
      reviewsCount: 15,
      reviewsSnippets: ['Llamas y nadie contesta el teléfono', 'Nunca responden las dudas'],
    });

    assert.strictEqual(result.primaryPain, CompanyPainCategory.UNRESPONSIVE_CUSTOMER_SERVICE);
    assert.ok(result.suggestedOffer.includes('WhatsApp'));
  });
});
