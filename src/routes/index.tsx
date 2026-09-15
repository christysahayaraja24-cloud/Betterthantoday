import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const APP_URL = "/app/index.html";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Better Than Yesterday — Habit & Streak Tracker" },
      {
        name: "description",
        content:
          "Track habits, streaks, XP and productivity with Better Than Yesterday — a dark, neon habit dashboard built in plain HTML, CSS and JavaScript.",
      },
      { property: "og:title", content: "Better Than Yesterday — Habit & Streak Tracker" },
      {
        property: "og:description",
        content: "Become better than yesterday: streaks, XP, monthly progress grid and live habit analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: APP_URL }],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace(APP_URL);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">Better Than Yesterday</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Opening the app… <a href={APP_URL}>Continue</a>
        </p>
      </div>
    </main>
  );
}
