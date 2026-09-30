import { Module } from "@nestjs/common";
import {
  RmsApparatusController,
  RmsHydrantFlowTestsController,
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

@Module({
  controllers: [
    RmsStationsController,
    RmsShiftsController,
    RmsApparatusController,
    RmsHydrantsController,
    RmsHydrantFlowTestsController,
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
