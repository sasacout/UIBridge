// ======================================================
// mergeSketchDomIR.js  (FINAL VERSION)
// ======================================================

export function mergeSketchDomIR(lvglIR, sketchIR) {
  if (!lvglIR || !lvglIR.widgets) return lvglIR;
  if (!sketchIR || !sketchIR.widgets) return lvglIR;

  const lvglWidgets = lvglIR.widgets;
  const sketchWidgets = sketchIR.widgets;

  console.log("mergeSketchDomIR called");

  // ------------------------------------------------------
  // 1) LVGL Label Map 생성 → Sketch Label 중복 병합용 (텍스트 기준)
  // ------------------------------------------------------
  const lvglLabelsByText = new Map();
  lvglWidgets
    .filter((w) => w.type === "Label" && (w.text || "").trim())
    .forEach((w) => {
      const key = (w.text || "").trim();
      // prefer first occurrence; could extend to nearest by layout later
      if (!lvglLabelsByText.has(key)) lvglLabelsByText.set(key, w);
    });

  // ------------------------------------------------------
  // 2) Sketch 부모-child 정상화
  // ------------------------------------------------------
  const normalizedSketch = sketchWidgets.map((node) => ({
    ...node,
    children: node.children || [],
  }));

  // ------------------------------------------------------
  // 3) 의미 없는 Sketch 노드 처리
  // ------------------------------------------------------
  function isGarbageSketchNode(w) {
    if (!w) return true;

    // Drop explicit Sketch-only decorative node types
    const garbageTypes = ["Group", "Rectangle", "Shape", "Frame"];
    if (garbageTypes.includes(w.type)) return true;

    // Decorative text markers
    const decorativeTexts = new Set(["Group", "Rectangle", "Button area", "Contents area", "Button group"]);
    if ((w.text || "").trim() && decorativeTexts.has((w.text || "").trim())) return true;

    // Sketch container with id prefix suggesting decoration
    if (w.source === "sketch" && w.type === "Container") {
      if (/^(group_|shape_|symbol_)/.test(w.id || "")) return true;
    }

    if (w.text && w.text.toLowerCase().includes("background")) return true;

    return false;
  }

  // ------------------------------------------------------
  // 4) Sketch Label 중복 필터링 적용
  // ------------------------------------------------------
  // First pass: merge Sketch label style/layout onto matching LVGL label by text
  const toRemove = new Set();
  for (const w of normalizedSketch) {
    if (w.type === "Label" && (w.text || "").trim()) {
      const key = (w.text || "").trim();
      const lvglLabel = lvglLabelsByText.get(key);
      if (lvglLabel) {
        // apply Sketch style/layout/tailwind onto LVGL label
        if (w.layout) lvglLabel.layout = { ...(lvglLabel.layout || {}), ...w.layout };
        if (w.style) lvglLabel.style = { ...(lvglLabel.style || {}), ...w.style };
        if (w.tailwind) {
          const tw = [lvglLabel.tailwind || "", w.tailwind || ""].filter(Boolean).join(" ").trim();
          lvglLabel.tailwind = tw;
        }
        toRemove.add(w.id);
      }
    }
  }

  // Second pass: filter out removed label duplicates and decorative nodes
  const cleanedSketch = normalizedSketch.filter((w) => {
    if (toRemove.has(w.id)) return false;
    return !isGarbageSketchNode(w);
  });

  // ------------------------------------------------------
  // 5) Sketch id 충돌 방지 — "_sketchXX" suffix 자동 부여
  // ------------------------------------------------------
  const usedIds = new Set(lvglWidgets.map((w) => w.id));
  cleanedSketch.forEach((w, index) => {
    if (usedIds.has(w.id)) {
      w.id = `${w.id}_sketch${index}`;
    }
  });

  // ------------------------------------------------------
  // 6) children 관계도 업데이트 (필요 시)
  // ------------------------------------------------------
  cleanedSketch.forEach((node) => {
    if (!Array.isArray(node.children)) {
      node.children = [];
    }
  });

  // ------------------------------------------------------
  // 7) LVGL + Sketch 머지
  // ------------------------------------------------------
  // Prefer LVGL root; drop Sketch root-sized containers when LVGL root exists
  const hasLvglRoot = lvglWidgets.some((w) => w.type === "Container" && (w.children || []).length);
  const sketchWithoutRoots = cleanedSketch.filter((w) => {
    if (!hasLvglRoot) return true;
    if (w.source === "sketch" && w.type === "Container") {
      const sz = w.layout || {};
      const isRootSized = (sz.w || sz.width) && (sz.h || sz.height);
      if (isRootSized) return false;
    }
    return true;
  });

  const finalWidgets = [...lvglWidgets, ...sketchWithoutRoots];

  return {
    ...lvglIR,
    widgets: finalWidgets,
    meta: {
      ...(lvglIR.meta || {}),
      sources: ["lvgl", "sketch"],
      mappingApplied: true,
    },
  };
}
