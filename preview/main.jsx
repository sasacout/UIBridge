import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { Renderer } from './Renderer.jsx';

async function start(){
  let ir=null;
  try {
    const resp = await fetch('../dist/ui-ir.json');
    if(resp.ok) ir = await resp.json();
  } catch(e){ console.warn('No initial IR'); }
  const root = createRoot(document.getElementById('root'));
  root.render(<React.StrictMode><App /><Renderer ir={ir} /></React.StrictMode>);
}
start();