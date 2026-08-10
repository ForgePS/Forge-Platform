/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Can,
  ForgeFacilitySelector,
  ForgePageHeader,
  ForgeSearchTrigger,
  ForgeShellState,
  Input,
} from "./index.js";

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

describe("MK-S8 shell chrome", () => {
  it("renders facility empty state", () => {
    render(<ForgeFacilitySelector facilities={[]} state="empty" />);
    expect(screen.getByText("No facilities")).toBeTruthy();
  });

  it("renders disabled search trigger", () => {
    render(<ForgeSearchTrigger />);
    const btn = screen.getByRole("button", { name: "Search" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("renders shell loading / unauthorized / disabled entitlement states", () => {
    const { rerender } = render(<ForgeShellState state="loading" title="Loading shell…" />);
    expect(screen.getByText("Loading shell…")).toBeTruthy();

    rerender(<ForgeShellState state="unauthorized" title="Unauthorized" description="Denied" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Unauthorized")).toBeTruthy();

    rerender(
      <ForgeShellState state="disabled_entitlement" title="Not entitled" description="Module off" />,
    );
    expect(screen.getByText("Not entitled")).toBeTruthy();
    expect(screen.getByText("Module off")).toBeTruthy();
  });
});
