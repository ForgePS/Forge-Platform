/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./index.js";

describe("ui accessibility", () => {
  it("renders input with accessible label", () => {
    render(<Input id="email" label="Email address" />);
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });
});
