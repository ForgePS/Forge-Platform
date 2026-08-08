import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module.js";
import { IndustrialController } from "./industrial.controller.js";
import { IndustrialOpsController } from "./industrial-ops.controller.js";
import { IndustrialOpsService } from "./industrial-ops.service.js";
import { IndustrialService } from "./industrial.service.js";

@Module({
  imports: [FeatureFlagsModule],
  controllers: [IndustrialController, IndustrialOpsController],
  providers: [IndustrialService, IndustrialOpsService],
  exports: [IndustrialService, IndustrialOpsService],
})
export class IndustrialModule {}
