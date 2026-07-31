import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Response } from "express";
import type { ForgeEnvironment } from "@forge/environment";
import { ForgeError, isForgeError } from "@forge/errors";
import { createCorrelationId } from "@forge/security";
import { ZodError } from "zod";
import { fail } from "./common/api-response.js";
import type { RequestWithIds } from "./common/request-ids.js";
import { getRequestIds } from "./common/request-ids.js";
import { APP_ENV } from "./tokens.js";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(APP_ENV) private readonly env: ForgeEnvironment) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithIds>();
    const ids = getRequestIds(request);
    if (!request.correlationId) {
      request.correlationId = ids.correlationId || createCorrelationId();
    }

    if (exception instanceof ZodError) {
      response.status(400).json(
        fail(
          "VALIDATION_FAILED",
          "Request validation failed",
          ids,
          exception.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    if (isForgeError(exception)) {
      const payload = fail(
        exception.code,
        exception.exposeMessage ? exception.message : "An unexpected error occurred.",
        ids,
        exception.details,
      );
      if (this.env.APP_ENV === "local") {
        (payload.error as Record<string, unknown>).debugName = exception.name;
      }
      response.status(exception.statusCode).json(payload);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body && "message" in body
            ? Array.isArray((body as { message: unknown }).message)
              ? ((body as { message: string[] }).message.join(", "))
              : String((body as { message: unknown }).message)
            : exception.message;
      const code =
        status === HttpStatus.UNAUTHORIZED
          ? "UNAUTHORIZED"
          : status === HttpStatus.FORBIDDEN
            ? "FORBIDDEN"
            : status === HttpStatus.NOT_FOUND
              ? "NOT_FOUND"
              : status === HttpStatus.BAD_REQUEST
                ? "BAD_REQUEST"
                : status === HttpStatus.SERVICE_UNAVAILABLE
                  ? "INTERNAL_ERROR"
                  : "REQUEST_ERROR";
      response.status(status).json(fail(code, message, ids));
      return;
    }

    const payload = fail("INTERNAL_ERROR", "An unexpected error occurred.", ids);
    if (
      (this.env.APP_ENV === "local" || this.env.APP_ENV === "development") &&
      exception instanceof Error
    ) {
      (payload.error as Record<string, unknown>).debugName = exception.name;
      (payload.error as Record<string, unknown>).debugMessage = exception.message;
    }
    console.error(
      JSON.stringify({
        level: "error",
        message: "unhandled exception",
        correlationId: ids.correlationId,
        requestId: ids.requestId,
        name: exception instanceof Error ? exception.name : typeof exception,
        detail: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}

/** Re-export for tests that construct ForgeError responses. */
export { ForgeError };
