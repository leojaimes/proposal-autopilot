import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './core/database/prisma.service';
import { TenantContextService } from './core/context/tenant-context.service';
import { TenantMiddleware } from './core/middleware/tenant.middleware';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ScrapingModule } from './modules/scraping/scraping.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { ProposalsModule } from './modules/proposals/proposals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantsModule,
    ScrapingModule,
    ScoringModule,
    ProposalsModule,
  ],
  providers: [PrismaService, TenantContextService],
  exports: [PrismaService, TenantContextService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
