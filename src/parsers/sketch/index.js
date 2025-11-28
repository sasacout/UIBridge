import fs from 'fs';
import { safeTrim } from '../../core/util/safeTrim.js';

// 파일명만 추출하는 헬퍼 (폴더 제거)
function extractFileName(raw) {
  if (!raw) return "";
  // 공백 제거
  let cleaned = raw.replace(/ /g, "").replace(/\\/g, "/");
  // 마지막 슬래시 뒤만 filename으로 사용
  return cleaned.substring(cleaned.lastIndexOf("/") + 1);
}

export function parseSketchFile(path, screenId = "sketch") {
  if (!fs.existsSync(path))
    return { widgets: [], meta: { parser: "sketch", error: "file_not_found" } };

  let json;
  try {
    json = JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch (e) {
    return { widgets: [], meta: { parser: "sketch", error: "json_parse_fail" } };
  }

  const layers = json.layers || [];

  // 최상위 컨테이너
  const rootId = `${screenId}_priv.${screenId}`;
  const widgets = [
    {
      id: rootId,
      source: "sketch",
      type: "Container",
      text: "",
      src: "",
      layout: { x: 0, y: 0, w: json.width || 320, h: json.height || 240 },
      style: {},
      tailwind: "",
      events: [],
      assets: [],
      children: layers.length ? [`${screenId}_priv.container`] : []
    }
  ];

  // 두 번째 레벨 컨테이너
  widgets.push({
    id: `${screenId}_priv.container`,
    source: "sketch",
    type: "Container",
    text: "",
    src: "",
    layout: { x: 0, y: 0, w: json.width || 320, h: json.height || 240 },
    style: {},
    tailwind: "",
    events: [],
    assets: [],
    children: layers.map((l, i) => `${screenId}_priv.${l.type}_${i}`)
  });

  // 레이어 처리
  layers.forEach((l, i) => {
    const id = `${screenId}_priv.${l.type}_${i}`;
    const layout = l.rect
      ? { x: l.rect.x, y: l.rect.y, w: l.rect.width, h: l.rect.height }
      : {};

    const style = {};
    if (l.color && l.color["color-hex"]) style.color = l.color["color-hex"];
    if (l.fontSize) style.fontSize = l.fontSize;
    if (l.fontFace) style.font = l.fontFace;
    if (l.textAlign) style.textAlign = l.textAlign;

    let text = safeTrim(l.content || l.text || l.name || "");
    let type = l.type === "text" ? "Label" : l.type === "button" ? "Button" : "Container";
    let src = "";

    const trimmed = text.trim();

    // 패턴: Common assets / btn_xxx_(n / f).png
    const nfPattern = /(.*)\(n ?\/ ?f\)(.*)\.(png|jpg|jpeg|gif)$/i;
    const match = nfPattern.exec(trimmed);

    if (match) {
      type = "Image";

      const prefix = match[1];     // 예: Common assets / btn_dialog_01_
      const postfix = match[2];    // 예: "" 또는 "_01"
      const ext = match[3];        // png/jpg 등

      // f 버전 파일명 생성
      let raw = `${prefix}f${postfix}.${ext}`;

      // 파일명만 추출 (폴더 제거)
      const fileName = extractFileName(raw);

      src = `/assets/${fileName}`;
      text = "";
    }
    else if (/\.(png|jpg|jpeg|gif)$/i.test(trimmed)) {
      // 일반 이미지
      type = "Image";

      const fileName = extractFileName(trimmed);

      src = `/assets/${fileName}`;
      text = "";
    }

    widgets.push({
      id,
      source: "sketch",
      type,
      text,
      src,
      layout,
      style,
      tailwind: "",
      events: [],
      assets: [],
      children: []
    });
  });

  return {
    widgets,
    meta: { parser: "sketch", count: widgets.length }
  };
}
