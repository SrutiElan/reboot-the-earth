import { catalog, type Dataset, type GroundPlot } from ".";
import { EMPTY_FILTERS, filterDatasets, type Filters } from "./filters";
import { plural } from "./format";

// Placeholder for the assistant. In production the FastAPI service turns the
// question into a validated, read-only filter object; this keyword parser stands
// in for it so the UI flow can be exercised without a backend.

export const ASSISTANT_NAME = "AI";

export interface Apply {
  filters?: Partial<Filters>;
  ids?: string[];
  query?: string;
  label?: string;
}

export interface Answer {
  text: string;
  /** Up to three dataset ids shown under the answer */
  preview: string[];
  apply: Apply | null;
  /** Ids the answer talked about, for follow-ups like "which missions cover it?" */
  ctx: string[] | null;
  follow: string[];
}

export interface Conversation {
  ctx: string[] | null;
  lastApply: Apply | null;
}

export const STARTERS = [
  "Which drone missions overlap ground plots?",
  "What's the most recently collected plot?",
  "Nadir flights since 2024 with the Mavic 3",
  "What data is there at Caldor Fire?",
];

export function resultsFor(apply: Apply) {
  return filterDatasets({
    filters: { ...EMPTY_FILTERS, ...apply.filters },
    ids: apply.ids ? new Set(apply.ids) : null,
    query: apply.query ?? "",
  });
}

const byId = (id: string) => catalog.byId(id)!;
const drones = (list: Dataset[]) => list.filter((d) => d.kind === "drone");
const grounds = (list: Dataset[]) => list.filter((d): d is GroundPlot => d.kind === "ground");

