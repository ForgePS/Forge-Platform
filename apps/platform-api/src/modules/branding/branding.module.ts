import { Module } from "@nestjs/common";
import { ConfigurationModule } from "../configuration/configuration.module.js";
import { BrandingAssetsService } from "./branding-assets.service.js";
import { BrandingController } from "./branding.controller.js";
import { BrandingService } from "./branding.service.js";
import { LoginBrandingService } from "./login-branding.service.js";

@Module({
  imports: [ConfigurationModule],
  controllers: [BrandingController],
  providers: [BrandingService, BrandingAssetsService, LoginBrandingService],
  exports: [BrandingService, BrandingAssetsService, LoginBrandingService],
})
export class BrandingModule {}
