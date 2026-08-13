/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Can,
  ForgeAppShell,
  ForgePageContainer,
  ForgePageHeader,
  ForgeStatusBadge,
  humanizeStatus,
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

  it("humanizes status badges", () => {
    expect(humanizeStatus("MIGRATION_IN_PROGRESS")).toBe("Migration in Progress");
    render(<ForgeStatusBadge status="ACTIVE" />);
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders page container", () => {
    const { container } = render(
      <ForgePageContainer>
        <p>body</p>
      </ForgePageContainer>,
    );
    expect(container.querySelector(".forge-page-container")).toBeTruthy();
  });

  it("closes mobile nav drawer on Escape", () => {
    render(
      <ForgeAppShell
        brand="Forge"
        groups={[
          { id: "g", label: "Overview", items: [{ id: "home", label: "Home", route: "/" }] },
        ]}
        activePath="/"
        renderLink={({ href, children, className }) => (
          <a href={href} className={className}>
            {children}
          </a>
        )}
      >
        <p>content</p>
      </ForgeAppShell>,
    );
    fireEvent.click(screen.getByLabelText("Open navigation"));
    expect(document.body.classList.contains("forge-nav-open")).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body.classList.contains("forge-nav-open")).toBe(false);
  });
});
