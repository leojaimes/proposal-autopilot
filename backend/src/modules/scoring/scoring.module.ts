import { Module } from '@nestjs/common';
import { RoleClassifierService } from './services/role-classifier.service';
import { FitCalculatorService } from './services/fit-calculator.service';

@Module({
  providers: [RoleClassifierService, FitCalculatorService],
  exports: [RoleClassifierService, FitCalculatorService],
})
export class ScoringModule {}
