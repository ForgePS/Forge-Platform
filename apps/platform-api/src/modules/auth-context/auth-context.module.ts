import { Global, Module } from "@nestjs/common";
import { AuthContextService } from "./auth-context.service.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthMeController } from "./auth-me.controller.js";
import { AuthorizationDecisionService } from "./authorization-decision.service.js";
import { PermissionGuard } from "./permission.guard.js";
import { TenantGuard } from "./tenant.guard.js";

@Global()
@Module({
  controllers: [AuthMeController],
  providers: [
    AuthContextService,
    AuthorizationDecisionService,
    AuthGuard,
    PermissionGuard,
    TenantGuard,
  ],
  exports: [
    AuthContextService,
    AuthorizationDecisionService,
    AuthGuard,
    PermissionGuard,
    TenantGuard,
  ],
})
export class AuthContextModule {}
