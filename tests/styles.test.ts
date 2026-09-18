import { describe, expect, test } from "bun:test";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID } from "../src/profile";
import { letterStyleShape } from "../src/layout";
import { buildRoundedBalloonPath } from "../src/shapes/rounded-rect";
import type { RoundedBalloonInput } from "../src/shapes/rounded-rect";
import { requireSvg } from "./helpers";
import type {
  BalloonItem,
  Bounds,
  CoordinateSpace,
  LetterStyle,
  LocaleContent,
  PageItem,
  StyleOverrides,
  Tail,
} from "../src/types";

const SPACE: CoordinateSpace = {
  width: 1200,
  height: 760,
  origin: "top-left",
  units: "art-px",
};

const SPEAKER = [
  {
    id: "lex",
    bounds: { x: 700, y: 560, width: 160, height: 160 },
    anchors: { mouth: { x: 760, y: 620 } },
  },
];

const TAIL: Tail = { subjectId: "lex", anchor: "mouth", attachment: "bottom" };

function page(items: PageItem[], subjects: unknown[] = []): unknown {
  return {
    schemaVersion: "0.1.0",
    pageId: "style-test",
    coordinateSpace: SPACE,
    renderProfile: { id: PROFILE_ID, version: "0.1.0" },
    subjects,
    exclusionZones: [],
    items,
  };
}

function balloon(
  style: LetterStyle,
  extra: Partial<BalloonItem>,
  content: LocaleContent,
  id = "B01",
): BalloonItem {
  return {
    kind: "balloon",
    id,
    panelId: "P01",
    speakerId: "lex",
    shapeId: "speech",
    style,
    placement: { x: 120, y: 140, width: 520, height: 180 },
    content: { en: content },
    ...extra,
  };
}

/** House rules of the kind a project supplies; not wubble's own opinion. */
const HOUSE: StyleOverrides = {
  notice: { label: "required", labelBrackets: true },
};

/** The one balloon outline in a render, without the embedded fonts around it. */
function outline(svg: string): string {
  const tag = svg.match(/<path data-part="balloon"[^>]*>/)?.[0];
  if (tag === undefined) throw new Error("render carries no balloon outline");
  return tag;
}

function codes(manifest: unknown, styles?: StyleOverrides): string[] {
  const options = { locale: "en", profileId: PROFILE_ID, ...(styles ? { styles } : {}) };
  return validatePage(manifest, options).diagnostics.map((d) => d.code);
}

