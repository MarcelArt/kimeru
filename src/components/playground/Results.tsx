import { useState } from "react";
import { cn } from "#/lib/utils";
import { Download, LoaderCircle, ScanLine, Clock3 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "#/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type { Answer, Run } from "#/lib/domain";
import { downloadJson, formatDate } from "./shared";

function percent(value: number) {
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

type DistributionRow = { id: string; label: string; probability: number };
function Distribution({
  rows,
  ordered = false,
}: {
  rows: DistributionRow[];
  ordered?: boolean;
}) {
  const displayRows = ordered
    ? rows
    : [...rows].sort((a, b) => b.probability - a.probability);
  return (
    <div className="distribution">
      {displayRows.map(({ id, label, probability }, index) => (
        <div className="probability-row" key={id}>
          <span title={label}>{label}</span>
          <div className="probability-track">
            <div
              className={cn(
                "probability-fill",
                [
                  "probability-0",
                  "probability-1",
                  "probability-2",
                  "probability-3",
                  "probability-4",
                ][Math.min(index, 4)],
              )}
              style={{
                width: `${Math.max(0, Math.min(100, probability * 100))}%`,
              }}
            />
          </div>
          <code>{percent(probability)}</code>
        </div>
      ))}
    </div>
  );
}

function BoxResult({
  answer,
  run,
  questionId,
}: {
  answer: Answer;
  run: Run;
  questionId: string;
}) {
  const [visible, setVisible] = useState(true);
  const question = run.input.questions.find((item) => item.id === questionId);
  const imageId =
    answer.targetImageId ||
    (question?.type === "box" ? question.targetImageId : "");
  const image = run.input.images.find((item) => item.id === imageId);
  if (!answer.box) return <p className="muted-copy">No region returned.</p>;
  const box = answer.box;
  return (
    <div className="box-result">
      {image ? (
        <>
          <div className="image-result-toolbar">
            <span>{image.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisible(!visible)}
            >
              <ScanLine data-icon="inline-start" />
              {visible ? "Hide box" : "Show box"}
            </Button>
          </div>
          <div className="result-image">
            <img src={image.dataUrl} alt={`Source image for ${questionId}`} />
            {visible && (
              <div
                className="result-box"
                style={{
                  left: `${box.left * 100}%`,
                  top: `${box.top * 100}%`,
                  width: `${(box.right - box.left) * 100}%`,
                  height: `${(box.bottom - box.top) * 100}%`,
                }}
              >
                <span>{questionId}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <Alert>
          <AlertDescription>
            The source image is unavailable for this region.
          </AlertDescription>
        </Alert>
      )}
      <div className="box-coordinates">
        <span>
          left <code>{box.left.toFixed(3)}</code>
        </span>
        <span>
          top <code>{box.top.toFixed(3)}</code>
        </span>
        <span>
          right <code>{box.right.toFixed(3)}</code>
        </span>
        <span>
          bottom <code>{box.bottom.toFixed(3)}</code>
        </span>
      </div>
      <p className="result-help">
        A box locates a region. Use a separate presence question when an object
        may be absent.
      </p>
    </div>
  );
}

export function Results({
  run,
  pending,
  stale,
}: {
  run: Run | null;
  pending: boolean;
  stale: boolean;
}) {
  return (
    <section className="results-pane">
      <div className="section-heading">
        <h2>Results</h2>
        {pending ? (
          <Badge variant="secondary">
            <LoaderCircle className="animate-spin" /> Running
          </Badge>
        ) : run ? (
          <Badge variant={run.status === "error" ? "destructive" : "outline"}>
            {run.status === "error" ? "Failed" : "Completed"}
          </Badge>
        ) : (
          <span className="count-label">No run yet</span>
        )}
      </div>
      {run && stale && (
        <div className="snapshot-notice">
          Inputs have changed. These results belong to the previous run.
        </div>
      )}
      {pending && !run ? (
        <div className="results-loading">
          <LoaderCircle className="animate-spin" />
          <h3>Asking your model…</h3>
          <p>Decisions will appear here when the provider responds.</p>
        </div>
      ) : !run ? (
        <Empty className="results-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanLine />
            </EmptyMedia>
            <EmptyTitle>See the decision.</EmptyTitle>
            <EmptyDescription>
              Choose a connection, supply your state, and run your questions.
              Results will stay beside your inputs.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="run-metadata">
            <span>
              <Clock3 />
              {formatDate(run.createdAt)}
            </span>
            <span>{run.durationMs.toLocaleString()} ms</span>
          </div>
          <p className="run-model">
            {run.connectionName}
            <span>/</span>
            <code>{run.result?.model || run.model}</code>
          </p>
          {run.error && (
            <Alert variant="destructive">
              <AlertTitle>Provider request failed</AlertTitle>
              <AlertDescription>{run.error}</AlertDescription>
            </Alert>
          )}
          <Tabs defaultValue="overview" className="result-tabs">
            <div className="result-tabbar">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="json">Raw JSON</TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Export run JSON"
                onClick={() => downloadJson(`kimeru-run-${run.id}.json`, run)}
              >
                <Download />
              </Button>
            </div>
            <TabsContent value="overview">
              <div className="answer-stack">
                {Object.entries(run.result?.answers || {}).map(
                  ([id, answer]) => (
                    <article className="answer-block" key={id}>
                      <div className="answer-heading">
                        <code>{id}</code>
                        <Badge variant="outline">
                          {answer.type === "noul"
                            ? "Noul"
                            : answer.type[0].toUpperCase() +
                              answer.type.slice(1)}
                        </Badge>
                      </div>
                      {answer.type === "choice" && (
                        <>
                          <div className="answer-main">
                            {answer.choice || "No choice returned"}
                          </div>
                          {answer.probabilities && (
                            <Distribution
                              rows={Object.entries(answer.probabilities).map(
                                ([name, probability]) => ({
                                  id: name,
                                  label: name,
                                  probability,
                                }),
                              )}
                            />
                          )}
                          <p className="result-help">Probability by option</p>
                        </>
                      )}
                      {answer.type === "score" && (
                        <>
                          <div className="answer-main numeric">
                            {answer.score?.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            }) ?? "—"}
                            {answer.legend && (
                              <small> / {answer.legend.length - 1}</small>
                            )}
                          </div>
                          {answer.probabilities && (
                            <Distribution
                              ordered
                              rows={Object.entries(answer.probabilities)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([level, probability]) => ({
                                  id: level,
                                  label: `${level} · ${answer.legend?.[Number(level)] || `Level ${level}`}`,
                                  probability,
                                }))}
                            />
                          )}
                          <p className="result-help">
                            Weighted score
                            {answer.legend
                              ? ` · ${answer.legend[0]} to ${answer.legend.at(-1)}`
                              : ""}
                          </p>
                        </>
                      )}
                      {answer.type === "noul" && (
                        <>
                          <div className="answer-main numeric">
                            {answer.noul === undefined
                              ? "—"
                              : percent(answer.noul)}
                          </div>
                          <div className="truth-track">
                            <div
                              style={{ width: `${(answer.noul || 0) * 100}%` }}
                            />
                          </div>
                          <p className="result-help">Probability of truth</p>
                        </>
                      )}
                      {answer.type === "box" && (
                        <BoxResult answer={answer} questionId={id} run={run} />
                      )}
                      {answer.confidence !== undefined && (
                        <div className="confidence">
                          <span>Confidence</span>
                          <code>
                            {answer.confidence.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            })}
                          </code>
                          <span className="confidence-explanation">
                            {answer.type === "box"
                              ? "Model-reported region confidence."
                              : "Distribution concentration; not selected-answer probability."}
                          </span>
                        </div>
                      )}
                    </article>
                  ),
                )}
              </div>
            </TabsContent>
            <TabsContent value="json">
              <pre className="json-response">
                {JSON.stringify(
                  run.result?.raw ?? { error: run.error },
                  null,
                  2,
                )}
              </pre>
            </TabsContent>
          </Tabs>
          <div className="run-footer">
            This run preserves the state, questions, and images sent to the
            model.
          </div>
        </>
      )}
    </section>
  );
}
