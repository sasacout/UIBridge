import React, { useState, useCallback, useEffect, useRef } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Renderer from "./Renderer";        // 너가 만든 컴포넌트 기준
import { mergeSketchDomIR } from "../src/core/ui-ir/mergeSketchDomIR";

import { irToJsx } from "../src/core/ui-ir/irToJsx"; // Updated import path

export default function App() {
  // ...existing code...
  const [showSettings, setShowSettings] = useState(true);
  // 리사이저 상태
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const dragging = useRef(null); // { type: 'left'|'right', startX, startWidth }

  // 마우스 move/업 핸들러
  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      if (dragging.current.type === 'left') {
        setLeftWidth(Math.max(180, dragging.current.startWidth + dx));
      } else if (dragging.current.type === 'right') {
        setRightWidth(Math.max(220, dragging.current.startWidth - dx));
      }
    }
    function onMouseUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
  // -------------------------
  // STATE
  // -------------------------
  const [selected, setSelected] = useState("");
  const [ir, setIr] = useState(null);
  const [convertResult, setConvertResult] = useState(null);
  const [sketchIr, setSketchIr] = useState(null);
  const [logs, setLogs] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [previewTab, setPreviewTab] = useState("preview");
  const [finalIr, setFinalIr] = useState(null); // Final IR 상태

  const [paths, setPaths] = useState({
    lvglRoot: "",
    reactRoot: "",
    sketchFile: ""
  });

  const [screens, setScreens] = useState({
    lvglScreens: [],
    reactScreens: [],
    sketchIds: {}        // screenName → sketchId
  });

  const API_BASE = "http://localhost:7000";

  const safeIr = ir || null;

  const log = (msg) =>
    setLogs((l) => [msg, ...l.slice(0, 49)]);

  // -------------------------
  // API: Screens 로딩
  // -------------------------
  async function fetchScreens() {
    log("fetchScreens called");

    const params = new URLSearchParams({
      lvglRoot: paths.lvglRoot,
      reactRoot: paths.reactRoot,
      sketchFile: paths.sketchFile,
    });

    try {
      const resp = await fetch(`${API_BASE}/api/screens?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setScreens({
          lvglScreens: data.lvglScreens || [],
          reactScreens: data.reactScreens || [],
          sketchIds: data.sketchIds || {},
        });
        log("스크린 목록 로드 완료");
      } else {
        log("스크린 목록 로드 실패: " + resp.status);
      }
    } catch (e) {
      log("스크린 목록 로드 에러: " + e.message);
    }
  }

  useEffect(() => {
    if (paths.lvglRoot || paths.reactRoot || paths.sketchFile) {
      fetchScreens();
    }
  }, [paths.lvglRoot, paths.reactRoot, paths.sketchFile]);

  // -------------------------
  // Sketch IR 조회
  // -------------------------
  // Sketch IR 조회 및 Final IR 병합
  async function handleShowSketchIr(sketchIdParam) {
    const sketchId = sketchIdParam || (selected && screens.sketchIds[selected]);
    if (!paths.sketchFile || !selected || !sketchId) {
      log("Sketch IR: sketchFile, selected, sketchId 필요");
      setSketchIr(null);
      setPreviewTab("sketchIr");
      return;
    }
    try {
      const resp = await fetch(
        `${API_BASE}/api/sketch-dom-ir?sketchFile=${encodeURIComponent(
          paths.sketchFile
        )}&sketchId=${encodeURIComponent(sketchId)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSketchIr(data);
        log("Sketch IR 조회 성공");
        // Final IR 병합: IR Data와 Sketch IR이 모두 있으면 병합
        if (ir && data && data.ir) {
          const merged = mergeSketchDomIR(ir, data.ir);
          setFinalIr(merged);
        } else {
          setFinalIr(null);
        }
      } else {
        setSketchIr(null);
        setFinalIr(null);
        log("Sketch IR 조회 실패: " + resp.status);
      }
    } catch (e) {
      setSketchIr(null);
      setFinalIr(null);
      log("Sketch IR 조회 에러: " + e.message);
    }
    setPreviewTab("sketchIr");
  }

  // -------------------------
  // IR 생성 및 Sketch IR 병합
  // -------------------------
  // IR 생성 및 Final IR 병합
  async function buildIR(base, sketchIdParam) {
    log("buildIR called for " + base);
    const sketchId = sketchIdParam || (screens.sketchIds && screens.sketchIds[base]);
    try {
      const resp = await fetch(`${API_BASE}/api/build-ir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lvglRoot: paths.lvglRoot,
          reactRoot: paths.reactRoot,
          sketchFile: paths.sketchFile,
          screen: base,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        log("IR 생성 실패: " + (err.error || resp.status));
        setIr(null);
        return;
      }
      const irData = await resp.json();
      // Sketch IR이 있으면 병합 및 Final IR 저장
      if (paths.sketchFile && sketchId) {
        const sketchResp = await fetch(
          `${API_BASE}/api/sketch-dom-ir?sketchFile=${encodeURIComponent(
            paths.sketchFile
          )}&sketchId=${encodeURIComponent(sketchId)}`
        );
        if (sketchResp.ok) {
          const sketchIR = await sketchResp.json();
          const merged = mergeSketchDomIR(irData, sketchIR.ir);
          setIr(irData);
          setFinalIr(merged);
          setConvertResult({
            screenId: merged.screenId,
            sources: {
              lvglScreens: screens.lvglScreens,
              reactScreens: screens.reactScreens,
              sketchParsed: 1,
              screenshots: [],
            },
          });
          log("IR 병합 완료");
          return;
        }
      }
      // 병합 안 한 경우
      setIr(irData);
      setFinalIr(null);
      setConvertResult({
        screenId: irData.screenId,
        sources: {
          lvglScreens: screens.lvglScreens,
          reactScreens: screens.reactScreens,
          sketchParsed: 0,
          screenshots: [],
        },
      });
      log("IR 생성 완료");
    } catch (e) {
      log("IR 생성 에러: " + e.message);
      setIr(null);
    }
  }

  // -------------------------
  // React 코드 zip 다운로드
  // -------------------------
  const handleShareCode = useCallback(async () => {
    if (!ir) return alert("스크린을 먼저 선택하세요.");

    const zip = new JSZip();
    const code = irToJsx(ir, selected || "ScreenMain");

    zip.file(`${selected}.jsx`, code);

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${selected}_react_code.zip`);
  }, [ir, selected]);

  // -------------------------
  // UI 렌더링
  // -------------------------
  return (

    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* 왼쪽 패널 */}
  <div style={{ width: leftWidth, minWidth: 120, borderRight: "1px solid #ddd", padding: 12, background: '#f7faff', transition: 'width 0.1s', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Settings 섹션 헤더 (storybook 스타일) */}
        <div
          style={{
            display: 'flex', alignItems: 'center', marginBottom: 6, userSelect: 'none', cursor: 'pointer',
            padding: '2px 0 2px 2px', color: '#6b7280', fontWeight: 600, fontSize: 15, letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
          onClick={() => setShowSettings(v => !v)}
        >
          {/* 좌측 chevron */}
          <span style={{ fontSize: 18, marginRight: 7, transition: 'transform 0.15s', display: 'flex', alignItems: 'center' }}>
            {showSettings
              ? <svg width="16" height="16" style={{ transform: 'rotate(90deg)' }}><polyline points="5,3 11,8 5,13" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="16" height="16"><polyline points="5,3 11,8 5,13" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 15, letterSpacing: 0.5, color: '#6b7280', textTransform: 'uppercase' }}>
            Settings
          </span>
          {/* 우측 up/down 아이콘 */}
          <span style={{ marginLeft: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 18 }}>
            <svg width="10" height="6" style={{ marginBottom: -2 }}><polyline points="2,4 5,1 8,4" fill="none" stroke="#b0b6be" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <svg width="10" height="6" style={{ marginTop: -2 }}><polyline points="2,2 5,5 8,2" fill="none" stroke="#b0b6be" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </span>
        </div>
        {showSettings && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>LVGL 소스 경로</label>
              <input
                type="text"
                value={paths.lvglRoot}
                onChange={e => setPaths(p => ({ ...p, lvglRoot: e.target.value }))}
                placeholder="예: D:/project/lvgl"
                style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>React 소스 경로</label>
              <input
                type="text"
                value={paths.reactRoot}
                onChange={e => setPaths(p => ({ ...p, reactRoot: e.target.value }))}
                placeholder="예: D:/project/react-src"
                style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>Sketch 파일 경로</label>
              <input
                type="text"
                value={paths.sketchFile}
                onChange={e => setPaths(p => ({ ...p, sketchFile: e.target.value }))}
                placeholder="예: D:/project/ui.sketch"
                style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>스크린샷 폴더 경로 (옵션)</label>
              <input
                type="text"
                value={paths.screenshotDir || ''}
                onChange={e => setPaths(p => ({ ...p, screenshotDir: e.target.value }))}
                placeholder="예: D:/project/screenshots"
                style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 6, border: '1px solid #ccc', borderRadius: 4 }}
              />
            </div>
          </div>
        )}

  <div style={{ margin: '16px 0 8px', fontWeight: 600 }}>스크린 목록</div>
  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: 0 }}>
          {screens.lvglScreens.length === 0 && screens.reactScreens.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13 }}>스크린 목록 없음</div>
          ) : (
            <>
              {screens.lvglScreens.map(fullPath => {
                const fileName = fullPath ? fullPath.replace(/\\/g, '/').split('/').pop().replace(/\.c$/, '') : '';
                const sketchId = screens.sketchIds[fileName] || '';
                return (
                  <div
                    key={fileName}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '7px 10px',
                      marginBottom: 4,
                      borderRadius: 4,
                      background: selected === fileName ? '#dbeafe' : '#fff',
                      border: selected === fileName ? '1.5px solid #2563eb' : '1px solid #eee',
                      fontWeight: selected === fileName ? 600 : 400,
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer', flex: 1 }}
                      onClick={() => { setSelected(fileName); buildIR(fileName, sketchId); }}
                    >
                      {fileName}
                      {sketchId && (
                        <span style={{ color: '#38bdf8', fontSize: 12, marginLeft: 6 }}>[Sketch]</span>
                      )}
                    </span>
                    {paths.sketchFile && (
                      <input
                        type="text"
                        value={sketchId}
                        onChange={e => {
                          const newId = e.target.value;
                          setScreens(s => {
                            const next = { ...s, sketchIds: { ...s.sketchIds, [fileName]: newId } };
                            // 입력한 스크린이 현재 선택된 스크린이면 buildIR 즉시 호출
                            if (selected === fileName) {
                              setTimeout(() => buildIR(fileName, newId), 0);
                            }
                            return next;
                          });
                        }}
                        placeholder="sketch id"
                        style={{ width: 60, marginLeft: 6, fontSize: 13, padding: '2px 4px', border: '1px solid #bbb', borderRadius: 4 }}
                      />
                    )}
                  </div>
                );
              })}
              {screens.reactScreens.map(fullPath => {
                const fileName = fullPath ? fullPath.replace(/\\/g, '/').split('/').pop().replace(/\.jsx$/, '') : '';
                return (
                  <div
                    key={fileName}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '7px 10px',
                      marginBottom: 4,
                      borderRadius: 4,
                      background: selected === fileName ? '#dbeafe' : '#fff',
                      border: selected === fileName ? '1.5px solid #2563eb' : '1px solid #eee',
                      fontWeight: selected === fileName ? 600 : 400,
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer', flex: 1 }}
                      onClick={() => { setSelected(fileName); buildIR(fileName); }}
                    >
                      {fileName}
                      <span style={{ color: '#a3a3a3', fontSize: 12, marginLeft: 6 }}>[React]</span>
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>


      </div>
      {/* 왼쪽-중앙 리사이저 */}
      <div
        style={{ width: 7, cursor: 'col-resize', background: '#e0e7ef', zIndex: 10 }}
        onMouseDown={e => {
          dragging.current = { type: 'left', startX: e.clientX, startWidth: leftWidth };
        }}
      />

      {/* 중앙 영역 */}
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fa",
          position: 'relative',
        }}
      >
        <div
          style={{
            width: "100%",
            minHeight: 220,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 8px #0001",
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {(finalIr || safeIr) ? (
            <Renderer ir={finalIr || safeIr} />
          ) : (
            <div style={{ color: "red" }}>스크린을 선택하세요.</div>
          )}
        </div>
      </div>
      {/* 중앙-오른쪽 리사이저 */}
      <div
        style={{ width: 7, cursor: 'col-resize', background: '#e0e7ef', zIndex: 10 }}
        onMouseDown={e => {
          dragging.current = { type: 'right', startX: e.clientX, startWidth: rightWidth };
        }}
      />

  {/* 오른쪽 패널 */}
      {/* 오른쪽 패널 */}
      <div
        style={{
          width: rightWidth,
          minWidth: 180,
          borderLeft: "1px solid #ddd",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          transition: 'width 0.1s',
        }}
      >
        {/* TAB */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #e5e7eb', background: '#f9fafb', height: 44 }}>
          <div
            onClick={() => setPreviewTab('ir')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 16,
              color: previewTab === 'ir' ? '#2563eb' : '#222',
              borderBottom: previewTab === 'ir' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              background: 'none',
              transition: 'color 0.15s, border-bottom 0.15s',
              height: '100%',
            }}
            onMouseOver={e => { if (previewTab !== 'ir') e.currentTarget.style.color = '#2563eb'; }}
            onMouseOut={e => { if (previewTab !== 'ir') e.currentTarget.style.color = '#222'; }}
          >
            IR Data
          </div>
          <div
            onClick={() => handleShowSketchIr(selected && screens.sketchIds[selected])}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 16,
              color: previewTab === 'sketchIr' ? '#2563eb' : '#222',
              borderBottom: previewTab === 'sketchIr' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              background: 'none',
              transition: 'color 0.15s, border-bottom 0.15s',
              height: '100%',
            }}
            onMouseOver={e => { if (previewTab !== 'sketchIr') e.currentTarget.style.color = '#2563eb'; }}
            onMouseOut={e => { if (previewTab !== 'sketchIr') e.currentTarget.style.color = '#222'; }}
          >
            Sketch IR
          </div>
          <div
            onClick={() => setPreviewTab('finalIr')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 16,
              color: previewTab === 'finalIr' ? '#2563eb' : '#222',
              borderBottom: previewTab === 'finalIr' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              background: 'none',
              transition: 'color 0.15s, border-bottom 0.15s',
              height: '100%',
            }}
            onMouseOver={e => { if (previewTab !== 'finalIr') e.currentTarget.style.color = '#2563eb'; }}
            onMouseOut={e => { if (previewTab !== 'finalIr') e.currentTarget.style.color = '#222'; }}
          >
            Final IR
          </div>
          <div
            onClick={() => setPreviewTab('jsx')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 16,
              color: previewTab === 'jsx' ? '#2563eb' : '#222',
              borderBottom: previewTab === 'jsx' ? '2.5px solid #2563eb' : '2.5px solid transparent',
              background: 'none',
              transition: 'color 0.15s, border-bottom 0.15s',
              height: '100%',
            }}
            onMouseOver={e => { if (previewTab !== 'jsx') e.currentTarget.style.color = '#2563eb'; }}
            onMouseOut={e => { if (previewTab !== 'jsx') e.currentTarget.style.color = '#222'; }}
          >
            React Code
          </div>
        </div>

        {/* TAB CONTENT */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {previewTab === "ir" && (
            <pre>{safeIr ? JSON.stringify(safeIr, null, 2) : "[IR 없음]"}</pre>
          )}

          {previewTab === "sketchIr" && (
            <pre>
              {sketchIr ? JSON.stringify(sketchIr, null, 2) : "[Sketch IR 없음]"}
            </pre>
          )}

          {previewTab === "finalIr" && (
            <pre>
              {finalIr ? JSON.stringify(finalIr, null, 2) : "[Final IR 없음]"}
            </pre>
          )}

          {previewTab === "jsx" && (
            <pre>
              {finalIr
                ? irToJsx(finalIr, selected || "ScreenMain")
                : "[React 코드 없음]"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
