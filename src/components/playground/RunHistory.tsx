import { Link } from "@tanstack/react-router";
import { History, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "#/components/ui/empty";
import type { RunSummary } from "#/lib/domain";
import { formatDate } from "./shared";

export function RunHistory({
  runs,
  onDeleteRun,
}: {
  runs: RunSummary[];
  onDeleteRun: (run: RunSummary) => void;
}) {
  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <h1>Run history</h1>
          <p>A record of the questions you asked.</p>
        </div>
        <Badge variant="outline">Only visible to you</Badge>
      </div>
      {runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No runs yet.</EmptyTitle>
            <EmptyDescription>
              Your saved executions will appear here after you run a playground.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="history-list">
          {runs.map((item) => (
            <article className="history-row" key={item.id}>
              <Link
                className="history-main"
                to="/runs/$runId"
                params={{ runId: item.id }}
              >
                <div>
                  <h2>{item.title}</h2>
                  <p>
                    {item.connectionName}
                    <span> / </span>
                    <code>{item.model}</code>
                  </p>
                </div>
                <span>{formatDate(item.createdAt)}</span>
              </Link>
              <Badge
                variant={item.status === "error" ? "destructive" : "outline"}
              >
                {item.status === "error" ? "Failed" : "Completed"}
              </Badge>
              <span className="history-duration">
                {item.durationMs.toLocaleString()} ms
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete run ${item.title}`}
                onClick={() => onDeleteRun(item)}
              >
                <Trash2 />
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
