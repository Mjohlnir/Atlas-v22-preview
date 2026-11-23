// ==UserScript==
// @name         Atlas v22 - Itamae Crunchyroll Sync
// @namespace    https://github.com/Mjohlnir/Atlas-v22-preview
// @version      0.1.0
// @description  Sincroniza histórico Crunchyroll diretamente com a aba Atlas, sem JSON
// @match        https://www.crunchyroll.com/*
// @match        https://crunchyroll.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Mjohlnir/Atlas-v22-preview/main/itamae-atlas.user.js
// @downloadURL  https://raw.githubusercontent.com/Mjohlnir/Atlas-v22-preview/main/itamae-atlas.user.js
// ==/UserScript==
(() => {
  'use strict';
  const entries = new Map();
  // Episódio + data da reprodução: repetir o mesmo episódio não apaga o evento anterior.
  const eventKey = item => {
    const id=item?.id??item?.content_id??item?.panel?.id??item?.episode_id;
    const when=item?.date??item?.watched_at??item?.updated_at??item?.date_played;
    return id && when ? String(id)+'@'+String(when) : null;
  };
  const historyUrl = /\/content\/v2\/[^/?]+\/watch-history(?:[/?#]|$)/i;
  let loading = false;
  let stopRequested = false;
  let panel, status, loadBtn, saveBtn, sendBtn;
  let atlasOrigin = null, enabled = false, pending = false, lastSent = new Map(), batchCounter = 0;
  const allowedAtlas = new Set(['https://mjohlnir.github.io','http://localhost:3000','http://127.0.0.1:3000','http://localhost:5500','http://127.0.0.1:5500']);
  const protocol = 'atlas-crunchy-v1';
  window.addEventListener('message', event => {
    if (event.source !== window.opener || !allowedAtlas.has(event.origin) || event.data?.protocol !== protocol) return;
    if (event.data.type === 'hello') {atlasOrigin = event.origin; if(sendBtn)sendBtn.disabled=false;}
    if (event.data.type === 'ack') {if(status)status.textContent = `Atlas confirmou ${event.data.count} registros`;}
    if (event.data.type === 'error') {enabled=false; if(status)status.textContent = 'Atlas recusou lote: '+String(event.data.message).slice(0,130);}
  });
  let sendTimer;
  function scheduleSend(){if(!enabled||pending||!atlasOrigin)return;clearTimeout(sendTimer);sendTimer=setTimeout(sendToAtlas,1200)}
  function sendToAtlas(){
    if(!enabled||pending||!atlasOrigin||!window.opener||window.opener.closed)return;
    const rows=[];
    for(const [k,item] of entries){const signature=JSON.stringify(item);if(lastSent.get(k)!==signature){rows.push(item);if(rows.length===500)break}}
    if(!rows.length)return;
    pending=true;
    const batch=++batchCounter;
    // Marcar como enviado somente após ACK; evitar perda de registros quando falhar.
    const onAck=event=>{
      if(event.source!==window.opener||event.origin!==atlasOrigin||event.data?.protocol!==protocol||event.data?.batch!==batch)return;
      window.removeEventListener('message',onAck);
      clearTimeout(timeout);
      if(event.data.type==='ack'){for(const item of rows){const k=eventKey(item);if(k)lastSent.set(k,JSON.stringify(item))}pending=false;scheduleSend();}else{pending=false;enabled=false;}
    };
    window.addEventListener('message',onAck);
    const timeout=setTimeout(()=>{window.removeEventListener('message',onAck);pending=false;enabled=false;if(status)status.textContent='Sem confirmação do Atlas. Reative o envio para tentar novamente.'},30000);
    window.opener.postMessage({protocol,type:'history',batch,rows},atlasOrigin);
  }
  function startSend(){if(!atlasOrigin)return alert('Abra o Crunchyroll pelo botão Conectar aba Crunchyroll dentro do Atlas.');enabled=true;scheduleSend();if(!loading)autoLoad();}

  const isHistory = () => /\/history\/?$/.test(location.pathname);
  const label = () => {
    if (status) status.textContent = `${entries.size} registros capturados`;
    if (saveBtn) saveBtn.disabled = entries.size === 0;
  };
  function ingest(url, data) {
    if (!historyUrl.test(String(url))) return;
    try {
      const rows = Array.isArray(data?.data) ? data.data :
        Array.isArray(data?.data?.items) ? data.data.items :
        Array.isArray(data?.items) ? data.items : [];
      for (const item of rows) {
        const key = eventKey(item);
        if(key) entries.set(key, item);
      }
      label();
      scheduleSend();
    } catch (e) { console.warn('[Itamae corrigido] Erro ao ler historico', e); }
  }
  // Captura as requisicoes que a propria pagina realiza; nao acessa credenciais.
  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      return nativeFetch.apply(this, args).then(response => {
        if (historyUrl.test(String(url))) {
          response.clone().json().then(data => ingest(url, data)).catch(() => {});
        }
        return response;
      });
    };
  }
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__itamaeHistoryUrl = String(url);
    this.addEventListener('load', function () {
      if (!historyUrl.test(this.__itamaeHistoryUrl)) return;
      try { ingest(this.__itamaeHistoryUrl, JSON.parse(this.responseText)); } catch (_) {}
    });
    return nativeOpen.call(this, method, url, ...rest);
  };
  function button(text, click) {
    const el = document.createElement('button');
    el.textContent = text;
    Object.assign(el.style, {background:'#f47521',color:'#fff',border:'0',borderRadius:'6px',padding:'8px 10px',cursor:'pointer',fontWeight:'bold'});
    el.addEventListener('click', click);
    return el;
  }
  function download() {
    if (!entries.size) return alert('Nenhum registro capturado. Recarregue a pagina de historico e role ate o final antes de salvar.');
    const blob = new Blob([JSON.stringify([...entries.values()], null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'crunchyroll-watch-history.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function autoLoad() {
    if (loading) { stopRequested = true; return; }
    loading = true; stopRequested = false;
    loadBtn.textContent = 'Parar';
    let stable = 0;
    let previousCount = -1;
    let previousHeight = -1;
    for (let n = 0; n < 300 && !stopRequested; n++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 1800));
      const height = document.documentElement.scrollHeight;
      if (entries.size === previousCount && height === previousHeight) stable++;
      else stable = 0;
      previousCount = entries.size;
      previousHeight = height;
      if (stable >= 4) break;
    }
    loading = false;
    loadBtn.textContent = 'Carregar tudo';
    label();
    if (!entries.size) status.textContent = '0 registros: API nao capturada; veja instrucoes';
    window.scrollTo(0, 0);
  }
  function render() {
    if (!document.body) return;
    if (!isHistory()) { panel?.remove(); panel = null; return; }
    if (panel?.isConnected) return;
    panel = document.createElement('div');
    panel.id = 'itamae-fixed-toolbar';
    Object.assign(panel.style, {position:'fixed',bottom:'18px',right:'18px',zIndex:'2147483647',background:'#202020',border:'1px solid #f47521',borderRadius:'10px',padding:'12px',display:'flex',gap:'8px',alignItems:'center',boxShadow:'0 3px 18px #0009',font:'13px Arial,sans-serif',color:'#fff'});
    const heading = document.createElement('strong'); heading.textContent = 'Itamae';
    status = document.createElement('span');
    loadBtn = button('Carregar tudo', autoLoad);
    saveBtn = button('Salvar JSON', download);
    sendBtn = button('Enviar ao Atlas', startSend);
    sendBtn.disabled = !atlasOrigin;
    panel.append(heading, status, loadBtn, saveBtn, sendBtn);
    document.body.appendChild(panel);
    label();
  }
  function init() {
    render();
    // O site navega entre paginas sem recarregar (SPA).
    let lastPath = location.pathname;
    setInterval(() => {
      if (lastPath !== location.pathname || (isHistory() && !panel?.isConnected)) {
        lastPath = location.pathname;
        render();
      }
    }, 750);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
