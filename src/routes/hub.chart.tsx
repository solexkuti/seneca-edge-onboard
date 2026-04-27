import { createFileRoute } from "@tanstack/react-router";
import ChartAnalyzer from "@/components/feature/ChartAnalyzer";

export const Route = createFileRoute("/hub/chart")({
  head: () => ({
    meta: [
      { title: "Chart Analyzer — SenecaEdge" },
      {
        name: "description",
        content:
          "Drop your chart and get instant insight based on your strategy.",
      },
    ],
  }),
  component: ChartAnalyzer,
});
