import { headers } from "next/headers";
import Link from "next/link";
import { ResultCard } from "@/components/ResultCard";
import { ShareBlock } from "@/components/ShareBlock";
import { type AsrsBand } from "@/lib/asrs";
import { PHQ2_CUTOFF } from "@/lib/phq2";
import { GAD2_CUTOFF } from "@/lib/gad2";
import {
  suggestsBroaderPattern,
  type ChildhoodOnsetAnswer,
  type ImpairmentAreasAnswer,
} from "@/lib/childhoodImpairment";
import {
  ASRS_BAND_COPY,
  BROADER_PATTERN_NUDGE,
  DISCLAIMER,
  FALSE_NEGATIVE_CAVEAT,
  GAD2_NUDGE,
  PHQ2_NUDGE,
  SOURCE_ATTRIBUTION,
} from "@/content/adhd";

const VALID_BANDS: AsrsBand[] = ["low", "midLow", "midHigh", "high"];
const VALID_ONSET: ChildhoodOnsetAnswer[] = ["yes", "unsure", "no"];
const VALID_IMPAIRMENT: ImpairmentAreasAnswer[] = ["one", "twoOrMore", "almostAll"];

export default async function AdhdResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ band: string }>;
  searchParams: Promise<{ p?: string; g?: string; co?: string; ia?: string }>;
}) {
  const { band: rawBand } = await params;
  const { p, g, co, ia } = await searchParams;

  const band: AsrsBand = (VALID_BANDS as string[]).includes(rawBand)
    ? (rawBand as AsrsBand)
    : "low";
  const phq2Total = clampNonNegative(Number(p));
  const gad2Total = clampNonNegative(Number(g));
  const childhoodOnset: ChildhoodOnsetAnswer = (VALID_ONSET as string[]).includes(co ?? "")
    ? (co as ChildhoodOnsetAnswer)
    : "unsure";
  const impairmentAreas: ImpairmentAreasAnswer = (VALID_IMPAIRMENT as string[]).includes(ia ?? "")
    ? (ia as ImpairmentAreasAnswer)
    : "one";

  const phq2AboveCutoff = phq2Total >= PHQ2_CUTOFF;
  const gad2AboveCutoff = gad2Total >= GAD2_CUTOFF;
  const broaderPattern = suggestsBroaderPattern({ childhoodOnset, impairmentAreas });

  const bandCopy = ASRS_BAND_COPY[band];

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const currentPath = `/tests/adhd/result/${band}?p=${phq2Total}&g=${gad2Total}&co=${childhoodOnset}&ia=${impairmentAreas}`;
  const shareUrl = `${origin}${currentPath}`;
  const ogImageUrl = `/tests/adhd/result/${band}/opengraph-image`;

  return (
    <div className="flex-1 flex flex-col items-center bg-(--color-bg-canvas) py-6 px-4">
      <main className="w-full max-w-[440px] bg-bg rounded-[32px] shadow-[0_24px_60px_rgba(23,23,26,0.10)] overflow-hidden">
        <div className="px-5 pt-5">
          <ResultCard eyebrow="자가 체크 결과" title={bandCopy.title} description={bandCopy.description} />
        </div>

        <div className="px-5 pt-4">
          <p className="text-[12px] text-ink-quiet leading-relaxed bg-(--color-bg-canvas) rounded-2xl px-4 py-3.5">
            ⚠️ {FALSE_NEGATIVE_CAVEAT}
          </p>
        </div>

        {(phq2AboveCutoff || gad2AboveCutoff || broaderPattern) && (
          <div className="px-5 pt-3 flex flex-col gap-2.5">
            {phq2AboveCutoff && (
              <NudgeBox emoji="🌧️" text={PHQ2_NUDGE} />
            )}
            {gad2AboveCutoff && (
              <NudgeBox emoji="😮‍💨" text={GAD2_NUDGE} />
            )}
            {broaderPattern && (
              <NudgeBox emoji="🔎" text={BROADER_PATTERN_NUDGE} />
            )}
          </div>
        )}

        <p className="text-[12px] text-ink-quiet text-center px-6 pt-4 leading-relaxed">
          {DISCLAIMER}
        </p>

        <ShareBlock
          heading="친구는 어떤 결과가 나올까? 👀"
          shareUrl={shareUrl}
          shareTitle="성인 ADHD 자가 체크 — 과몰입구역"
          shareText={`나의 자가 체크 결과: ${bandCopy.title}`}
          ogImageUrl={ogImageUrl}
        />

        <div className="px-5 pt-5">
          <Link
            href="/tests/adhd"
            className="block text-center rounded-2xl bg-white text-ink-muted text-[13px] font-bold py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
          >
            🔄 자가 체크 다시하기
          </Link>
        </div>

        <p className="text-[11px] text-ink-ghost text-center px-6 py-5 leading-relaxed">
          {SOURCE_ATTRIBUTION}
        </p>
      </main>
    </div>
  );
}

function NudgeBox({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-2xl bg-[#FDF0D8] px-4 py-3.5">
      <span className="text-[16px] shrink-0">{emoji}</span>
      <p className="text-[12.5px] text-[#5A3B00] leading-relaxed m-0">{text}</p>
    </div>
  );
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}
