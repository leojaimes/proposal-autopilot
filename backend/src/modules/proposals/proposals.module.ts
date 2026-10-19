import { Module } from '@nestjs/common';
import { ClaudeProposalService } from './claude-proposal.service';
import { TechnicalProposalPdfService } from './technical-proposal-pdf.service';

@Module({
  providers: [ClaudeProposalService, TechnicalProposalPdfService],
  exports: [ClaudeProposalService, TechnicalProposalPdfService],
})
export class ProposalsModule {}
