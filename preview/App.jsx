
import React, { useState, useEffect } from 'react';
import { irToJsx } from '../src/core/ui-ir/irToJsx';
import { Renderer } from './Renderer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7000';

export default function App() {
  const [paths, setPaths] = useState({ lvglRoot: '', reactRoot: '', sketchFile: '', screenshotFolder: '' });
  const [screens, setScreens] = useState({ lvglScreens: [], reactScreens: [] });
  const [selected, setSelected] = useState('');
  const [ir, setIr] = useState(null);
  const [convertResult, setConvertResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [coverage, setCoverage] = useState(null);
    const [previewTab, setPreviewTab] = useState('preview'); // 'preview' | 'ir' | 'jsx'

  function log(msg) { setLogs(l => [msg, ...l.slice(0, 49)]); }

  // 핸들러 함수 더미 정의
    // 핸들러 함수 실제 구현
    async function fetchScreens() {
      log('fetchScreens called');
      const params = new URLSearchParams({
        lvglRoot: paths.lvglRoot,
        reactRoot: paths.reactRoot
      });
      try {
        const resp = await fetch(`${API_BASE}/api/screens?${params}`);
        if (resp.ok) {
          const data = await resp.json();
          setScreens(data);
          log('스크린 목록 로드 완료');
        } else {
          log('스크린 목록 로드 실패: ' + resp.status);
        }
      } catch (e) {
        log('스크린 목록 로드 에러: ' + e.message);
      }
    }
    function handleReactConvert() {
      if (!selected) {
        log('스크린을 먼저 선택하세요.');
        return;
      }
      buildIR(selected);
    }
    function loadCoverage() {
      log('loadCoverage called');
    }
    function convertAll() {
      log('convertAll called');
    }
    async function buildIR(base) {
      log('buildIR called for ' + base);
      try {
        const resp = await fetch(`${API_BASE}/api/build-ir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lvglRoot: paths.lvglRoot,
            reactRoot: paths.reactRoot,
            sketchFile: paths.sketchFile,
            screen: base
          })
        });
        if (resp.ok) {
          const irData = await resp.json();
          setIr(irData);
          setConvertResult({ screenId: irData.screenId, sources: { lvglScreens: screens.lvglScreens, reactScreens: screens.reactScreens, sketchParsed: 0, screenshots: [] } });
          log('IR 생성 완료: ' + irData.widgets.length + ' widgets');
        } else {
          const err = await resp.json();
          log('IR 생성 실패: ' + (err.error || resp.status));
          setIr(null);
        }
      } catch (e) {
        log('IR 생성 에러: ' + e.message);
        setIr(null);
      }
    }

  // ...기존 함수들 유지...

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: 320, borderRight: '1px solid #ddd', padding: 12, overflow: 'auto' }}>
        <h3>Paths</h3>
        <div>
          {['lvglRoot', 'reactRoot', 'sketchFile', 'screenshotFolder'].map(k => (
            <div key={k} style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 12 }}>{k}</label>
              <input style={{ width: '100%' }} value={paths[k]} onChange={e => setPaths(p => ({ ...p, [k]: e.target.value }))} placeholder={k} />
            </div>
          ))}
        </div>
        <div>
          <button onClick={() => fetchScreens()}>Scan Screens</button>
          <button onClick={() => handleReactConvert()}>리액트 코드 생성</button>
          <button onClick={() => loadCoverage()}>Coverage</button>
          <button disabled={!paths.lvglRoot || !paths.reactRoot || !paths.sketchFile || !paths.screenshotFolder} onClick={convertAll}>Convert All</button>
        </div>
        <div>
          <hr />
          <h4>Screens</h4>
          <div>
            {[...screens.lvglScreens, ...screens.reactScreens].map(f => {
              const base = f.replace(/\\/g, '/').split('/').pop().replace(/\.(c|jsx|tsx)$/, '');
              return <div key={f} style={{ cursor: 'pointer', padding: 4, background: base === selected ? '#eef' : 'transparent' }} onClick={() => { setSelected(base); buildIR(base); }}>{base}</div>;
            })}
          </div>
          <hr />
          <h4>Status</h4>
          <div style={{ fontSize: 12 }}>
            {coverage && <div>coverage total widgets: {coverage.total}</div>}
            {ir && <div>IR widgets: {ir.widgets.length}</div>}
            <div>selected: {selected}</div>
            {convertResult && <div>converted: {convertResult.screenId}</div>}
          </div>
          <hr />
          <h4>Logs</h4>
          <div style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 'bold', marginRight: 16 }}>Preview</span>
          <button onClick={() => setPreviewTab('preview')} style={{ fontWeight: previewTab==='preview'?'bold':'normal' }}>미리보기</button>
          <button onClick={() => setPreviewTab('ir')} style={{ fontWeight: previewTab==='ir'?'bold':'normal' }}>IR Data</button>
          <button onClick={() => setPreviewTab('jsx')} style={{ fontWeight: previewTab==='jsx'?'bold':'normal' }}>React Code</button>
        </div>
          <div style={{ border: '1px solid #ddd', padding: 16, marginTop: 0, minHeight: 220, background: previewTab==='preview' ? '#000' : '#fff' }}>
            {previewTab === 'preview' && (
              <div style={{ width: '100%', minHeight: 220, background: '#fff', display: 'block' }}>
                {(() => { console.log('미리보기에 전달되는 IR:', ir); return null; })()}
                <Renderer ir={ir} />
              </div>
            )}
            {previewTab === 'ir' && (
              <pre style={{ fontSize: 13, color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{ir ? JSON.stringify(ir, null, 2) : '[IR 없음]'}</pre>
            )}
            {previewTab === 'jsx' && (
              <pre style={{ fontSize: 13, color: '#222', background: '#f8f8f8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{ir ? irToJsx(ir, selected || 'ScreenMain') : '[React 코드 없음]'}</pre>
            )}
          </div>
      </div>
    </div>
  );
}
