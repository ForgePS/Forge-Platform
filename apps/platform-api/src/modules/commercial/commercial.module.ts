import { Module } from "@nestjs/common";
import { CommercialOpsController } from "./commercial-ops.controller.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";
import { CommercialSubscriptionsController } from "./commercial-subscriptions.controller.js";
import { CommercialSubscriptionsService } from "./commercial-subscriptions.service.js";
import { ContractsService } from "./contracts.service.js";
import { CreditsService } from "./credits.service.js";
import { CommercialJobsService } from "./commercial-jobs.service.js";
import { DiscountsService } from "./discounts.service.js";
import { EntitlementSyncService } from "./entitlement-sync.service.js";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";
import { PlansController } from "./plans.controller.js";
import { PlansService } from "./plans.service.js";
import { ReconciliationService } from "./reconciliation.service.js";
import { RevenueController } from "./revenue.controller.js";
import { RevenueService } from "./revenue.service.js";

@Module({
  controllers: [
    PlansController,
    CommercialSubscriptionsController,
    InvoicesController,
    PaymentsController,
    RevenueController,
    CommercialOpsController,
  ],
  providers: [
    CommercialSequencesService,
    PlansService,
    CommercialSubscriptionsService,
    EntitlementSyncService,
    InvoicesService,
    PaymentsService,
    CreditsService,
    DiscountsService,
    ContractsService,
    RevenueService,
    ReconciliationService,
    CommercialJobsService,
  ],
  exports: [
    CommercialSequencesService,
    CommercialSubscriptionsService,
    InvoicesService,
    PaymentsService,
    RevenueService,
    CommercialJobsService,
  ],
})
export class CommercialModule {}
