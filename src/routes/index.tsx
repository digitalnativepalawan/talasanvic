import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import TalaApp from "../components/TalaApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TALA — SanVic.ph AI Voice Concierge" },
      {
        name: "description",
        content:
          "TALA is your AI voice concierge for San Vicente, Palawan — discover food, tours, stays, and fellow travelers.",
      },
      { property: "og:title", content: "TALA — SanVic.ph AI Voice Concierge" },
      { property: "og:description", content: "Your AI voice concierge for San Vicente, Palawan." },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <TalaApp />;
}
