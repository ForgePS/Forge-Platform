import { Module } from "@nestjs/common";
import { DocumentStorageService } from "../neris-incidents/document-storage.service.js";
import { BrandingController } from "./branding.controller.js";
import { BrandingService } from "./branding.service.js";

@Module({
  controllers: [BrandingController],
  providers: [BrandingService, DocumentStorageService],
  exports: [BrandingService],
})
export class BrandingModule {}
