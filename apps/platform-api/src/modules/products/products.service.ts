import { Inject, Injectable } from "@nestjs/common";
import {
  platformModules,
  platformProducts,
  subscriptionPlans,
  type Database,
} from "@forge/database";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listProducts() {
    return this.db.query.platformProducts.findMany({
      where: eq(platformProducts.status, "ACTIVE"),
      orderBy: (t, { asc }) => [asc(t.code)],
    });
  }

  async listModules() {
    return this.db.query.platformModules.findMany({
      where: eq(platformModules.status, "ACTIVE"),
      orderBy: (t, { asc }) => [asc(t.code)],
    });
  }

  async listPlans() {
    return this.db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.status, "ACTIVE"),
      orderBy: (t, { asc }) => [asc(t.code)],
    });
  }
}
