import { Module } from "@nestjs/common";
import { IndustrialController } from "./industrial.controller.js";
import { IndustrialService } from "./industrial.service.js";

@Module({
  controllers: [IndustrialController],
  providers: [IndustrialService],
  exports: [IndustrialService],
})
export class IndustrialModule {}
