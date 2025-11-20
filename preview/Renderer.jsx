
import React from 'react';

// Helper to get widget by id
function getWidgetById(widgets, id) {
  return widgets.find(w => w.id === id);
}

// Helper to get children widgets
function getChildren(widgets, widget) {
  if (!widget.children || widget.children.length === 0) return [];
  return widget.children.map(cid => getWidgetById(widgets, cid)).filter(Boolean);
}

// 정답지 구조에 맞게 렌더링
  // Tailwind 스타일 매핑
  function getTailwindStyle(widget) {
    let style = '';
    // 기본 타입별 스타일
    if (widget.type === 'Container') style += 'flex flex-col ';
    if (widget.type === 'Button') style += 'px-4 py-2 bg-blue-500 text-white rounded ';
    if (widget.type === 'Label') style += 'text-base ';
    if (widget.type === 'Image') style += 'w-16 h-16 object-contain ';
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
    return style.trim();
  }

  // 재귀적으로 위젯 렌더링
  function renderWidget(widget, widgets) {
    const style = getTailwindStyle(widget);
    const commonProps = {
      id: widget.id,
      className: style
    };
    if (widget.type === 'Container') {
      return (
          <div {...commonProps}>
            {widget.children && widget.children.map((cid, idx) => {
              const child = getWidgetById(widgets, cid);
              return child ? (
                <React.Fragment key={cid}>
                  {renderWidget(child, widgets)}
                </React.Fragment>
              ) : null;
            })}
          </div>
      );
    }
    if (widget.type === 'Image') {
      return <img {...commonProps} src={widget.src} alt="icon" />;
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
    if (!ir || !ir.widgets) return null;
    // 루트 컨테이너 찾기
    const root = ir.widgets.find(w => w.type === 'Container' && w.id.includes(ir.screenId));
    if (!root) return null;
    // 리액트 코드와 동일하게 root 컨테이너만 렌더링
    return renderWidget(root, ir.widgets);
  }