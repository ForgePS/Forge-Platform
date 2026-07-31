import { Controller, Get, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { ProductsService } from "./products.service.js";

@Controller("api/v1/platform")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get("products")
  @RequirePermission("platform.entitlement.manage", { allowWhenSuspended: true })
  async listProducts(@Req() req: RequestWithIds) {
    return ok(await this.products.listProducts(), getRequestIds(req));
  }

  @Get("modules")
  @RequirePermission("platform.entitlement.manage", { allowWhenSuspended: true })
  async listModules(@Req() req: RequestWithIds) {
    return ok(await this.products.listModules(), getRequestIds(req));
  }
}
