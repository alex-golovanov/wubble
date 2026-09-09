import { buildSpeech } from "../src/shapes/speech";
const cases = [
  {
    name: "multi-L",
    body: { x: 120, y: 200, width: 480, height: 260 },
    tip: { x: 280, y: 920 },
    bend: { x: 260, y: 560 },
  },
  {
    name: "page022",
    body: { x: 930, y: 1110, width: 560, height: 300 },
    tip: { x: 1225, y: 1685 },
    bend: { x: 1260, y: 1490 },
  },
  {
    name: "close",
    body: { x: 280, y: 160, width: 560, height: 280 },
    tip: { x: 600, y: 520 },
    bend: null,
  },
];
for (const c of cases) {
  const g = buildSpeech({
    body: c.body,
    tip: c.tip,
    bend: c.bend,
    attachment: "bottom",
    cornerRadius: 1,
    edge: "smooth",
  });
  const re = /C\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/g;
  const cubics = [...g.path.matchAll(re)];
  const dive = cubics[5],
    ret = cubics[6];
  const a = { x: +dive[3], y: +dive[4] };
  const b = { x: +ret[1], y: +ret[2] };
  const midW = Math.hypot(a.x - b.x, a.y - b.y);
  const joinA = { x: +cubics[4][5], y: +cubics[4][6] };
  const joinB = { x: +ret[5], y: +ret[6] };
  const joinW = Math.hypot(joinA.x - joinB.x, joinA.y - joinB.y);
  const len = Math.hypot(
    c.tip.x - (c.body.x + c.body.width / 2),
    c.tip.y - (c.body.y + c.body.height),
  );
  console.log(
    c.name,
    "joinW",
    joinW.toFixed(1),
    "midW",
    midW.toFixed(1),
    "len",
    len.toFixed(1),
    "mid/len",
    (midW / len).toFixed(3),
  );
}
