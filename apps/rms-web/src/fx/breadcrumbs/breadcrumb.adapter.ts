export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function buildBreadcrumbs(
  pathname: string,
  options?: { incidentLabel?: string },
): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
  const normalized = pathname.endsWith("/") || pathname === "/" ? pathname : `${pathname}/`;

  if (normalized === "/") {
    return [{ label: "Home" }];
  }

  if (normalized.startsWith("/incidents/")) {
    crumbs.push({ label: "Incidents", href: "/incidents/" });
    if (normalized === "/incidents/new/") {
      crumbs.push({ label: "Create" });
      return crumbs;
    }
    const match = normalized.match(/^\/incidents\/([^/]+)\/?$/);
    if (match && match[1] !== "new") {
      crumbs.push({
        label: options?.incidentLabel ?? "Incident",
      });
    }
    return crumbs;
  }

  if (normalized.startsWith("/review/")) {
    crumbs.push({ label: "Review Queue" });
    return crumbs;
  }

  if (normalized.startsWith("/configuration/")) {
    crumbs.push({ label: "NERIS Configuration" });
    return crumbs;
  }

  if (normalized.startsWith("/cad/")) {
    crumbs.push({ label: "CAD", href: "/cad/operations/" });
    const segment = normalized.replace(/^\/cad\//, "").replace(/\/$/, "");
    const labels: Record<string, string> = {
      operations: "Operations",
      conflicts: "Conflicts",
      messages: "Messages",
      connections: "Connections",
      unmapped: "Unmapped",
      mappings: "Unit / Personnel",
    };
    crumbs.push({ label: labels[segment] ?? segment });
    return crumbs;
  }

  if (normalized.startsWith("/select-tenant/")) {
    crumbs.push({ label: "Select tenant" });
    return crumbs;
  }

  if (normalized.startsWith("/login/")) {
    crumbs.push({ label: "Sign in" });
    return crumbs;
  }

  if (normalized.startsWith("/health/")) {
    crumbs.push({ label: "Health" });
    return crumbs;
  }

  return crumbs;
}
