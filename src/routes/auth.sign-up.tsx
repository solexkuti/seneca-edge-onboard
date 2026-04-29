import { createFileRoute } from "@tanstack/react-router";
import AuthForm from "@/components/auth/AuthForm";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [
      { title: "Create your account — SenecaEdge" },
      {
        name: "description",
        content: "Create your SenecaEdge account.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