export function answer(question: string, { ctx, lastApply }: Conversation): Answer {
  const t = question.toLowerCase();
  const one = ctx && ctx.length === 1 ? byId(ctx[0]) : null;
  const out = (text: string, items: Dataset[], apply: Apply | null, follow: string[] = []): Answer => ({
    text,
    preview: items.slice(0, 3).map((d) => d.id),
    apply,
    ctx: items.map((d) => d.id),
    follow,
  });
  const refine = /\b(these|those|them|only|of these)\b/.test(t) && lastApply ? lastApply : null;
  const baseF = refine?.filters ?? {};
  const baseIds = refine?.ids;
  const run = (f: Partial<Filters>, ids?: string[]) => resultsFor({ filters: f, ids, query: refine?.query });

  if (one && /\b(it|this|that|cover|covers|inside|within)\b/.test(t) && !/^which drone missions overlap/.test(t)) {
    const rel = one.overlaps.map(byId);
    if (one.kind === "ground") {
      if (!rel.length) return out(`No drone mission footprints cover ${one.name} yet.`, [], null);
      const latest = rel[0];
      return out(
        `${plural(rel.length, "drone mission")} cover ${one.name}. The most recent is ${latest.name}, flown ${latest.date}${latest.kind === "drone" ? ` with the ${latest.aircraft}` : ""}.`,
        rel,
        { ids: rel.map((d) => d.id), label: `Covering ${one.name}` },
        ["Which of these are withheld from training?", "Only nadir ones"],
      );
    }
    if (!rel.length) return out(`No ground plots fall inside ${one.name}.`, [], null);
    const trees = grounds(rel).reduce((a, p) => a + p.trees, 0);
    return out(
      `${plural(rel.length, "ground plot")} fall inside ${one.name}, with ${trees.toLocaleString()} trees mapped in total.`,
      rel,
      { ids: rel.map((d) => d.id), label: `Inside ${one.id}` },
    );
  }

  if (/hide withheld|exclude withheld|without withheld/.test(t)) {
    const f = { ...baseF, noWithheld: true };
    const m = drones(run(f, baseIds));
    return out(`${plural(m.length, "mission")} remain after excluding the ones withheld from training.`, m, {
      filters: f,
      ids: baseIds,
      label: lastApply?.label,
    });
  }

  if (/withheld|test set|test data|training/.test(t)) {
    const pool = refine ? drones(run(baseF, baseIds)) : catalog.missions;
    const w = pool.filter((d) => d.kind === "drone" && d.withheld);
    return out(
      `${w.length} of ${pool.length} ${refine ? "those missions" : "drone missions in the catalog"} are withheld from training. OFO reserves them as test data for model evaluation and comparison.`,
      w,
      { ids: w.map((d) => d.id), label: "Withheld from training" },
      ["Hide withheld missions instead"],
    );
  }

  if (/(recent|latest|newest|last)/.test(t) && /(plot|ground|field)/.test(t)) {
    const p = catalog.plots[0];
    return out(
      `The most recently collected ground plot is ${p.name} at ${p.site}, surveyed on ${p.date}. It has ${p.trees} trees mapped on a ${p.plotHa} ha plot.`,
      [p],
      { ids: [p.id], label: "Most recent plot" },
      ["Which drone missions cover it?", `What else is at ${p.site}?`],
    );
  }

  if (/(recent|latest|newest|last)/.test(t)) {
    const m = catalog.missions[0];
    return out(
      `The most recent drone mission is ${m.name} at ${m.site}, flown on ${m.date} with the ${m.aircraft}. It covers ${m.areaHa} ha in ${m.imageCount.toLocaleString()} images.`,
      [m],
      { ids: [m.id], label: "Most recent mission" },
      ["Are there ground plots inside it?"],
    );
  }

  const f: Partial<Filters> = { ...baseF };
  let hit = false;
  if (/overlap|footprint|intersect|co-?located|pair|over ground|with ground/.test(t)) {
    f.overlap = true;
    hit = true;
  }
  if (/oblique/.test(t)) {
    f.camera = "oblique";
    hit = true;
  } else if (/nadir/.test(t)) {
    f.camera = "nadir";
    hit = true;
  }
  let y: RegExpMatchArray | null;
  if ((y = t.match(/(since|after|from)\s*(20\d\d)/))) {
    f.yFrom = String(+y[2] + (y[1] === "after" ? 1 : 0));
    hit = true;
  } else if ((y = t.match(/(before|until)\s*(20\d\d)/))) {
    f.yTo = String(+y[2] - (y[1] === "before" ? 1 : 0));
    hit = true;
  } else if ((y = t.match(/\b(?:in\s+)?(20(19|2\d))\b/))) {
    f.yFrom = f.yTo = y[1];
    hit = true;
  }
  const ac = catalog.aircraft.find((a) => {
    const name = a.toLowerCase();
    return t.includes(name) || t.includes(name.split(" ").slice(0, 2).join(" "));
  });
  if (ac) {
    f.aircraft = ac;
    hit = true;
  }
  if (/high altitude|above 110|over 110/.test(t)) {
    f.alt = "high";
    hit = true;
  } else if (/low altitude|80 ?m|below 80|under 80/.test(t)) {
    f.alt = "low";
    hit = true;
  }
  if (/large|big/.test(t)) {
    f.area = "l";
    hit = true;
  } else if (/small/.test(t)) {
    f.area = "s";
    hit = true;
  }

  const site = catalog.siteNames.find((s) => t.includes(s.toLowerCase()) || t.includes(s.toLowerCase().split(" ")[0]));
  if (site) {
    const r = resultsFor({ filters: f, query: site });
    const m = drones(r);
    const p = grounds(r);
    const span = m.length ? `, collected between ${m[m.length - 1].year} and ${m[0].year}` : "";
    return out(
      `${site} has ${plural(m.length, "drone mission")} and ${plural(p.length, "ground plot")}${hit ? " matching your request" : ""}${span}.`,
      r,
      { filters: f, query: site },
      ["Which of these are withheld from training?", "Only nadir ones"],
    );
  }

  if (hit) {
    const m = drones(run(f, baseIds));
    const bits: string[] = [];
    if (f.overlap) bits.push("have ground plots inside their footprint");
    if (f.camera) bits.push(f.camera === "nadir" ? "are nadir only" : "include oblique imagery");
    if (f.yFrom || f.yTo) {
      bits.push(
        f.yFrom === f.yTo
          ? `were flown in ${f.yFrom}`
          : f.yFrom
            ? `were flown in ${f.yFrom} or later`
            : `were flown in ${f.yTo} or earlier`,
      );
    }
    if (f.aircraft) bits.push(`used the ${f.aircraft}`);
    if (f.alt) bits.push(f.alt === "high" ? "flew above 110 m" : "flew at 80 m or lower");
    if (f.area) bits.push(f.area === "l" ? "cover more than 50 ha" : "cover less than 10 ha");
    const plotsCovered = new Set(m.flatMap((d) => d.overlaps)).size;
    const text = `${plural(m.length, "drone mission")} ${bits.join(", ")}.${f.overlap ? ` Together they cover ${plural(plotsCovered, "ground plot")}.` : ""}`;
    return out(
      text,
      m,
      { filters: f, ids: baseIds, label: baseIds ? lastApply?.label : undefined },
      ["Which of these are withheld from training?", f.camera === "nadir" ? "Only oblique ones" : "Only nadir ones", "Only since 2024"],
    );
  }

  return {
    text: `I couldn't turn that into a search. Describe the data you need, like "nadir missions over ground plots since 2023" or "data at Caldor Fire".`,
    preview: [],
    apply: null,
    ctx,
    follow: ["Which drone missions overlap ground plots?", "What's the most recently collected plot?"],
  };
}
