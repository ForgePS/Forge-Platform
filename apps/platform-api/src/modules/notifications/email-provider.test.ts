import { describe, expect, it } from "vitest";
import {
  NoopEmailProvider,
  SesEmailProvider,
  createEmailProviderFromEnv,
  renderTemplate,
} from "./email-provider.js";

describe("email provider (MK-S13)", () => {
  it("noop accepts messages", async () => {
    const provider = new NoopEmailProvider();
    const result = await provider.send({
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });
    expect(result.accepted).toBe(true);
    expect(result.provider).toBe("noop");
  });

  it("ses stub without sendFn does not accept", async () => {
    const provider = new SesEmailProvider({ fromAddress: "noreply@example.com" });
    const result = await provider.send({
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });
    expect(result.accepted).toBe(false);
    expect(result.provider).toBe("ses");
  });

  it("createEmailProviderFromEnv defaults to noop", () => {
    expect(createEmailProviderFromEnv({}).name).toBe("noop");
    expect(createEmailProviderFromEnv({ FORGE_EMAIL_PROVIDER: "ses" }).name).toBe("ses");
  });

  it("renders template variables", () => {
    expect(renderTemplate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
  });
});
