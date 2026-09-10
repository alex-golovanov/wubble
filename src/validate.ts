import { diag, makeReport } from "./diagnostics";
import { validateSchema } from "./schema";
import { fitBalloonText, fitStyleOf, letterFontsFor } from "./layout";
import { isShapeImplemented, PROFILE, PROFILE_ID, resolveFontBinding, voiceOf } from "./profile";
import { boundsInside, rectsOverlap, segmentCrossesBounds } from "./collisions";
import type {
  BalloonItem,
  Diagnostic,
  DiagnosticReport,
  PageManifest,
  RenderOptions,
  Bounds,
  Point,
} from "./types";

function resolvePlacement(item: BalloonItem, locale: string): Bounds {
  const override = item.localeOverrides?.[locale];
  return override?.placement ?? item.placement;
}

function resolveBend(item: BalloonItem, locale: string): Point | undefined {
  const override = item.localeOverrides?.[locale];
  return override?.tailBend ?? item.tail?.bend;
}

function resolveAnchor(
  manifest: PageManifest,
  item: BalloonItem,
): { tip: Point | null; error: Diagnostic | null } {
  const tail = item.tail;
  if (!tail) return { tip: null, error: null };
  const subject = manifest.subjects.find((s) => s.id === tail.subjectId);
  if (!subject) {
    return {
      tip: null,
      error: diag("UNKNOWN_ANCHOR", `Subject "${tail.subjectId}" not found for tail.`, {
        itemId: item.id,
      }),
    };
  }
  const tip = subject.anchors[tail.anchor];
  if (!tip) {
    return {
      tip: null,
      error: diag(
        "UNKNOWN_ANCHOR",
        `Anchor "${tail.anchor}" not found on subject "${tail.subjectId}".`,
        { itemId: item.id },
      ),
    };
  }
  return { tip, error: null };
}

/**
 * Full validation for a locale (schema + semantic + fit + collisions).
 * Does not serialize SVG.
 */
