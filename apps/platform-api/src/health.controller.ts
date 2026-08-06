import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { ForgeEnvironment } from "@forge/environment";
import { checkDatabaseHealth, checkOutboxHealth } from "@forge/database";
import { Public } from "./modules/auth-context/public.decorator.js";
import { APP_ENV } from "./tokens.js";

@Controller()
export class HealthController {
  constructor(@Inject(APP_ENV) private readonly env: ForgeEnvironment) {}

  @Get("health")
  @Public()
  getHealth() {
    return {
      status: "healthy",
      service: "platform-api",
      environment: this.env.APP_ENV,
      version: this.env.APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @Public()
  async getReady() {
    let databaseOk = false;
    try {
      databaseOk = await checkDatabaseHealth(this.env.DATABASE_URL);
    } catch {
      databaseOk = false;
    }

    const outbox = await checkOutboxHealth(this.env.DATABASE_URL).catch(() => ({
      ok: false,
      pending: null as number | null,
      failed: null as number | null,
    }));

    if (!databaseOk) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        service: "platform-api",
        checks: {
          database: false,
          outbox: outbox.ok,
          outboxPending: outbox.pending,
          outboxFailed: outbox.failed,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: "ready",
      service: "platform-api",
      checks: {
        database: true,
        outbox: outbox.ok,
        outboxPending: outbox.pending,
        outboxFailed: outbox.failed,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
