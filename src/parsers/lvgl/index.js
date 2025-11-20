export function parseLvglFile(code) {
  const widgets = [];
  console.log('[LVGL Parser] 시작');
  // 주요 LVGL 생성 함수 모두 인식
  const createRe = /([a-zA-Z0-9_\.]+)\s*=\s*lv_(btn|label|img|obj|imgseqopt)_create\s*\(\s*([a-zA-Z0-9_\.]+|NULL)\s*\)/g;
  let m;
  const typeMap = {
    btn: 'Button',
    label: 'Label',
    img: 'Image',
    obj: 'Container',
    imgseqopt: 'ImageSeqOpt'
  };
  const widgetById = {};
  const parentLinks = [];
  while ((m = createRe.exec(code))) {
    const varName = m[1];
    const type = typeMap[m[2]] || m[2];
    const parent = m[3];
    const w = {
      id: varName,
      type,
      text: '',
      layout: {},
      style: {},
      events: [],
      source: 'lvgl',
      children: [],
      parent
    };
    widgets.push(w);
    widgetById[varName] = w;
    parentLinks.push({ child: varName, parent });
  }
  // 이미지 src 추출 및 경로 변환
  const imgSrcRe = /lv_img_set_src\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*&([a-zA-Z0-9_]+)_png\s*\)/g;
  m = null;
  while ((m = imgSrcRe.exec(code))) {
    const imgId = m[1];
    const imgFile = m[2];
    const w = widgetById[imgId];
    if (w && w.type === 'Image') {
      w.src = `/images/${imgFile}.png`;
    }
  }
  // 라벨 텍스트
  const textRe = /lv_label_set_text\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\)/g;
  m = null;
  while ((m = textRe.exec(code))) {
    const labelText = m[2];
    const w = widgetById[m[1]];
    if (w) w.text = labelText;
  }
  // 위치/크기/배경색 등 스타일 파싱
  const posRe = /lv_obj_set_pos\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  m = null;
  while ((m = posRe.exec(code))) {
    const wid = m[1];
    const x = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    const w = widgetById[wid];
    if (w) { w.layout.x = x; w.layout.y = y; }
  }
  const sizeRe = /lv_obj_set_size\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  m = null;
  while ((m = sizeRe.exec(code))) {
    const wid = m[1];
    const wVal = parseInt(m[2], 10);
    const hVal = parseInt(m[3], 10);
    const w = widgetById[wid];
    if (w) { w.layout.w = wVal; w.layout.h = hVal; }
  }
  const bgColorRe = /lv_obj_set_style_bg_color\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*lv_color_hex\((0x[0-9A-Fa-f]+)\)\s*,\s*LV_PART_MAIN\s*\)/g;
  m = null;
  while ((m = bgColorRe.exec(code))) {
    const wid = m[1];
    const color = m[2];
    const w = widgetById[wid];
    if (w) { w.style.bgColor = color; }
  }
  // 폰트 스타일
  const fontRe = /lv_obj_set_style_text_font\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*&([a-zA-Z0-9_]+)\s*,\s*LV_PART_MAIN\s*\)/g;
  m = null;
  while ((m = fontRe.exec(code))) {
    const wid = m[1];
    const font = m[2];
    const w = widgetById[wid];
    if (w) { w.style.font = font; }
  }
  // 테두리 색상
  const borderColorRe = /lv_obj_set_style_border_color\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*lv_color_hex\((0x[0-9A-Fa-f]+)\)\s*,\s*LV_PART_MAIN\s*\)/g;
  m = null;
  while ((m = borderColorRe.exec(code))) {
    const wid = m[1];
    const color = m[2];
    const w = widgetById[wid];
    if (w) { w.style.borderColor = color; }
  }
  // 테두리 두께
  const borderWidthRe = /lv_obj_set_style_border_width\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*(\d+)\s*,\s*LV_PART_MAIN\s*\)/g;
  m = null;
  while ((m = borderWidthRe.exec(code))) {
    const wid = m[1];
    const width = parseInt(m[2], 10);
    const w = widgetById[wid];
    if (w) { w.style.borderWidth = width; }
  }
  // parent-child 관계 구성 (parent가 변수명 전체와 일치할 때만 children에 추가)
  parentLinks.forEach(({ child, parent }) => {
    if (parent && parent !== 'NULL') {
      // parent 변수명이 widgetById의 key에 포함될 경우 연결
      const parentWidgetKey = Object.keys(widgetById).find(k => parent.includes(k));
      const parentWidget = parentWidgetKey ? widgetById[parentWidgetKey] : undefined;
      const childWidget = widgetById[child];
        if (parentWidget && childWidget) {
          parentWidget.children.push(childWidget.id); // children에 객체 대신 id(문자열)만 추가
        console.log(`[LVGL Parser] parent-child 연결(포함): parent=${parent}, child=${child}, parentKey=${parentWidgetKey}`);
      }
    }
  });
  // 계층 구조 트리 생성: root(parent가 NULL)부터 시작해 재귀적으로 children 연결
  function buildTree(widget) {
    return {
      id: widget.id,
      type: widget.type,
      text: widget.text,
      src: widget.src, // 이미지 src 포함
      layout: widget.layout,
      style: widget.style,
      tailwind: widget.tailwind || '',
      events: widget.events,
      assets: widget.assets || [],
      children: widget.children // children은 id(문자열) 배열로 반환
    };
  }
  // root(parent가 NULL) 위젯만 트리로 반환
  const tree = widgets.filter(w => w.parent === 'NULL').map(buildTree);
  console.log(`[LVGL Parser] 최종 추출 위젯 수: ${widgets.length}, 트리 root 수: ${tree.length}`);
  return { raw: widgets, meta: { parser: 'lvgl', count: widgets.length } };
  // Group children by parent variable, create synthetic Container if >1 child
  const groups = {};
  for(const w of widgets){
    const pv = parentMap.get(w.id);
    if(!groups[pv]) groups[pv]=[];
    groups[pv].push(w);
  }
  Object.entries(groups).forEach(([pv, list])=>{
    if(list.length > 1){
      const containerId = `container_${pv}`;
      const container = { id: containerId, type:'Container', text:'', layout:{}, style:{}, events:[], source:'lvgl', children: list.map(ch=>ch.id) };
      widgets.push(container);
    }
  });
  return { raw: widgets, meta: { parser: 'lvgl', count: widgets.length } };
}
