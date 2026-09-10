import { describe, expect, test } from "bun:test";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID } from "../src/profile";
import { voiceStyle } from "../src/layout";
import { buildRoundedBalloonPath } from "../src/shapes/rounded-rect";
import type { RoundedBalloonInput } from "../src/shapes/rounded-rect";
import { requireSvg } from "./helpers";
import type {
  BalloonItem,
  Bounds,
  CoordinateSpace,
  LocaleContent,
  PageItem,
  Voice,
} from "../src/types";

const SPACE: CoordinateSpace = {
  width: 1200,
  height: 760,
  origin: "top-left",
  units: "art-px",
};

function page(items: PageItem[], subjects: unknown[] = []): unknown {
  return {
    schemaVersion: "0.1.0",
    pageId: "voice-test",
    coordinateSpace: SPACE,
    renderProfile: { id: "rift-city-proof", version: "0.1.0" },
    subjects,
    exclusionZones: [],
    items,
  };
}

function balloon(voice: Voice, extra: Partial<BalloonItem>, content: LocaleContent): BalloonItem {
  return {
    kind: "balloon",
    id: "B01",
    panelId: "P01",
    speakerId: "lex",
    shapeId: "speech",
    voice,
    placement: { x: 120, y: 140, width: 520, height: 180 },
    content: { en: content },
    ...extra,
  };
}

const LEX = [
  {
    id: "lex",
    bounds: { x: 700, y: 560, width: 160, height: 160 },
    anchors: { mouth: { x: 760, y: 620 } },
  },
];

function codes(manifest: unknown): string[] {
  return validatePage(manifest, { locale: "en", profileId: PROFILE_ID }).diagnostics.map(
    (d) => d.code,
  );
}

describe("voice channels", () => {
  test("a machine clip must name its source and must not be tailed", () => {
    const noLabel = page([balloon("machine", {}, { text: "—cross now—" })]);
    expect(codes(noLabel)).toContain("VOICE_RULE");

    const tailed = page(
      [
        balloon(
          "machine",
          { tail: { subjectId: "lex", anchor: "mouth", attachment: "bottom" } },
          { sourceLabel: "PEDESTRIAN CROSSING", text: "—cross now—" },
        ),
      ],
      LEX,
    );
    expect(codes(tailed)).toContain("VOICE_RULE");
  });

  test("a human balloon cannot carry a recording source", () => {
    const m = page([balloon("human", {}, { sourceLabel: "QUIZ PROGRAMME", text: "It's new." })]);
    expect(codes(m)).toContain("VOICE_RULE");
  });

  test("a well-formed clip and a well-formed line both validate", () => {
    const clip = page([
      balloon("machine", {}, { sourceLabel: "PEDESTRIAN CROSSING", text: "—cross now—" }),
    ]);
    expect(validatePage(clip, { locale: "en", profileId: PROFILE_ID }).valid).toBe(true);

    const human = page(
      [
        balloon(
          "human",
          { tail: { subjectId: "lex", anchor: "mouth", attachment: "bottom" } },
          { text: "It's new." },
        ),
      ],
      LEX,
    );
    expect(validatePage(human, { locale: "en", profileId: PROFILE_ID }).valid).toBe(true);
  });

  test("voice picks the silhouette: hand-drawn for people, a hard box for playback", () => {
    expect(voiceStyle("human")).toEqual({ cornerRadius: 0.9, edge: "hand" });
    expect(voiceStyle("machine")).toEqual({ cornerRadius: 0, edge: "smooth" });
    expect(voiceStyle("narration").edge).toBe("smooth");
  });

  test("one page carrying both voices embeds both faces, each once", () => {
    const m = page(
      [
        balloon("machine", {}, { sourceLabel: "COOKING PROGRAMME", text: "—properly—" }),
        {
          kind: "balloon" satisfies PageItem["kind"],
          id: "B02",
          panelId: "P01",
          speakerId: "lex",
          shapeId: "speech",
          voice: "human",
          placement: { x: 120, y: 420, width: 520, height: 180 },
          tail: { subjectId: "lex", anchor: "mouth", attachment: "bottom" },
          content: { en: { text: "It's new." } },
        },
      ],
      LEX,
    );
    const svg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    const faces = svg.match(/@font-face/g) ?? [];
    expect(faces).toHaveLength(2);
    expect(svg).toContain('font-family: "Shantell Sans SemiBold"');
    expect(svg).toContain('font-family: "IBM Plex Mono"');
    expect(svg).toContain('data-part="source-tag-brackets"');
    expect(svg).toContain('data-voice="machine"');
  });

  test("a candidate machine face swaps the clip and label together", () => {
    const m = page([
      balloon("machine", {}, { sourceLabel: "COOKING PROGRAMME", text: "—properly—" }),
    ]);
    const svg = requireSvg(
      renderPage(m, {
        locale: "en",
        profileId: PROFILE_ID,
        fonts: { machine: "oswald-medium" },
      }),
    );
    expect(svg).toContain('font-family: "Oswald Medium"');
    expect(svg).not.toContain('font-family: "IBM Plex Mono"');
    expect(svg.match(/@font-face/g) ?? []).toHaveLength(1);
  });
});

describe("hand-drawn outline", () => {
  const body: Bounds = { x: 100, y: 100, width: 620, height: 220 };
  const input: Omit<RoundedBalloonInput, "edge"> = {
    bodies: [body],
    tip: null,
    bend: null,
    attachment: "auto",
    cornerRadius: 0.9,
  };

  test("the wobble is a function of the geometry, so it repeats exactly", () => {
    const a = buildRoundedBalloonPath({ ...input, edge: "hand" });
    const b = buildRoundedBalloonPath({ ...input, edge: "hand" });
    expect(a).toBe(b);
  });

  test("a hand outline is not the machine outline", () => {
    const hand = buildRoundedBalloonPath({ ...input, edge: "hand" });
    const smooth = buildRoundedBalloonPath({ ...input, edge: "smooth" });
    expect(hand).not.toBe(smooth);
    expect(hand).toContain("Q");
  });

  test("two balloons of different size wobble differently", () => {
    const a = buildRoundedBalloonPath({ ...input, edge: "hand" });
    const b = buildRoundedBalloonPath({
      ...input,
      bodies: [{ x: 140, y: 100, width: 620, height: 220 }],
      edge: "hand",
    });
    expect(a).not.toBe(b);
  });
});
