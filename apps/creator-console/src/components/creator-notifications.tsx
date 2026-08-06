"use client";

import { useCallback, useEffect, useState } from "react";
import { ForgeNotificationMenu } from "@forge/ui";
import { useAuth } from "@forge/web-kit";
import { apiGet, listInvitations } from "@/lib/api";
import { tenantQuery } from "@/hooks/use-tenant-id";

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  result: string;
  riskLevel: string;
  occurredAt: string;
};

type NotificationItem = {
  id: string;
  title: string;
  href?: string;
  meta?: string;
};

export function CreatorNotifications() {
  const { me } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    if (!me?.tenantId) {
      setItems([]);
      return;
    }
    const tenantId = me.tenantId;
    const next: NotificationItem[] = [];

    const [invitationsResult, auditResult] = await Promise.allSettled([
      listInvitations({ tenantId }),
      apiGet<AuditEvent[]>(`/api/v1/tenants/${tenantId}/audit-events?page=1&pageSize=5`),
    ]);

    if (invitationsResult.status === "fulfilled") {
      const pending = invitationsResult.value.filter((row) =>
        ["DRAFT", "PENDING", "SENT"].includes(row.status),
      );
      for (const invite of pending.slice(0, 5)) {
        const item: NotificationItem = {
          id: `invite-${invite.id}`,
          title: `Invitation ${invite.status.toLowerCase()}: ${invite.email}`,
          href: `/invitations${tenantQuery(tenantId)}`,
        };
        if (invite.expiresAt) {
          item.meta = `Expires ${new Date(invite.expiresAt).toLocaleString()}`;
        }
        next.push(item);
      }
    }

    if (auditResult.status === "fulfilled") {
      for (const event of auditResult.value.filter((row) => row.riskLevel === "HIGH").slice(0, 5)) {
        next.push({
          id: `audit-${event.id}`,
          title: `${event.action} · ${event.result}`,
          href: `/audit${tenantQuery(tenantId)}`,
          meta: `${event.resourceType} · ${new Date(event.occurredAt).toLocaleString()}`,
        });
      }
    }

    setItems(next);
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ForgeNotificationMenu
      label="Notifications"
      count={items.length}
      items={items}
      emptyLabel={me ? "No pending invitations or high-risk audit events" : "Sign in to view alerts"}
    />
  );
}
