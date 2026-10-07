import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata = { title: "Karibu" };

export default function Page() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  );
}
