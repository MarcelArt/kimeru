import { History, LoaderCircle, Trash2 } from "lucide-react";
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
  loadingRun,
  onOpenRun,
  onDeleteRun,
}: {
  runs: RunSummary[];
  loadingRun: string;
  onOpenRun: (id: string) => void;
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
              <button
                className="history-main"
                onClick={() => onOpenRun(item.id)}
                disabled={!!loadingRun}
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
              </button>
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
                {loadingRun === item.id ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Trash2 />
                )}
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
