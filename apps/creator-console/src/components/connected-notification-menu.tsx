"use client";

import { useCallback, useEffect, useState } from "react";
import { ForgeNotificationMenu, type ForgeLinkRender } from "@forge/ui";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiSend } from "@/lib/api";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export function ConnectedNotificationMenu({
  viewAllHref = "/notifications",
  renderLink,
}: {
  viewAllHref?: string;
  renderLink?: ForgeLinkRender;
}) {
  const { me, hasPermission } = useAuth();
  const tenantId = me?.tenantId ?? null;
  const canRead = hasPermission("tenant.notification.read");
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    if (!tenantId || !canRead) {
      setCount(0);
      setItems([]);
      return;
    }
    try {
      const [countRes, list] = await Promise.all([
        apiGet<{ count: number }>(`/api/v1/tenants/${tenantId}/notifications/unread-count`),
        apiGet<NotificationRow[]>(`/api/v1/tenants/${tenantId}/notifications?limit=8`),
      ]);
      setCount(countRes.count);
      setItems(list);
    } catch {
      setCount(0);
      setItems([]);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead || !tenantId) {
    return (
      <ForgeNotificationMenu
        disabled
        disabledReason={
          !tenantId
            ? "Select a tenant to view notifications"
            : "Missing permission: tenant.notification.read"
        }
      />
    );
  }

  return (
    <ForgeNotificationMenu
      disabled={false}
      count={count}
      open={open}
      onToggle={() => {
        setOpen((value) => !value);
        if (!open) void load();
      }}
      items={items.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.createdAt,
        readAt: row.readAt,
      }))}
      onMarkRead={(id) => {
        void apiSend(`/api/v1/tenants/${tenantId}/notifications/${id}/read`, "POST").then(() =>
          load(),
        );
      }}
      onMarkAllRead={() => {
        void apiSend(`/api/v1/tenants/${tenantId}/notifications/read-all`, "POST").then(() =>
          load(),
        );
      }}
      viewAllHref={viewAllHref}
      {...(renderLink ? { renderLink } : {})}
    />
  );
}
