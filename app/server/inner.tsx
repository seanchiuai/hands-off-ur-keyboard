"use client";

import { Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.sessions.getActiveSession>;
}) {
  const data = usePreloadedQuery(preloaded);
  const createSession = useMutation(api.sessions.createSession);
  return (
    <>
      <div className="flex flex-col gap-4 bg-card p-4 rounded-md border border-border">
        <h2 className="text-xl font-bold">Reactive client-loaded data</h2>
        <code>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </code>
      </div>
      <button
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md mx-auto"
        onClick={() => {
          void createSession();
        }}
      >
        Create a session
      </button>
    </>
  );
}
