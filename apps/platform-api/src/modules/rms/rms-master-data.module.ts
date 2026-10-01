import { Module } from "@nestjs/common";
import {
  RmsApparatusController,
  RmsHydrantDamageReportsController,
  RmsHydrantFlowTestsController,
  RmsHydrantInspectionsController,
  RmsHydrantsController,
  RmsEquipmentController,
  RmsEquipmentAssignmentsController,
  RmsEquipmentMeterReadingsController,
  RmsInventoryItemsController,
  RmsInventoryTransactionsController,
  RmsOccupanciesController,
  RmsPersonnelController,
  RmsPreplansController,
  RmsRostersController,
  RmsShiftsController,
  RmsStationsController,
  RmsUnitsController,
} from "./rms-master-data.controllers.js";
import { RmsMasterDataService } from "./rms-master-data.service.js";

@Module({
  controllers: [
    RmsStationsController,
    RmsShiftsController,
    RmsApparatusController,
    RmsHydrantsController,
    RmsHydrantFlowTestsController,
    RmsHydrantInspectionsController,
    RmsHydrantDamageReportsController,
    RmsEquipmentController,
    RmsEquipmentAssignmentsController,
    RmsEquipmentMeterReadingsController,
    RmsInventoryItemsController,
    RmsInventoryTransactionsController,
    RmsUnitsController,
    RmsPersonnelController,
    RmsRostersController,
    RmsOccupanciesController,
    RmsPreplansController,
  ],
  providers: [RmsMasterDataService],
  exports: [RmsMasterDataService],
})
export class RmsMasterDataModule {}
