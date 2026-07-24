"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { OptionCard } from "@/components/OptionCard";
import { ASRS_PART_A_ITEMS, ASRS_RESPONSE_OPTIONS, scoreAsrs, type AsrsAnswerValue } from "@/lib/asrs";
import { PHQ2_ITEMS, PHQ2_INTRO, PHQ2_RESPONSE_OPTIONS, scorePhq2, type Phq2AnswerValue } from "@/lib/phq2";
import { GAD2_ITEMS, GAD2_INTRO, GAD2_RESPONSE_OPTIONS, scoreGad2, type Gad2AnswerValue } from "@/lib/gad2";
import {
  CHILDHOOD_ONSET_QUESTION,
  IMPAIRMENT_AREAS_QUESTION,
  type ChildhoodOnsetAnswer,
  type ImpairmentAreasAnswer,
} from "@/lib/childhoodImpairment";
import { CHILDHOOD_IMPAIRMENT_SECTION_INTRO } from "@/content/adhd";

type Step =
  | { kind: "asrs"; idx: number }
  | { kind: "phq2"; idx: number }
  | { kind: "gad2"; idx: number }
  | { kind: "childhood" }
  | { kind: "impairment" };

const STEPS: Step[] = [
  ...ASRS_PART_A_ITEMS.map((_, idx) => ({ kind: "asrs" as const, idx })),
  ...PHQ2_ITEMS.map((_, idx) => ({ kind: "phq2" as const, idx })),
  ...GAD2_ITEMS.map((_, idx) => ({ kind: "gad2" as const, idx })),
  { kind: "childhood" as const },
  { kind: "impairment" as const },
];

interface Answers {
  asrs: (AsrsAnswerValue | undefined)[];
  phq2: (Phq2AnswerValue | undefined)[];
  gad2: (Gad2AnswerValue | undefined)[];
  childhoodOnset?: ChildhoodOnsetAnswer;
  impairmentAreas?: ImpairmentAreasAnswer;
}

function emptyAnswers(): Answers {
  return {
    asrs: new Array(ASRS_PART_A_ITEMS.length).fill(undefined),
    phq2: new Array(PHQ2_ITEMS.length).fill(undefined),
    gad2: new Array(GAD2_ITEMS.length).fill(undefined),
  };
}

