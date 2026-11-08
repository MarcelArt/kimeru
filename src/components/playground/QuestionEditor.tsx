import { Plus, Trash2, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Badge } from "#/components/ui/badge";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "#/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "#/components/ui/empty";
import { QUESTION_LABELS } from "#/lib/domain";
import type { ImageAttachment, Question, QuestionType } from "#/lib/domain";
import { Picker } from "./shared";

export function newQuestion(
  type: QuestionType,
  id: string,
  instructions = "",
  targetImageId = "",
): Question {
  if (type === "choice")
    return {
      id,
      type,
      instructions,
      criteria: {
        Yes: "Matches the condition",
        No: "Does not match the condition",
      },
    };
  if (type === "score")
    return {
      id,
      type,
      instructions,
      criteria: ["Poor", "Fair", "Good", "Excellent"],
    };
  if (type === "noul") return { id, type, instructions, criteria: {} };
  return { id, type, instructions, targetImageId };
}

function ChoiceCriteria({
  question,
  change,
}: {
  question: Extract<Question, { type: "choice" }>;
  change: (question: Question) => void;
}) {
  const entries = Object.entries(question.criteria);
  function update(index: number, field: "key" | "value", value: string) {
    const next = entries.map(([key, description], i) =>
      i === index
        ? [
            field === "key" ? value : key,
            field === "value" ? value : description,
          ]
        : [key, description],
    );
    if (
      field === "key" &&
      (!value.trim() || next.some(([key], i) => i !== index && key === value))
    )
      return false;
    change({ ...question, criteria: Object.fromEntries(next) });
    return true;
  }
  return (
    <div className="criteria-editor">
      <div className="criteria-column-labels">
        <span>Option</span>
        <span>When to choose it</span>
      </div>
      {entries.map(([key, description], index) => (
        <div className="choice-row" key={`${question.id}-${index}`}>
          <Input
            aria-label={`Option ${index + 1}`}
            defaultValue={key}
            key={`${index}-${key}`}
            onBlur={(event) => {
              if (!update(index, "key", event.target.value))
                event.currentTarget.value = key;
            }}
          />
          <Input
            aria-label={`Description for ${key}`}
            value={description}
            onChange={(event) => update(index, "value", event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${key}`}
            disabled={entries.length <= 2}
            onClick={() =>
              change({
                ...question,
                criteria: Object.fromEntries(
                  entries.filter((_, i) => i !== index),
                ),
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          let i = entries.length + 1;
          while (`Option ${i}` in question.criteria) i++;
          change({
            ...question,
            criteria: { ...question.criteria, [`Option ${i}`]: "" },
          });
        }}
      >
        <Plus data-icon="inline-start" />
        Add option
      </Button>
    </div>
  );
}

export function QuestionEditor({
  questions,
  images,
  onChange,
}: {
  questions: Question[];
  images: ImageAttachment[];
  onChange: (questions: Question[]) => void;
}) {
  function change(index: number, question: Question) {
    onChange(questions.map((item, i) => (i === index ? question : item)));
  }
  function add() {
    let number = questions.length + 1;
    while (questions.some((question) => question.id === `question_${number}`))
      number++;
    onChange([...questions, newQuestion("choice", `question_${number}`)]);
  }
  return (
    <section className="questions-section">
      <div className="section-heading">
        <h2>
          Questions <span className="count-label">{questions.length}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus data-icon="inline-start" />
          Add question
        </Button>
      </div>
      <div className="question-stack">
        {questions.map((question, index) => (
          <details
            className="question-item"
            key={index}
            open={questions.length === 1 ? true : undefined}
          >
            <summary>
              <span className="question-glyph">
                {question.type === "choice"
                  ? "◇"
                  : question.type === "score"
                    ? "≋"
                    : question.type === "noul"
                      ? "◐"
                      : "□"}
              </span>
              <code>{question.id || "Untitled question"}</code>
              <Badge variant="outline">{QUESTION_LABELS[question.type]}</Badge>
              <ChevronDown className="disclosure-icon" />
            </summary>
            <div className="question-content">
              <FieldGroup>
                <div className="question-identity">
                  <Field>
                    <FieldLabel htmlFor={`question-name-${index}`}>
                      Question ID
                    </FieldLabel>
                    <Input
                      id={`question-name-${index}`}
                      value={question.id}
                      onChange={(event) =>
                        change(index, {
                          ...question,
                          id: event.target.value.replace(
                            /[^A-Za-z0-9_.-]/g,
                            "_",
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Picker
                      label="Question type"
                      value={question.type}
                      onChange={(value) =>
                        change(
                          index,
                          newQuestion(
                            value as QuestionType,
                            question.id,
                            question.instructions,
                            images[0]?.id,
                          ),
                        )
                      }
                      options={Object.entries(QUESTION_LABELS).map(
                        ([value, label]) => ({ value, label }),
                      )}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`instructions-${index}`}>
                    Instructions
                  </FieldLabel>
                  <Textarea
                    id={`instructions-${index}`}
                    value={question.instructions}
                    onChange={(event) =>
                      change(index, {
                        ...question,
                        instructions: event.target.value,
                      })
                    }
                    placeholder={
                      question.type === "noul"
                        ? "Write a statement whose truth should be evaluated."
                        : "Describe the decision the model should make."
                    }
                    rows={3}
                  />
                </Field>
                {question.type === "choice" && (
                  <Field>
                    <FieldLabel>Criteria</FieldLabel>
                    <ChoiceCriteria
                      question={question}
                      change={(next) => change(index, next)}
                    />
                  </Field>
                )}
                {question.type === "score" && (
                  <Field>
                    <FieldLabel>Ordered criteria</FieldLabel>
                    <FieldDescription>
                      From lowest to highest. The score is a weighted value
                      between 0 and {question.criteria.length - 1}.
                    </FieldDescription>
                    <div className="score-criteria">
                      {question.criteria.map((criterion, criterionIndex) => (
                        <div className="score-row" key={criterionIndex}>
                          <span className="score-index">{criterionIndex}</span>
                          <Input
                            aria-label={`Score level ${criterionIndex}`}
                            value={criterion}
                            onChange={(event) =>
                              change(index, {
                                ...question,
                                criteria: question.criteria.map((item, i) =>
                                  i === criterionIndex
                                    ? event.target.value
                                    : item,
                                ),
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={question.criteria.length <= 2}
                            aria-label={`Remove level ${criterionIndex}`}
                            onClick={() =>
                              change(index, {
                                ...question,
                                criteria: question.criteria.filter(
                                  (_, i) => i !== criterionIndex,
                                ),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={question.criteria.length >= 10}
                        onClick={() =>
                          change(index, {
                            ...question,
                            criteria: [...question.criteria, ""],
                          })
                        }
                      >
                        <Plus data-icon="inline-start" />
                        Add level
                      </Button>
                    </div>
                  </Field>
                )}
                {question.type === "noul" && (
                  <>
                    <Field>
                      <FieldLabel htmlFor={`true-${index}`}>
                        True criteria{" "}
                        <span className="optional-label">optional</span>
                      </FieldLabel>
                      <Textarea
                        id={`true-${index}`}
                        value={question.criteria?.true || ""}
                        onChange={(event) =>
                          change(index, {
                            ...question,
                            criteria: {
                              ...question.criteria,
                              true: event.target.value,
                            },
                          })
                        }
                        rows={2}
                        placeholder="Evidence that makes the statement true"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`false-${index}`}>
                        False criteria{" "}
                        <span className="optional-label">optional</span>
                      </FieldLabel>
                      <Textarea
                        id={`false-${index}`}
                        value={question.criteria?.false || ""}
                        onChange={(event) =>
                          change(index, {
                            ...question,
                            criteria: {
                              ...question.criteria,
                              false: event.target.value,
                            },
                          })
                        }
                        rows={2}
                        placeholder="Evidence that makes the statement false"
                      />
                      <FieldDescription>
                        Noul returns a probability, not a thresholded yes or no.
                      </FieldDescription>
                    </Field>
                  </>
                )}
                {question.type === "box" && (
                  <Field>
                    <FieldLabel>Target image</FieldLabel>
                    <Picker
                      label="Choose target image"
                      value={question.targetImageId}
                      onChange={(value) =>
                        change(index, { ...question, targetImageId: value })
                      }
                      options={images.map((image) => ({
                        value: image.id,
                        label: image.name,
                      }))}
                    />
                    <FieldDescription>
                      The rectangle is drawn on this image. Box does not confirm
                      that an object is present.
                    </FieldDescription>
                  </Field>
                )}
                <div className="question-footer">
                  <span>
                    <GripVertical />
                    {QUESTION_LABELS[question.type]} question
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange(questions.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
              </FieldGroup>
            </div>
          </details>
        ))}
      </div>
      {questions.length === 0 && (
        <Empty className="question-empty">
          <EmptyHeader>
            <EmptyTitle>What should the model decide?</EmptyTitle>
            <EmptyDescription>
              Add a typed question to get started.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={add}>
              <Plus data-icon="inline-start" />
              Add first question
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}
