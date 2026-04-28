import { createFileRoute } from "@tanstack/react-router";
import AiMentorChat from "@/components/feature/AiMentorChat";
import RequireAuth from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/hub/mentor")({
  head: () => ({
    meta: [
      { title: "AI Mentor — SenecaEdge" },
      {
        name: "description",
        content:
          "A disciplined AI trading mentor. Honest, structured, and aware of how you trade.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AiMentorChat />
    </RequireAuth>
  ),
});
