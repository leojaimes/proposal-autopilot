import { Module } from '@nestjs/common';
import { ClaudeProposalService } from './claude-proposal.service';
import { TechnicalProposalPdfService } from './technical-proposal-pdf.service';
import { CvTailorService } from './cv-tailor.service';

@Module({
  providers: [ClaudeProposalService, TechnicalProposalPdfService, CvTailorService],
  exports: [ClaudeProposalService, TechnicalProposalPdfService, CvTailorService],
})
export class ProposalsModule {}