describe("lettering styles", () => {
  test("a notice is refused a tail, because the profile forbids it", () => {
    const m = page([balloon("notice", { tail: TAIL }, { text: "—cross now—" })], SPEAKER);
    expect(codes(m)).toContain("STYLE_RULE");
  });

  test("a dialogue balloon is refused a label, because the profile forbids it", () => {
    const m = page([balloon("dialogue", {}, { label: "QUIZ", text: "It's new." })]);
    expect(codes(m)).toContain("STYLE_RULE");
  });

  test("wubble ships no opinion about labels; a project's house rules add one", () => {
    const m = page([balloon("notice", {}, { text: "—cross now—" })]);
    expect(codes(m)).not.toContain("STYLE_RULE");
    expect(codes(m, HOUSE)).toContain("STYLE_RULE");
  });

  test("well-formed items of each style validate", () => {
    const notice = page([balloon("notice", {}, { label: "CROSSING", text: "—cross now—" })]);
    expect(validatePage(notice, { locale: "en", profileId: PROFILE_ID }).valid).toBe(true);

    const dialogue = page([balloon("dialogue", { tail: TAIL }, { text: "It's new." })], SPEAKER);
    expect(validatePage(dialogue, { locale: "en", profileId: PROFILE_ID }).valid).toBe(true);

    const caption = page([balloon("caption", {}, { text: "Tuesday morning." })]);
    expect(validatePage(caption, { locale: "en", profileId: PROFILE_ID }).valid).toBe(true);
  });

  test("style picks the silhouette: drawn for dialogue, a hard box for a notice", () => {
    expect(letterStyleShape("dialogue")).toEqual({ cornerRadius: 0.9, edge: "hand" });
    expect(letterStyleShape("notice")).toEqual({ cornerRadius: 0, edge: "smooth" });
    expect(letterStyleShape("caption").edge).toBe("smooth");
  });

  test("house rules can restyle a whole register for one render", () => {
    const m = page([balloon("notice", {}, { label: "CROSSING", text: "—cross now—" })]);
    const plain = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    expect(plain).not.toContain('data-part="label-brackets"');

    const housed = requireSvg(
      renderPage(m, { locale: "en", profileId: PROFILE_ID, styles: HOUSE }),
    );
    expect(housed).toContain('data-part="label-brackets"');
    expect(housed).toContain('data-style="notice"');
  });

  test("house rules reshape a register's outline", () => {
    const m = page([balloon("dialogue", { tail: TAIL }, { text: "It's new." })], SPEAKER);
    const drawn = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    const housed = requireSvg(
      renderPage(m, {
        locale: "en",
        profileId: PROFILE_ID,
        styles: { dialogue: { edge: "smooth" } },
      }),
    );
    const smooth = page(
      [balloon("dialogue", { tail: TAIL, edge: "smooth" }, { text: "It's new." })],
      SPEAKER,
    );
    const direct = requireSvg(renderPage(smooth, { locale: "en", profileId: PROFILE_ID }));
    expect(outline(housed)).not.toBe(outline(drawn));
    expect(outline(housed)).toBe(outline(direct));
  });

  test("house rules set a register's line weight", () => {
    const m = page([balloon("dialogue", { tail: TAIL }, { text: "It's new." })], SPEAKER);
    const plain = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    const housed = requireSvg(
      renderPage(m, {
        locale: "en",
        profileId: PROFILE_ID,
        styles: { dialogue: { strokeWidth: 6 } },
      }),
    );
    expect(outline(plain)).toContain('stroke-width="10.00"');
    expect(outline(housed)).toContain('stroke-width="6.00"');
  });

  test("a balloon's own line weight still wins over the house rule", () => {
    const m = page(
      [balloon("dialogue", { tail: TAIL, strokeWidth: 9 }, { text: "It's new." })],
      SPEAKER,
    );
    const svg = requireSvg(
      renderPage(m, {
        locale: "en",
        profileId: PROFILE_ID,
        styles: { dialogue: { strokeWidth: 6 } },
      }),
    );
    expect(outline(svg)).toContain('stroke-width="9.00"');
  });

  test("one page carrying two registers embeds both faces, each once", () => {
    const m = page(
      [
        balloon("notice", {}, { label: "COOKING PROGRAMME", text: "—properly—" }),
        balloon(
          "dialogue",
          { tail: TAIL, placement: { x: 120, y: 430, width: 520, height: 180 } },
          { text: "It's new." },
          "B02",
        ),
      ],
      SPEAKER,
    );
    const svg = requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID }));
    expect(svg.match(/@font-face/g) ?? []).toHaveLength(2);
    expect(svg).toContain('font-family: "Shantell Sans SemiBold"');
    expect(svg).toContain('font-family: "Oswald Medium"');
  });

  test("a candidate face swaps a register's text and its label together", () => {
    const m = page([balloon("notice", {}, { label: "COOKING PROGRAMME", text: "—properly—" })]);
    const svg = requireSvg(
      renderPage(m, {
        locale: "en",
        profileId: PROFILE_ID,
        fonts: { notice: "jetbrains-mono-regular" },
      }),
    );
    expect(svg).toContain('font-family: "JetBrains Mono"');
    expect(svg).not.toContain('font-family: "Oswald Medium"');
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
    expect(buildRoundedBalloonPath({ ...input, edge: "hand" })).toBe(
      buildRoundedBalloonPath({ ...input, edge: "hand" }),
    );
  });

  test("a hand outline is not the machine-drawn outline", () => {
    const hand = buildRoundedBalloonPath({ ...input, edge: "hand" });
    expect(hand).not.toBe(buildRoundedBalloonPath({ ...input, edge: "smooth" }));
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