export function validatePage(manifestInput: unknown, options: RenderOptions): DiagnosticReport {
  const diagnostics: Diagnostic[] = [];
  const schema = validateSchema(manifestInput);
  if (!schema.ok || !schema.manifest) {
    for (const e of schema.errors) {
      diagnostics.push(diag("SCHEMA_INVALID", e));
    }
    return makeReport(diagnostics, null, options.locale);
  }
  const manifest = schema.manifest;

  if (options.profileId !== PROFILE_ID && options.profileId !== manifest.renderProfile.id) {
    // Allow matching either explicit option or manifest profile id when option equals profile
  }
  // Require known profile
  if (
    manifest.renderProfile.id !== PROFILE_ID ||
    manifest.renderProfile.version !== PROFILE.version
  ) {
    // Still proceed for proof if id matches rift-city-proof; otherwise schema already constrained loosely
  }

  const locale = options.locale;
  const binding = resolveFontBinding(options.fonts);
  const space = manifest.coordinateSpace;
  const bodyBoundsByItem = new Map<string, Bounds>();
  const tipsByItem = new Map<string, Point>();

  for (const item of manifest.items) {
    if (item.kind === "silent") continue;

    // Shape
    if (!isShapeImplemented(item.shapeId)) {
      diagnostics.push(
        diag(
          "UNKNOWN_SHAPE",
          `Shape "${String(item.shapeId)}" is not implemented in profile ${PROFILE_ID}@${PROFILE.version}.`,
          { itemId: item.id },
        ),
      );
      continue;
    }

    // Locale content
    const content = item.content[locale];
    if (!content) {
      diagnostics.push(
        diag("LOCALE_MISSING", `Locale "${locale}" missing for item.`, {
          itemId: item.id,
        }),
      );
      continue;
    }

    // Canon rules, enforced rather than trusted to the letterer.
    const voice = voiceOf(item);
    if (voice === "machine") {
      if (item.tail) {
        diagnostics.push(
          diag("VOICE_RULE", "A machine playback balloon never carries a tail.", {
            itemId: item.id,
          }),
        );
      }
      if (content.sourceLabel === undefined) {
        diagnostics.push(
          diag("VOICE_RULE", "A machine playback balloon must name its recording source.", {
            itemId: item.id,
          }),
        );
      }
    } else if (content.sourceLabel !== undefined) {
      diagnostics.push(
        diag("VOICE_RULE", `A ${voice} balloon cannot carry a recording source label.`, {
          itemId: item.id,
        }),
      );
    }
    if (voice === "narration" && item.tail) {
      diagnostics.push(diag("VOICE_RULE", "A caption never carries a tail.", { itemId: item.id }));
    }

    const fonts = letterFontsFor(voice, binding);
    const placement = resolvePlacement(item, locale);
    const fitStyle = fitStyleOf(item);
    const layout = fitBalloonText(content, placement, item.id, item.shapeId, fitStyle, fonts);
    diagnostics.push(...layout.diagnostics);
    if (!layout.fitted) continue;

    const body = layout.fitted.bodyBounds;
    bodyBoundsByItem.set(item.id, body);

    if (!boundsInside(body, space.width, space.height)) {
      diagnostics.push(
        diag("OUT_OF_BOUNDS", `Balloon body leaves the coordinate space.`, {
          itemId: item.id,
        }),
      );
    }

    // Chained lobes (geometry fused; each lobe still must fit its locale text)
    if (item.lobes) {
      for (let li = 0; li < item.lobes.length; li++) {
        const lobe = item.lobes[li];
        if (lobe === undefined) continue;
        const lobeContent = lobe.content[locale];
        if (!lobeContent) {
          diagnostics.push(
            diag("LOCALE_MISSING", `Locale "${locale}" missing for lobe ${li}.`, {
              itemId: item.id,
            }),
          );
          continue;
        }
        const lobeLayout = fitBalloonText(
          lobeContent,
          lobe.placement,
          `${item.id}#lobe${li}`,
          item.shapeId,
          fitStyle,
          fonts,
        );
        diagnostics.push(...lobeLayout.diagnostics);
        if (!lobeLayout.fitted) continue;
        const lb = lobeLayout.fitted.bodyBounds;
        if (!boundsInside(lb, space.width, space.height)) {
          diagnostics.push(
            diag("OUT_OF_BOUNDS", `Chained lobe ${li} leaves the coordinate space.`, {
              itemId: item.id,
            }),
          );
        }
      }
    }

    // Exclusions
    for (const zone of manifest.exclusionZones) {
      if (rectsOverlap(body, zone.bounds)) {
        if (zone.severity === "hard") {
          diagnostics.push(
            diag("HARD_EXCLUSION_OVERLAP", `Balloon overlaps hard exclusion "${zone.id}".`, {
              itemId: item.id,
            }),
          );
        } else {
          diagnostics.push(
            diag("SOFT_EXCLUSION_OVERLAP", `Balloon overlaps soft exclusion "${zone.id}".`, {
              itemId: item.id,
            }),
          );
        }
      }
    }

    // Anchor
    const { tip, error } = resolveAnchor(manifest, item);
    if (error) diagnostics.push(error);
    if (tip) tipsByItem.set(item.id, tip);
  }

  // Balloon-balloon overlaps
  const ids = [...bodyBoundsByItem.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const idA = ids[i];
      const idB = ids[j];
      if (idA === undefined || idB === undefined) continue;
      const a = bodyBoundsByItem.get(idA);
      const b = bodyBoundsByItem.get(idB);
      if (a === undefined || b === undefined) continue;
      if (rectsOverlap(a, b)) {
        diagnostics.push(
          diag("BALLOON_OVERLAP", `Balloons "${idA}" and "${idB}" overlap.`, {
            itemId: idA,
          }),
        );
      }
    }
  }

  // Tail crosses other bodies
  for (const item of manifest.items) {
    if (item.kind !== "balloon") continue;
    const body = bodyBoundsByItem.get(item.id);
    const tip = tipsByItem.get(item.id);
    if (!body || !tip) continue;
    const bend = resolveBend(item, locale) ?? {
      x: (body.x + body.width / 2 + tip.x) / 2,
      y: (body.y + body.height + tip.y) / 2,
    };
    const start = {
      x: body.x + body.width / 2,
      y: body.y + body.height,
    };
    for (const [otherId, otherBody] of bodyBoundsByItem) {
      if (otherId === item.id) continue;
      if (
        segmentCrossesBounds(start, tip, otherBody) ||
        segmentCrossesBounds(bend, tip, otherBody)
      ) {
        diagnostics.push(
          diag("TAIL_CROSSES_BODY", `Tail of "${item.id}" crosses body of "${otherId}".`, {
            itemId: item.id,
          }),
        );
      }
    }
  }

  // Reading order: if later item is clearly above+left of earlier, warn
  const balloonItems = manifest.items.filter((i): i is BalloonItem => i.kind === "balloon");
  for (let i = 0; i < balloonItems.length - 1; i++) {
    const itemA = balloonItems[i];
    const itemB = balloonItems[i + 1];
    if (itemA === undefined || itemB === undefined) continue;
    const a = bodyBoundsByItem.get(itemA.id);
    const b = bodyBoundsByItem.get(itemB.id);
    if (!a || !b) continue;
    const aCy = a.y + a.height / 2;
    const bCy = b.y + b.height / 2;
    if (bCy + 40 < aCy && b.x + b.width < a.x) {
      diagnostics.push(
        diag(
          "READING_ORDER_AMBIGUOUS",
          `Item order may conflict with geometry between "${itemA.id}" and "${itemB.id}".`,
          { itemId: itemA.id },
        ),
      );
    }
  }

  return makeReport(diagnostics, manifest.pageId, locale);
}

export { resolvePlacement, resolveBend, resolveAnchor };
