import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module.js";
import { IndustrialAnalyticsController } from "./industrial-analytics.controller.js";
import { IndustrialAnalyticsService } from "./industrial-analytics.service.js";
import { IndustrialController } from "./industrial.controller.js";
import { IndustrialOpsController } from "./industrial-ops.controller.js";
import { IndustrialOpsService } from "./industrial-ops.service.js";
import { IndustrialService } from "./industrial.service.js";

@Module({
  imports: [FeatureFlagsModule],
  controllers: [IndustrialController, IndustrialOpsController, IndustrialAnalyticsController],
  providers: [IndustrialService, IndustrialOpsService, IndustrialAnalyticsService],
  exports: [IndustrialService, IndustrialOpsService, IndustrialAnalyticsService],
})
export class IndustrialModule {}
