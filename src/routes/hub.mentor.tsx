import { createFileRoute } from "@tanstack/react-router";
import AiMentor from "@/components/feature/AiMentor";

export const Route = createFileRoute("/hub/mentor")({
  head: () => ({
    meta: [
      { title: "AI Mentor — SenecaEdge" },
      {
        name: "description",
        content: "Real-time trading guidance to keep you disciplined.",
      },
    ],
  }),
  component: AiMentor,
});
