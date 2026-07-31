"use client";

import { useState } from "react";
import { FxButton, FxDialog } from "@forge/fx-ui";

export function SupportEntryPoint({
  environment,
  appVersion,
}: {
  environment?: string;
  appVersion?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FxButton tone="ghost" aria-label="Support" onClick={() => setOpen(true)}>
        Support
      </FxButton>
      <FxDialog
        open={open}
        title="Support"
        onClose={() => setOpen(false)}
        actions={
          <FxButton tone="secondary" onClick={() => setOpen(false)}>
            Close
          </FxButton>
        }
      >
        <p>Contact Forge support through your organization&apos;s approved channel.</p>
        <dl className="rms-fx-support-meta">
          <div>
            <dt>Product</dt>
            <dd>Forge RMS</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{environment ?? "unknown"}</dd>
          </div>
          {appVersion ? (
            <div>
              <dt>App version</dt>
              <dd>{appVersion}</dd>
            </div>
          ) : null}
        </dl>
      </FxDialog>
    </>
  );
}
