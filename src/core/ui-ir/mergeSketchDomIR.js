// mergeSketchDomIR.js
// Improved merging of LVGL IR and Sketch IR
// Export: mergeSketchDomIR(lvglIR, sketchIR)

/**
 * Normalize text: remove CR, trim
 */
function normalizeText(t) {
  if (!t && t !== "") return "";
  return ("" + t).replace(/\r\n|\r|\n/g, "\n").trim();
}

/**
 * Generate unique ID if duplication occurs
 */
function getUniqueId(existingIds, baseId) {
  if (!baseId) baseId = "widget";
  let newId = baseId;
  let i = 1;
  while (existingIds.has(newId)) {
    newId = `${baseId}_${i}`;
    i++;
  }
  existingIds.add(newId);
  return newId;
}

/**
 * Compute bbox center and area from layout
 */
function bboxInfo(layout = {}) {
  const x = typeof layout.x === "number" ? layout.x : (typeof layout.left === "number" ? layout.left : 0);
  const y = typeof layout.y === "number" ? layout.y : (typeof layout.top === "number" ? layout.top : 0);
  const w = typeof layout.w === "number" ? layout.w : (typeof layout.width === "number" ? layout.width : 0);
  const h = typeof layout.h === "number" ? layout.h : (typeof layout.height === "number" ? layout.height : 0);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const area = w * h;
  return { x, y, w, h, cx, cy, area };
}

/**
 * Size similarity score (0..1). 1 = identical
 */
function sizeSimilarity(aLayout, bLayout) {
  const a = bboxInfo(aLayout);
  const b = bboxInfo(bLayout);
  // if both have zero area, consider similar
  if ((a.area === 0 || isNaN(a.area)) && (b.area === 0 || isNaN(b.area))) return 1;
  // avoid division by zero
  if (a.area === 0 || isNaN(a.area) || b.area === 0 || isNaN(b.area)) return 0;
  const ratio = Math.min(a.area, b.area) / Math.max(a.area, b.area);
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Center distance normalized score (0..1). 1 = exact same center
 * We compute distance relative to diagonal of bounding box union
 */
function centerProximityScore(aLayout, bLayout) {
  const a = bboxInfo(aLayout);
  const b = bboxInfo(bLayout);
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // reference distance: diagonal of bounding boxes union
  const unionW = Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x);
  const unionH = Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y);
  const diag = Math.sqrt(unionW * unionW + unionH * unionH) || 1;
  const norm = Math.min(1, dist / diag);
  return 1 - norm; // closer => score near 1
}

/**
 * Compute matching score between lvglWidget and sketchWidget
 * Higher is better. Use:
 *  - exact text match (bonus)
 *  - type match required
 *  - center proximity and size similarity
 */
function matchScore(lvglWidget = {}, sketchWidget = {}) {
  if (!lvglWidget || !sketchWidget) return 0;
  if ((lvglWidget.type || "") !== (sketchWidget.type || "")) {
    // allow mapping where sketch uses Image/Container for button backgrounds:
    // if lvgl is Label/Button and sketch is Image/Container, still consider
    const lv = (lvglWidget.type || "").toLowerCase();
    const sk = (sketchWidget.type || "").toLowerCase();
    const allow = (lv === "label" || lv === "button") && (sk === "image" || sk === "container" || sk === "symbol");
    if (!allow) return 0;
  }

  const lvText = normalizeText(lvglWidget.text || "");
  const skText = normalizeText(sketchWidget.text || "");

  let score = 0;

  // exact text match -> strong indicator
  if (lvText && skText && lvText === skText) {
    score += 0.6;
  } else if (!skText && lvText) {
    // sketch often has no visible text (background image). give lighter boost if positions similar
    score += 0.0;
  } else if (!lvText && skText) {
    // rare: sketch has text, lvgl doesn't
    score += 0.2;
  }

  // size similarity and proximity
  const sizeSim = sizeSimilarity(lvglWidget.layout || {}, sketchWidget.layout || {});
  const centerSim = centerProximityScore(lvglWidget.layout || {}, sketchWidget.layout || {});
  // weigh center more (position important)
  score += 0.25 * centerSim + 0.15 * sizeSim;

  return score; // range ~0..1
}

/**
 * Merge two widget objects (lvgl primary, sketch overrides)
 * - preserves lvgl.id unless sketch wants to be unique (we map separately)
 * - style/layout/tailwind: merged (sketch overrides)
 * - children: prefer lvgl.children, but if empty use sketch.children (remapped)
 */
