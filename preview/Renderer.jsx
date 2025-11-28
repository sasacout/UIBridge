import React from "react";
function getTailwindStyle(widget) {
  // 기본값: 디자인에 맞는 Tailwind
  let style = '';
  // isRoot일 때 하드코딩된 flex/w/h/bg-black/overflow-hidden 제거 (IR 기반으로만)
  // Container에 flex/flex-col/items-center 자동 추가 제거 (IR/tailwind/style만 반영)
  // Button, Image에 하드코딩된 클래스도 제거 (IR/tailwind/style만 반영)

  // IR 데이터의 tailwind 필드가 있으면 추가(확장)
  if (widget.tailwind) style += widget.tailwind + ' ';

  // IR 데이터의 style/layout 필드가 있으면 일부 속성만 Tailwind로 변환하여 추가
  if (widget.style) {
    if (widget.style.bgColor) {
      const hex = widget.style.bgColor.replace('0x', '#');
      style += `bg-[${hex}] `;
    }
    if (widget.style.font) {
      style += `font-[${widget.style.font}] `;
    }
    if (widget.style.fontSize) {
      style += `text-[${widget.style.fontSize}px] `;
    }
    if (widget.style.fontWeight) {
      style += `font-[${widget.style.fontWeight}] `;
    }
    if (widget.style.color) {
      const hex = widget.style.color.replace('0x', '#');
      style += `text-[${hex}] `;
    }
    if (widget.style.borderColor) {
      const hex = widget.style.borderColor.replace('0x', '#');
      style += `border border-solid border-[${hex}] `;
    }
    if (widget.style.borderWidth) {
      style += `border-[${widget.style.borderWidth}px] `;
    }
    if (widget.style.radius) {
      style += `rounded-[${widget.style.radius}px] `;
    }
    if (widget.style.opacity) {
      style += `opacity-[${widget.style.opacity}] `;
    }
  }
  // layout 정보: w/h/x/y 모두 적용
  if (widget.layout) {
    if (typeof widget.layout.x === 'number') style += `left-[${widget.layout.x}px] `;
    if (typeof widget.layout.y === 'number') style += `top-[${widget.layout.y}px] `;
    if (typeof widget.layout.w === 'number') style += `w-[${widget.layout.w}px] `;
    if (typeof widget.layout.h === 'number') style += `h-[${widget.layout.h}px] `;
    // left/top이 있으면 absolute도 추가
    if (typeof widget.layout.x === 'number' || typeof widget.layout.y === 'number') style += 'absolute ';
  }
  return style.trim();
}

// id로 위젯을 찾는 함수 추가
function getWidgetById(widgets, id) {
  return widgets.find(w => w.id === id);
}

// 재귀적으로 위젯 렌더링
function renderWidget(widget, widgets) {
  console.log('renderWidget:', widget.id);
  // 최상위 컨테이너 여부 전달
  const isRoot = widget.id === widgets[0].id;
  const style = getTailwindStyle({ ...widget, isRoot });
  const commonProps = {
    id: widget.id,
    className: style
  };
  if (widget.type === 'Container') {
    // 버튼 그룹 flex 묶기 로직도 하드코딩 대신 IR에서 제어하도록 변경 (예: tailwind/layout에 flex-row 등 지정)
    const children = widget.children?.map(cid => getWidgetById(widgets, cid)).filter(Boolean) || [];
    return (
      <div {...commonProps}>
        {children.map(child => renderWidget(child, widgets))}
      </div>
    );
  }
  if (widget.type === 'Image') {
    // 이미지 src가 없으면 placeholder
    return <img {...commonProps} src={widget.src || 'https://via.placeholder.com/48x48?text=No+Img'} alt="icon" />;
  }
  if (widget.type === 'Label') {
    // style: layout(w/h/x/y) + style(color/font 등) 모두 px 단위로, 주요 속성은 항상 명확히 style에 넣음
    const style = {};
    style.whiteSpace = 'pre-line';
    if (typeof widget.layout?.x === 'number') {
      style.left = widget.layout.x + 'px';
      style.position = 'absolute';
    }
    if (typeof widget.layout?.y === 'number') {
      style.top = widget.layout.y + 'px';
      style.position = 'absolute';
    }
    if (typeof widget.layout?.w === 'number') style.width = widget.layout.w + 'px';
    if (typeof widget.layout?.h === 'number') style.height = widget.layout.h + 'px';
    if (widget.style?.color) style.color = widget.style.color.split(' ')[0];
    if (widget.style?.fontSize) style.fontSize = (typeof widget.style.fontSize === 'number' ? widget.style.fontSize + 'px' : widget.style.fontSize);
    if (widget.style?.font) style.fontFamily = widget.style.font;
    if (widget.style?.textAlign) style.textAlign = widget.style.textAlign;
    // 기타 style 속성도 병합 (이미 위에서 명확히 지정한 속성은 덮어쓰지 않음)
    if (widget.style) {
      for (const [k, v] of Object.entries(widget.style)) {
        if (!(k in style)) style[k] = v;
      }
    }
    console.log('Label widget:', widget);
    console.log('Computed style:', style);
    return (
      <p {...commonProps} style={style}>
        {widget.text}
      </p>
    );
  }
  if (widget.type === 'Button') {
    return <button {...commonProps}>{widget.text}</button>;
  }
  // 기타 타입은 div로 처리
  return <div {...commonProps}>{widget.text}</div>;
}

  // IR 전체를 렌더링
export function Renderer({ ir }) {
  console.log('Renderer에 전달된 IR:', ir);
  console.log('widgets 타입:', typeof ir?.widgets, 'length:', ir?.widgets?.length);
  if (!ir || !ir.widgets || typeof ir.widgets.length !== 'number' || ir.widgets.length === 0) {
    return <div style={{color:'red'}}>IR 데이터 없음 (widgets 배열 length 확인 필요)</div>;
  }
  // 모든 부모 없는 Container(모든 트리의 루트)를 렌더링 (irToJsx.js와 동일하게)
  const allIds = new Set(ir.widgets.map(w => w.id));
  const childIds = new Set(ir.widgets.flatMap(w => w.children || []));
  const rootContainers = ir.widgets.filter(w => w.type === 'Container' && !childIds.has(w.id));
  const roots = rootContainers.length > 0 ? rootContainers : ir.widgets.filter(w => w.type === 'Container');
  // Preview 영역 배경을 어둡게 변경
  return (
    <div style={{position: 'relative', width: 320, height: 240, background: '#222', overflow: 'hidden'}}>
      {roots.map(root => renderWidget(root, ir.widgets))}
    </div>
  );
}

export default Renderer;