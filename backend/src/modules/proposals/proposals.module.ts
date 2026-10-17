import { Module } from '@nestjs/common';
import { ClaudeProposalService } from './claude-proposal.service';

@Module({
  providers: [ClaudeProposalService],
  exports: [ClaudeProposalService],
})
export class ProposalsModule {}
