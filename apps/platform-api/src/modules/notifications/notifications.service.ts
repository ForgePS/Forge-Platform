import { Inject, Injectable } from "@nestjs/common";
import {
  createNotificationInputSchema,
  EMAIL_TEMPLATE_KEYS,
  type CreateNotificationInput,
  type EmailMessage,
} from "@forge/contracts";
import {
  createId,
  type Database,
  userNotifications,
  withTenantTransaction,
} from "@forge/database";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createLogger, logOperationalFailure } from "@forge/observability";
import { DATABASE } from "../../tokens.js";
import {
  createEmailProviderFromEnv,
  renderTemplate,
  type EmailProvider,
} from "./email-provider.js";

const emailLogger = createLogger({
  service: "platform-api-email",
  environment: process.env.APP_ENV ?? "local",
});

const DEFAULT_EMAIL_BODIES: Record<
  (typeof EMAIL_TEMPLATE_KEYS)[number],
  { subject: string; htmlBody: string; textBody: string }
> = {
  welcome: {
    subject: "Welcome to Forge",
    htmlBody: "<p>Welcome {{displayName}}. Your tenant is ready.</p>",
    textBody: "Welcome {{displayName}}. Your tenant is ready.",
  },
  verification: {
    subject: "Verify your email",
    htmlBody: "<p>Verify your email for {{tenantName}}.</p>",
    textBody: "Verify your email for {{tenantName}}.",
  },
  invitation: {
    subject: "You are invited to {{tenantName}}",
    htmlBody: "<p>You have been invited to join {{tenantName}}.</p>",
    textBody: "You have been invited to join {{tenantName}}.",
  },
  membership_changed: {
    subject: "Membership update",
    htmlBody: "<p>Your membership status is now {{status}}.</p>",
    textBody: "Your membership status is now {{status}}.",
  },
  billing: {
    subject: "Billing update",
    htmlBody: "<p>A billing update is available for {{tenantName}}.</p>",
    textBody: "A billing update is available for {{tenantName}}.",
  },
  security: {
    subject: "Security notice",
    htmlBody: "<p>Security notice: {{detail}}</p>",
    textBody: "Security notice: {{detail}}.",
  },
  system_notification: {
    subject: "System notification",
    htmlBody: "<p>{{detail}}</p>",
    textBody: "{{detail}}",
  },
};

@Injectable()
export class NotificationsService {
  private readonly email: EmailProvider;

  constructor(@Inject(DATABASE) private readonly db: Database) {
    this.email = createEmailProviderFromEnv();
  }

  async listForUser(tenantId: string, userId: string, limit = 50) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.userNotifications.findMany({
        where: and(
          eq(userNotifications.tenantId, tenantId),
          eq(userNotifications.userId, userId),
        ),
        orderBy: [desc(userNotifications.createdAt)],
        limit: Math.min(Math.max(limit, 1), 100),
      });
    });
  }

  async unreadCount(tenantId: string, userId: string): Promise<number> {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
            isNull(userNotifications.readAt),
          ),
        );
      return rows[0]?.count ?? 0;
    });
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const now = new Date();
      const [row] = await tx
        .update(userNotifications)
        .set({ readAt: now, updatedAt: now })
        .where(
          and(
            eq(userNotifications.id, notificationId),
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
          ),
        )
        .returning();
      return row ?? null;
    });
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const now = new Date();
      const updated = await tx
        .update(userNotifications)
        .set({ readAt: now, updatedAt: now })
        .where(
          and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
            isNull(userNotifications.readAt),
          ),
        )
        .returning({ id: userNotifications.id });
      return updated.length;
    });
  }

  async create(
    tenantId: string,
    input: unknown,
    principal: ForgePrincipal,
    vars: Record<string, string> = {},
  ) {
    const data = createNotificationInputSchema.parse(input) as CreateNotificationInput;
    const now = new Date();
    const id = createId();

    const row = await withTenantTransaction(this.db, tenantId, async (tx) => {
      const [created] = await tx
        .insert(userNotifications)
        .values({
          id,
          tenantId,
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          priority: data.priority,
          destination: data.destination,
          href: data.href ?? null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          metadataJson: {
            ...(data.metadataJson ?? {}),
            createdByUserId: principal.userId,
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return created;
    });

    let emailResult = null;
    if (
      (data.destination === "EMAIL" || data.destination === "BOTH") &&
      data.emailTo
    ) {
      emailResult = await this.sendTemplatedEmail({
        to: data.emailTo,
        templateKey: data.emailTemplateKey ?? "system_notification",
        tenantId,
        vars: {
          ...vars,
          detail: data.body,
          title: data.title,
        },
      });
    }

    return { notification: row, email: emailResult };
  }

  async sendTemplatedEmail(input: {
    to: string;
    templateKey: (typeof EMAIL_TEMPLATE_KEYS)[number];
    tenantId?: string;
    vars?: Record<string, string>;
  }) {
    const seeded = DEFAULT_EMAIL_BODIES[input.templateKey];
    const vars = input.vars ?? {};
    const message: EmailMessage = {
      to: input.to,
      subject: renderTemplate(seeded.subject, vars),
      htmlBody: renderTemplate(seeded.htmlBody, vars),
      textBody: renderTemplate(seeded.textBody, vars),
      templateKey: input.templateKey,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    };
    const result = await this.email.send(message);
    if (!result.accepted) {
      logOperationalFailure(emailLogger, {
        category: "EMAIL",
        message: "Email send not accepted",
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        code: "EMAIL_NOT_ACCEPTED",
        fields: {
          provider: result.provider,
          templateKey: input.templateKey,
          ...(result.detail ? { detail: result.detail } : {}),
        },
      });
    }
    return result;
  }

  getEmailProviderName(): string {
    return this.email.name;
  }
}
