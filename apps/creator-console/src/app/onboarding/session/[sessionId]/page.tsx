"use client";

import { useParams } from "next/navigation";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function ResumeOnboardingPage() {
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  return (
    <PlatformPageGate title="Continue setup" permission="platform.onboarding.manage">
      <OnboardingWizard initialSessionId={sessionId || undefined} />
    </PlatformPageGate>
  );
}
