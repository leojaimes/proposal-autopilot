import { Module } from '@nestjs/common';
import { RoleClassifierService } from './services/role-classifier.service';
import { FitCalculatorService } from './services/fit-calculator.service';
import { DeterministicSemanticService } from './services/deterministic-semantic.service';

@Module({
  providers: [RoleClassifierService, FitCalculatorService, DeterministicSemanticService],
  exports: [RoleClassifierService, FitCalculatorService, DeterministicSemanticService],
})
export class ScoringModule {}