function mergeWidgetObjects(lvglWidget = {}, sketchWidget = {}, idMap = new Map(), existingIds = new Set()) {
  // Determine resulting id:
  // If sketchWidget is matched to lvglWidget, we want to keep lvglWidget.id
  const resultId = lvglWidget.id || sketchWidget.id || getUniqueId(existingIds, "widget");

  // Merge style & layout carefully: preserve lvgl then override by sketch if present
  const mergedStyle = { ...(lvglWidget.style || {}), ...(sketchWidget.style || {}) };
  const mergedLayout = { ...(lvglWidget.layout || {}), ...(sketchWidget.layout || {}) };
  const mergedTailwind = [lvglWidget.tailwind, sketchWidget.tailwind].filter(Boolean).join(" ").trim();

  // children mapping: if lvglWidget has children, keep them (they should refer to lvgl ids)
  // but also if sketch provides children, map their old ids to either existing mapping or generate unique ids
  const children = Array.isArray(lvglWidget.children) && lvglWidget.children.length > 0
    ? lvglWidget.children.slice()
    : [];

  // incorporate sketch children when they are not duplicates of lvgl children
  if (Array.isArray(sketchWidget.children)) {
    for (const sc of sketchWidget.children) {
      // if sc has a mapping (idMap), use mapped id; else ensure uniqueness
      let mapped = idMap.get(sc);
      if (!mapped) {
        mapped = getUniqueId(existingIds, sc);
        idMap.set(sc, mapped);
      }
      // avoid duplicate child entries
      if (!children.includes(mapped)) children.push(mapped);
    }
  }

  const merged = {
    ...lvglWidget,
    ...sketchWidget, // this will override fields like text/src if sketch supplies them
    id: resultId,
    style: mergedStyle,
    layout: mergedLayout,
    tailwind: mergedTailwind,
    children
  };

  return merged;
}

/**
 * Main exporter: mergeSketchDomIR
 */
export function mergeSketchDomIR(lvglIR = {}, sketchIR = {}) {
  // Guard
  if (!lvglIR && !sketchIR) return { widgets: [], meta: { mappingApplied: false } };
  if (!lvglIR) {
    // ensure unique ids
    const existing = new Set();
    const out = sketchIR.widgets.map(w => ({ ...w, id: getUniqueId(existing, w.id) }));
    return { ...sketchIR, widgets: out, meta: { ...sketchIR.meta, mappingApplied: true } };
  }
  if (!sketchIR) return lvglIR;

  const lvglWidgets = Array.isArray(lvglIR.widgets) ? lvglIR.widgets.slice() : [];
  const sketchWidgets = Array.isArray(sketchIR.widgets) ? sketchIR.widgets.slice() : [];

  const existingIds = new Set(lvglWidgets.map(w => w.id));
  const idMap = new Map(); // sketchId -> mapped/newId
  const usedSketchIdx = new Set();
  const mergedWidgets = [];

  // 1) For each LVGL widget, find best matching Sketch widget (score threshold)
  for (const lvglW of lvglWidgets) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < sketchWidgets.length; i++) {
      if (usedSketchIdx.has(i)) continue;
      const skW = sketchWidgets[i];
      const s = matchScore(lvglW, skW);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    // choose threshold: if text matches strongly or score > 0.45 then accept
    if (bestIdx !== -1 && (bestScore >= 0.45 || (normalizeText(lvglW.text || "") && normalizeText(lvglW.text || "") === normalizeText(sketchWidgets[bestIdx].text || "")))) {
      const skW = sketchWidgets[bestIdx];
      usedSketchIdx.add(bestIdx);

      // if sketch id collides with existing lvgl id and is different, map sketch->lvgl id
      idMap.set(skW.id, lvglW.id);

      // merge into lvgl widget, with sketch overrides
      const merged = mergeWidgetObjects(lvglW, skW, idMap, existingIds);
      // ensure merged.id remains lvgl id
      merged.id = lvglW.id;
      mergedWidgets.push(merged);
    } else {
      // no suitable sketch match: push lvgl as-is
      mergedWidgets.push({ ...lvglW });
    }
  }

  // 2) Add remaining sketch-only widgets (those not matched)
  for (let i = 0; i < sketchWidgets.length; i++) {
    if (usedSketchIdx.has(i)) continue;
    const skW = sketchWidgets[i];

    // create unique id for sketch widget
    const newId = getUniqueId(existingIds, skW.id);
    idMap.set(skW.id, newId);

    // remap children for sketch widget
    const newChildren = (skW.children || []).map(childId => {
      if (idMap.has(childId)) return idMap.get(childId);
      return getUniqueId(existingIds, childId);
    });

    // merged object (no lvgl base)
    const merged = {
      ...skW,
      id: newId,
      children: newChildren,
      // keep style/layout as-is
      style: { ...(skW.style || {}) },
      layout: { ...(skW.layout || {}) },
      tailwind: skW.tailwind || ""
    };

    mergedWidgets.push(merged);
  }

  // 3) Sanitize children references across mergedWidgets:
  // ensure every child id exists; if not, remove or try fallback (strip suffix)
  const allIds = new Set(mergedWidgets.map(w => w.id));
  for (const w of mergedWidgets) {
    if (!Array.isArray(w.children)) continue;
    w.children = w.children.filter(cid => {
      if (allIds.has(cid)) return true;
      // try fallback: remove "_sketch" or numeric suffix
      const alt = cid.replace(/(_sketch(\d+)?)|(_\d+)$/g, "");
      if (allIds.has(alt)) return true;
      return false;
    });
  }

  // 4) Build resulting IR, ensure meta.sources merged
  const mergedMetaSources = Array.from(new Set([...(lvglIR.meta?.sources || []), ...(sketchIR.meta?.sources || [])]));
  const result = {
    ...lvglIR,
    widgets: mergedWidgets,
    meta: {
      ...(lvglIR.meta || {}),
      ...((sketchIR.meta) ? sketchIR.meta : {}),
      sources: mergedMetaSources,
      mappingApplied: true
    }
  };

  return result;
}
