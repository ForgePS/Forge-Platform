import { DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import type { ForgeEnvironment } from "@forge/environment";
import { CommonModule } from "./common/common.module.js";
import { DatabaseModule } from "./common/database.module.js";
import { IdempotencyInterceptor } from "./common/idempotency.interceptor.js";
import { IdempotencyService } from "./common/idempotency.service.js";
import { HealthController } from "./health.controller.js";
import { GlobalExceptionFilter } from "./http-exception.filter.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthContextModule } from "./modules/auth-context/auth-context.module.js";
import { AuthContextService } from "./modules/auth-context/auth-context.service.js";
import { AuthGuard } from "./modules/auth-context/auth.guard.js";
import { PermissionGuard } from "./modules/auth-context/permission.guard.js";
import { TenantGuard } from "./modules/auth-context/tenant.guard.js";
import { AuthorizationModule } from "./modules/authorization/authorization.module.js";
import { BrandingModule } from "./modules/branding/branding.module.js";
import { CognitoModule } from "./modules/cognito/cognito.module.js";
import { ConfigurationModule } from "./modules/configuration/configuration.module.js";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module.js";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module.js";
import { ImportsModule } from "./modules/imports/imports.module.js";
import { InvitationsModule } from "./modules/invitations/invitations.module.js";
import { MembershipsModule } from "./modules/memberships/memberships.module.js";
import { NerisModule } from "./modules/neris/neris.module.js";
import { NerisIncidentsModule } from "./modules/neris-incidents/neris-incidents.module.js";
import { CadModule } from "./modules/cad/cad.module.js";
import { AiNarrativeModule } from "./modules/ai-narrative/ai-narrative.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { FacilitiesModule } from "./modules/facilities/facilities.module.js";
import { OutboxModule } from "./modules/outbox/outbox.module.js";
import { PersonsModule } from "./modules/persons/persons.module.js";
import { RmsMasterDataModule } from "./modules/rms/rms-master-data.module.js";
import { ProductsModule } from "./modules/products/products.module.js";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module.js";
import { TenantsModule } from "./modules/tenants/tenants.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { APP_ENV } from "./tokens.js";

@Module({})
export class AppModule {
  static register(env: ForgeEnvironment): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(env),
        CommonModule,
        CognitoModule,
        OutboxModule,
        AuditModule,
        AuthContextModule,
        TenantsModule,
        OrganizationsModule,
        FacilitiesModule,
        PersonsModule,
        UsersModule,
        MembershipsModule,
        InvitationsModule,
        AuthorizationModule,
        ProductsModule,
        EntitlementsModule,
        SubscriptionsModule,
        FeatureFlagsModule,
        ConfigurationModule,
        ImportsModule,
        BrandingModule,
        OnboardingModule,
        NerisModule,
        NerisIncidentsModule,
        CadModule,
        AiNarrativeModule,
        RmsMasterDataModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_ENV, useValue: env },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        // Factories avoid reliance on emitDecoratorMetadata (vitest/esbuild).
        {
          provide: APP_GUARD,
          useFactory: (auth: AuthContextService, reflector: Reflector) =>
            new AuthGuard(auth, reflector),
          inject: [AuthContextService, Reflector],
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new TenantGuard(reflector),
          inject: [Reflector],
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector, auth: AuthContextService) =>
            new PermissionGuard(reflector, auth),
          inject: [Reflector, AuthContextService],
        },
        {
          provide: APP_INTERCEPTOR,
          useFactory: (reflector: Reflector, idempotency: IdempotencyService) =>
            new IdempotencyInterceptor(reflector, idempotency),
          inject: [Reflector, IdempotencyService],
        },
      ],
    };
  }
}
