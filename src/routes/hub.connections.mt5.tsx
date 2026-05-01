// /hub/connections/mt5 — Manual MT5 CSV upload (Pro-gated).
//
// The Pro-tier path: drop a history export, get every closed deal mapped
// into the unified Trade pipeline. Behavioral nudges and the automation
// upgrade screen do the rest of the storytelling.

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { HubPageContainer } from "@/components/layout/HubLayout";
import { Mt5CsvUpload } from "@/components/feature/Mt5CsvUpload";

export const Route = createFileRoute("/hub/connections/mt5")({
  head: () => ({
    meta: [
      { title: "MT5 CSV Import — SenecaEdge" },
      {
        name: "description",
        content:
          "Upload your MT5 closed-deal history. Seneca maps every trade so your behavior score reflects what actually happened.",
      },
    ],
  }),
  component: Mt5UploadPage,
});

function Mt5UploadPage() {
  return (
    <HubPageContainer
      eyebrow="MT5 import"
      title="Upload closed deals"
      subtitle="Drop your MT5 history export. Seneca maps every closed deal into your journal — duplicates are skipped automatically."
    >
      <div className="mb-4">
        <Link
          to="/hub/connections"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9A9A9A] hover:text-[#EDEDED]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Connections
        </Link>
      </div>
      <Mt5CsvUpload />
    </HubPageContainer>
  );
}
