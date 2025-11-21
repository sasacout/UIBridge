import React from "react";
function getTailwindStyle(widget) {
  let style = '';
  // 기본 타입별 스타일
  if (widget.type === 'Container') style += 'flex flex-col items-center justify-center w-full h-full ';
  if (widget.type === 'Button') style += 'bg-gray-700 text-white rounded-full px-6 py-2 font-medium text-base mr-4 mb-2 ';
  if (widget.type === 'Label') style += 'text-center text-white text-lg mb-4 ';
  if (widget.type === 'Image') style += 'w-12 h-12 rounded-full border-2 border-white mb-4 flex items-center justify-center ';
  // LVGL style/layout 정보 추가 변환
  if (widget.layout) {
    if (typeof widget.layout.x === 'number') style += `left-[${widget.layout.x}px] `;
    if (typeof widget.layout.y === 'number') style += `top-[${widget.layout.y}px] `;
    if (typeof widget.layout.w === 'number') style += `w-[${widget.layout.w}px] `;
    if (typeof widget.layout.h === 'number') style += `h-[${widget.layout.h}px] `;
  }
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
    // 기타 스타일 속성도 필요시 추가 가능
  }
  // 위치/크기 속성이 있으면 absolute 추가 (최상위 컨테이너 제외)
  if ((/left-\[.*px\]|top-\[.*px\]|right-\[.*px\]|bottom-\[.*px\]|w-\[.*px\]|h-\[.*px\]/.test(style)) && widget.type !== 'Container') {
    style = 'absolute ' + style;
  }
  // 최상위 컨테이너는 relative로 지정
  if (widget.type === 'Container' && widget.isRoot) {
    style = 'relative ' + style;
  }
  return style.trim();
}

// id로 위젯을 찾는 함수 추가
function getWidgetById(widgets, id) {
  return widgets.find(w => w.id === id);
}

// 재귀적으로 위젯 렌더링
function renderWidget(widget, widgets) {
  // 최상위 컨테이너 여부 전달
  const isRoot = widget.id === widgets[0].id;
  const style = getTailwindStyle({ ...widget, isRoot });
  const commonProps = {
    id: widget.id,
    className: style
  };
  if (widget.type === 'Container') {
    // 버튼 그룹을 flex로 묶기 (자식 중 Button이 2개 이상이면)
    const buttonChildren = widget.children?.map(cid => getWidgetById(widgets, cid)).filter(w => w?.type === 'Button') || [];
    const otherChildren = widget.children?.map(cid => getWidgetById(widgets, cid)).filter(w => w?.type !== 'Button') || [];
    return (
      <div {...commonProps}>
        {otherChildren.map(child => child ? renderWidget(child, widgets) : null)}
        {buttonChildren.length > 0 && (
          <div className="flex flex-row justify-center items-center mt-2">
            {buttonChildren.map(child => child ? renderWidget(child, widgets) : null)}
          </div>
        )}
      </div>
    );
  }
  if (widget.type === 'Image') {
    // 이미지 src가 없으면 placeholder
    return <img {...commonProps} src={widget.src || 'https://via.placeholder.com/48x48?text=No+Img'} alt="icon" />;
  }
  if (widget.type === 'Label') {
    return <span {...commonProps}>{widget.text}</span>;
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
  // 루트 컨테이너 찾기: id가 screenId로 시작하는 가장 상위 컨테이너
  const rootCandidates = ir.widgets.filter(w => w.type === 'Container' && w.id.startsWith(ir.screenId));
  // 자식이 가장 많은 컨테이너를 루트로 선택
  const root = rootCandidates.sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))[0];
  if (!root) {
    return <div style={{color:'red'}}>루트 컨테이너 없음<br/>rootCandidates: {JSON.stringify(rootCandidates, null, 2)}</div>;
  }
  // Preview 영역 배경을 어둡게 변경
  return (
    <div style={{position: 'relative', width: 320, height: 240, background: '#222', overflow: 'hidden'}}>
      {renderWidget(root, ir.widgets)}
    </div>
  );
}