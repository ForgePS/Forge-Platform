import type { EmailMessage, EmailSendResult } from "@forge/contracts";

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class NoopEmailProvider implements EmailProvider {
  readonly name = "noop";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    return {
      provider: this.name,
      messageId: null,
      accepted: true,
      detail: `noop accepted mail to ${message.to} subject=${message.subject}`,
    };
  }
}

/**
 * SES-capable provider stub (MK-S13).
 * Does not call AWS until FORGE_EMAIL_PROVIDER=ses and SES_FROM_ADDRESS are set,
 * and a live SES client is injected. Default construction remains safe (noop path).
 */
export class SesEmailProvider implements EmailProvider {
  readonly name = "ses";

  constructor(
    private readonly options: {
      fromAddress: string;
      region?: string;
      /** Injected send function; when omitted, returns not-configured result. */
      sendFn?: (message: EmailMessage, fromAddress: string) => Promise<EmailSendResult>;
    },
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.options.fromAddress) {
      return {
        provider: this.name,
        messageId: null,
        accepted: false,
        detail: "SES_FROM_ADDRESS not configured",
      };
    }
    if (!this.options.sendFn) {
      return {
        provider: this.name,
        messageId: null,
        accepted: false,
        detail:
          "SES provider stub is configured but no sendFn/client is injected (production SES wiring deferred)",
      };
    }
    return this.options.sendFn(message, this.options.fromAddress);
  }
}

export function createEmailProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmailProvider {
  const mode = (env.FORGE_EMAIL_PROVIDER ?? "noop").toLowerCase();
  if (mode === "ses") {
    return new SesEmailProvider({
      fromAddress: env.SES_FROM_ADDRESS ?? "",
      ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
    });
  }
  return new NoopEmailProvider();
}

/** Minimal {{var}} substitution for seeded templates. */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
