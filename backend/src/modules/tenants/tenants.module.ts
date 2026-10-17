import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, PrismaService, TenantContextService],
  exports: [TenantsService],
})
export class TenantsModule {}