export default function AdhdTestRunPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);

  const step = STEPS[stepIndex];

  const { sectionLabel, questionNumberInSection, questionText, options, selectedValue } =
    useMemo(() => buildStepView(step, answers), [step, answers]);

  function goBack() {
    if (stepIndex === 0) {
      router.push("/tests/adhd");
      return;
    }
    setStepIndex((i) => i - 1);
  }

  function finish(finalAnswers: Answers) {
    const asrs = scoreAsrs(finalAnswers.asrs as AsrsAnswerValue[]);
    const phq2 = scorePhq2(finalAnswers.phq2 as Phq2AnswerValue[]);
    const gad2 = scoreGad2(finalAnswers.gad2 as Gad2AnswerValue[]);
    const params = new URLSearchParams({
      p: String(phq2.total),
      g: String(gad2.total),
      co: finalAnswers.childhoodOnset ?? "unsure",
      ia: finalAnswers.impairmentAreas ?? "one",
    });
    router.push(`/tests/adhd/result/${asrs.band}?${params.toString()}`);
  }

  function selectValue(rawValue: string) {
    const next: Answers = {
      ...answers,
      asrs: [...answers.asrs],
      phq2: [...answers.phq2],
      gad2: [...answers.gad2],
    };

    if (step.kind === "asrs") next.asrs[step.idx] = Number(rawValue) as AsrsAnswerValue;
    if (step.kind === "phq2") next.phq2[step.idx] = Number(rawValue) as Phq2AnswerValue;
    if (step.kind === "gad2") next.gad2[step.idx] = Number(rawValue) as Gad2AnswerValue;
    if (step.kind === "childhood") next.childhoodOnset = rawValue as ChildhoodOnsetAnswer;
    if (step.kind === "impairment") next.impairmentAreas = rawValue as ImpairmentAreasAnswer;

    setAnswers(next);

    window.setTimeout(() => {
      if (stepIndex === STEPS.length - 1) {
        finish(next);
      } else {
        setStepIndex((i) => i + 1);
      }
    }, 220);
  }

  return (
    <div className="flex-1 flex flex-col items-center bg-(--color-bg-canvas) py-6 px-4">
      <main className="w-full max-w-[440px] bg-bg rounded-[32px] shadow-[0_24px_60px_rgba(23,23,26,0.10)] overflow-hidden min-h-[560px] flex flex-col">
        <div className="px-5 pt-5 pb-1">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={goBack}
              className="text-[22px] text-ink-muted shrink-0"
              aria-label="이전"
            >
              ‹
            </button>
            <ProgressBar current={stepIndex + 1} total={STEPS.length} />
          </div>
        </div>

        <div className="px-6 pt-9 pb-4">
          <div className="text-[13px] font-bold text-primary mb-3">{sectionLabel}</div>
          {questionNumberInSection && (
            <div className="text-[12px] text-ink-quiet mb-1">{questionNumberInSection}</div>
          )}
          <h2 className="text-[20px] font-extrabold text-ink leading-[1.45] tracking-tight m-0 text-balance">
            {questionText}
          </h2>
        </div>

        <div className="flex flex-col gap-2.5 px-5 flex-1">
          {options.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={selectedValue === opt.value}
              onClick={() => selectValue(opt.value)}
            />
          ))}
        </div>
        <div className="h-6" />
      </main>
    </div>
  );
}

function buildStepView(step: Step, answers: Answers) {
  if (step.kind === "asrs") {
    const item = ASRS_PART_A_ITEMS[step.idx];
    return {
      sectionLabel: `Q${step.idx + 1}.`,
      questionNumberInSection: null,
      questionText: item.text,
      options: ASRS_RESPONSE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
      selectedValue:
        answers.asrs[step.idx] !== undefined ? String(answers.asrs[step.idx]) : undefined,
    };
  }
  if (step.kind === "phq2") {
    const item = PHQ2_ITEMS[step.idx];
    return {
      sectionLabel: "잠깐, 다른 이유는 아닌지도 확인해볼게요",
      questionNumberInSection: PHQ2_INTRO,
      questionText: item.text,
      options: PHQ2_RESPONSE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
      selectedValue:
        answers.phq2[step.idx] !== undefined ? String(answers.phq2[step.idx]) : undefined,
    };
  }
  if (step.kind === "gad2") {
    const item = GAD2_ITEMS[step.idx];
    return {
      sectionLabel: "잠깐, 다른 이유는 아닌지도 확인해볼게요",
      questionNumberInSection: GAD2_INTRO,
      questionText: item.text,
      options: GAD2_RESPONSE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
      selectedValue:
        answers.gad2[step.idx] !== undefined ? String(answers.gad2[step.idx]) : undefined,
    };
  }
  if (step.kind === "childhood") {
    return {
      sectionLabel: CHILDHOOD_IMPAIRMENT_SECTION_INTRO,
      questionNumberInSection: null,
      questionText: CHILDHOOD_ONSET_QUESTION.text,
      options: CHILDHOOD_ONSET_QUESTION.options.map((o) => ({ value: o.value, label: o.label })),
      selectedValue: answers.childhoodOnset,
    };
  }
  return {
    sectionLabel: CHILDHOOD_IMPAIRMENT_SECTION_INTRO,
    questionNumberInSection: null,
    questionText: IMPAIRMENT_AREAS_QUESTION.text,
    options: IMPAIRMENT_AREAS_QUESTION.options.map((o) => ({ value: o.value, label: o.label })),
    selectedValue: answers.impairmentAreas,
  };
}
