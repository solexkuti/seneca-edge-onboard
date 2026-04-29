import { createFileRoute } from "@tanstack/react-router";
import AuthForm from "@/components/auth/AuthForm";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — SenecaEdge" },
      {
        name: "description",
        content: "Sign in to SenecaEdge and pick up where you left off.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <AuthForm mode="signin" />,
});
