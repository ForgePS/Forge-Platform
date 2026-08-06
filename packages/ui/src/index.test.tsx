/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Can, ForgePageHeader, Input } from "./index.js";

describe("ui accessibility", () => {
  it("renders input with accessible label", () => {
    render(<Input id="email" label="Email address" />);
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("Can hides children when not allowed", () => {
    render(
      <Can allowed={false} fallback={<span>denied</span>}>
        <span>secret</span>
      </Can>,
    );
    expect(screen.getByText("denied")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders page header title", () => {
    render(<ForgePageHeader title="Creator Console" subtitle="Ops" />);
    expect(screen.getByRole("heading", { name: "Creator Console" })).toBeTruthy();
  });
});
