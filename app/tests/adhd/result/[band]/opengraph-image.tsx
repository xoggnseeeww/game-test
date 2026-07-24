import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ASRS_BAND_COPY } from "@/content/adhd";
import { type AsrsBand } from "@/lib/asrs";

export const alt = "과몰입구역 · 성인 ADHD 자가 체크 결과";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VALID_BANDS: AsrsBand[] = ["low", "midLow", "midHigh", "high"];

export function generateStaticParams() {
  return VALID_BANDS.map((band) => ({ band }));
}

export default async function Image({ params }: { params: Promise<{ band: string }> }) {
  const { band: rawBand } = await params;
  const band: AsrsBand = (VALID_BANDS as string[]).includes(rawBand)
    ? (rawBand as AsrsBand)
    : "low";
  const copy = ASRS_BAND_COPY[band];

  const fontData = await readFile(join(process.cwd(), "assets/Pretendard-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(160deg, #6E58F5, #4A32D6)",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            과
          </div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>과몰입구역</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#D8D2FF",
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            성인 ADHD 자가 체크 결과
          </div>
          <div
            style={{
              display: "flex",
              color: "#fff",
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.3,
              maxWidth: 980,
            }}
          >
            {copy.title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.75)",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          정보 제공용 자가 체크 · 의료기기 아님
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pretendard", data: fontData, style: "normal", weight: 700 }],
    }
  );
}
