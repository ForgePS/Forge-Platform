import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { NerisAccessService } from "./neris-access.service.js";
import { NerisConditionEngine } from "./neris-condition-engine.service.js";
import { NerisConfigurationOverlayService } from "./neris-configuration-overlay.service.js";
import { NerisSchemaRegistryService } from "./neris-schema-registry.service.js";
import { NerisSchemaValidationService } from "./neris-schema-validation.service.js";
import { NerisValueSetService } from "./neris-value-set.service.js";
import { NerisPlatformController, NerisTenantController } from "./neris.controller.js";

@Module({
  imports: [AuditModule, OutboxModule],
  controllers: [NerisPlatformController, NerisTenantController],
  providers: [
    NerisAccessService,
    NerisSchemaRegistryService,
    NerisValueSetService,
    NerisConditionEngine,
    NerisConfigurationOverlayService,
    NerisSchemaValidationService,
  ],
  exports: [
    NerisAccessService,
    NerisSchemaRegistryService,
    NerisValueSetService,
    NerisConditionEngine,
    NerisConfigurationOverlayService,
    NerisSchemaValidationService,
  ],
})
export class NerisModule {}
