import { describe, expect, test } from "bun:test";
import { renderPage, validatePage } from "../src/index";
import { PROFILE_ID } from "../src/profile";
import type { BalloonItem, StyleOverrides, Tail } from "../src/types";
import { requireSvg } from "./helpers";

const DRAWN: StyleOverrides = { dialogue: { body: "drawn", fill: "#ffffff", strokeWidth: 4.5 } };

function page(
  item: Partial<BalloonItem>,
  text = "I'm fixing something.",
  mouth = { x: 380, y: 620 },
) {
  const tail: Tail = { subjectId: "lex", anchor: "mouth", attachment: "auto" };
  return {
    schemaVersion: "0.1.0",
    pageId: "drawn",
    coordinateSpace: { width: 1200, height: 760, origin: "top-left", units: "art-px" },
    renderProfile: { id: PROFILE_ID, version: "0.1.0" },
    subjects: [
      {
        id: "lex",
        bounds: { x: mouth.x - 60, y: mouth.y - 40, width: 120, height: 120 },
        anchors: { mouth },
      },
    ],
    exclusionZones: [],
    items: [
      {
        kind: "balloon",
        id: "B01",
        panelId: "P01",
        speakerId: "lex",
        shapeId: "speech",
        style: "dialogue",
        placement: { x: 200, y: 120, width: 520, height: 180 },
        tail,
        content: { en: { text } },
        ...item,
      },
    ],
  };
}

function render(m: unknown, styles: StyleOverrides = DRAWN): string {
  return requireSvg(renderPage(m, { locale: "en", profileId: PROFILE_ID, styles }));
}

/** The balloon group, without the embedded fonts around it. */
function group(svg: string): string {
  const start = svg.indexOf('<g id="B01"');
  if (start < 0) throw new Error("no balloon group");
  return svg.slice(start);
}

describe("drawn balloons in a render", () => {
  test("a drawn style renders one ink path and one balloon path", () => {
    const g = group(render(page({})));
    expect(g).toContain('data-body="drawn"');
    expect(g.match(/data-part="ink"/g) ?? []).toHaveLength(1);
    expect(g.match(/data-part="balloon"/g) ?? []).toHaveLength(1);
  });

  test("the style's fill colours the balloon", () => {
    expect(group(render(page({})))).toMatch(/data-part="balloon"[^>]*fill="#ffffff"/);
  });

  test("the text is broken again to suit the drawn body", () => {
    const g = group(render(page({}, "You're always fixing something.")));
    expect(g.match(/<text /g) ?? []).toHaveLength(3);
  });

  test("a jagged balloon in a drawn style keeps the rounded builder", () => {
    expect(group(render(page({ edge: "jagged" })))).not.toContain('data-body="drawn"');
  });

  test("a tail's mood changes the drawing", () => {
    const calm = group(render(page({})));
    const tail: Tail = { subjectId: "lex", anchor: "mouth", attachment: "auto", mood: "urgent" };
    const urgent = group(render(page({ tail })));
    expect(urgent).not.toBe(calm);
  });

  test("a drawn balloon renders the same bytes twice", () => {
    expect(render(page({}))).toBe(render(page({})));
  });

  test("a drawn balloon is checked against its own bounds", () => {
    // Four lines of text centred on a box that starts 20 px from the top: the
    // drawn body grows about its centre and leaves the page; the rounded body
    // grows down from the box's corner and does not.
    const m = page(
      { placement: { x: 200, y: 20, width: 520, height: 120 } },
      "That ring is theirs. It has been theirs for two years.",
    );
    const drawn = validatePage(m, { locale: "en", profileId: PROFILE_ID, styles: DRAWN });
    const rounded = validatePage(m, { locale: "en", profileId: PROFILE_ID });
    expect(drawn.diagnostics.map((d) => d.code)).toContain("OUT_OF_BOUNDS");
    expect(rounded.diagnostics.map((d) => d.code)).not.toContain("OUT_OF_BOUNDS");
  });

  test("a tail may carry a mood, and an unknown mood is refused", () => {
    const ok: Tail = { subjectId: "lex", anchor: "mouth", attachment: "auto", mood: "hesitant" };
    const codes = (m: unknown): string[] =>
      validatePage(m, { locale: "en", profileId: PROFILE_ID }).diagnostics.map((d) => d.code);
    expect(codes(page({ tail: ok }))).not.toContain("SCHEMA_INVALID");
    const bad = page({});
    const item = bad.items[0];
    if (item === undefined) throw new Error("no item");
    Reflect.set(item, "tail", {
      subjectId: "lex",
      anchor: "mouth",
      attachment: "auto",
      mood: "angry",
    });
    expect(codes(bad)).toContain("SCHEMA_INVALID");
  });
});
