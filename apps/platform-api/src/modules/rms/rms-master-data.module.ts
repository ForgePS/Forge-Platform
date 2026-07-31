import { Module } from "@nestjs/common";
import {
  RmsApparatusController,
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
