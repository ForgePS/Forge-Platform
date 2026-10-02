import { Module } from "@nestjs/common";
import {
  RmsApparatusController,
  RmsHydrantDamageReportsController,
  RmsHydrantFlowTestsController,
  RmsHydrantInspectionsController,
  RmsHydrantsController,
  RmsOccupanciesController,
  RmsPersonnelController,
  RmsPreplansController,
  RmsRostersController,
  RmsShiftsController,
  RmsStationsController,
  RmsUnitsController,
} from "./rms-master-data.controllers.js";
import { RmsMasterDataService } from "./rms-master-data.service.js";
import { RmsInspectionFindingsController, RmsInspectionProgramsController, RmsInspectionsController, RmsInspectionTemplatesController } from "./rms-inspections.controller.js";
import { RmsInspectionsService } from "./rms-inspections.service.js";
import { RmsCodeCasesController, RmsCodeViolationsController } from "./rms-code-enforcement.controller.js";
import { RmsCodeEnforcementService } from "./rms-code-enforcement.service.js";
import { RmsInvestigationEvidenceController, RmsInvestigationsController } from "./rms-investigations.controller.js";
import { RmsInvestigationsService } from "./rms-investigations.service.js";

@Module({
  controllers: [
    RmsStationsController,
    RmsShiftsController,
    RmsApparatusController,
    RmsHydrantsController,
    RmsHydrantFlowTestsController,
    RmsHydrantInspectionsController,
    RmsHydrantDamageReportsController,
    RmsUnitsController,
    RmsPersonnelController,
    RmsRostersController,
    RmsOccupanciesController,
    RmsPreplansController,
    RmsInspectionProgramsController,
    RmsInspectionTemplatesController,
    RmsInspectionsController,
    RmsInspectionFindingsController,
    RmsCodeCasesController,
    RmsCodeViolationsController,
    RmsInvestigationsController,
    RmsInvestigationEvidenceController,
  ],
  providers: [RmsMasterDataService, RmsInspectionsService, RmsCodeEnforcementService, RmsInvestigationsService],
  exports: [RmsMasterDataService, RmsInspectionsService, RmsCodeEnforcementService, RmsInvestigationsService],
})
export class RmsMasterDataModule {}
