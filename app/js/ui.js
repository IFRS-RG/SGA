// ============================================================
// SGA — Helpers de interface (modal, toast, utilidades)
// ============================================================

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = '<span class="toast-ico">' + icon + '</span><span>' + esc(msg) + '</span>';
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  const dur = type === 'error' ? 5200 : 3600;
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, dur);
}

// ── Barra de progresso no topo (aparece durante chamadas ao servidor) ──
let _progCount = 0, _progEl = null;
function _ensureProg() {
  if (_progEl) return;
  _progEl = document.createElement('div');
  _progEl.className = 'top-progress';
  _progEl.innerHTML = '<div class="top-progress-bar"></div>';
  document.body.appendChild(_progEl);
}
function progressStart() { _ensureProg(); _progCount++; _progEl.classList.add('active'); }
function progressDone() {
  _progCount = Math.max(0, _progCount - 1);
  if (_progCount === 0 && _progEl) _progEl.classList.remove('active');
}

// ── Modal ─────────────────────────────────────────────────────
let _modalConfirm = null;

function openModal(title, bodyHtml, onConfirm, opts = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn  = document.getElementById('modal-cancel');
  const footer     = document.getElementById('modal-footer');

  footer.hidden = opts.hideFooter === true;
  confirmBtn.className = 'btn btn-primary';           // reseta estilo (ex.: btn-danger de confirmações)
  confirmBtn.disabled = false;
  confirmBtn.textContent = opts.confirmLabel || 'Salvar';
  confirmBtn.dataset.label = confirmBtn.textContent;   // usado por setBusy() para restaurar
  confirmBtn.hidden = opts.hideConfirm === true;
  cancelBtn.textContent = opts.cancelLabel || 'Cancelar';

  _modalConfirm = onConfirm;
  document.getElementById('modal-overlay').hidden = false;
  // Foco no primeiro campo.
  setTimeout(() => {
    const f = document.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
    if (f) f.focus();
  }, 50);
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.getElementById('modal-body').innerHTML = '';
  _modalConfirm = null;
}

function initModalEvents() {
  document.getElementById('modal-close').onclick  = closeModal;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-confirm').onclick = async () => {
    if (_modalConfirm) await _modalConfirm();
  };
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
}

function setBusy(on) {
  const btn = document.getElementById('modal-confirm');
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? 'Salvando…' : (btn.dataset.label || 'Salvar');
}

// ── Confirmação simples ───────────────────────────────────────
function confirmDialog(title, message, onYes, yesLabel = 'Confirmar') {
  openModal(title, `<p class="confirm-text">${esc(message)}</p>`, async () => {
    closeModal();
    await onYes();
  }, { confirmLabel: yesLabel });
  const btn = document.getElementById('modal-confirm');
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-danger');
}

// ── Utilidades de formulário ──────────────────────────────────
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function optionsHtml(list, selected) {
  return list.map(o => `<option ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

// Dinheiro: parse "1.234,56" → 1234.56; formata número → "R$ 1.234,56".
function parseMoney(s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}
function fmtMoney(n) {
  const v = typeof n === 'number' ? n : parseMoney(n);
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Lê um arquivo como base64 (sem o prefixo data:).
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Estado vazio.
function emptyState(text, actionHtml = '') {
  return `<div class="empty-state"><p>${esc(text)}</p>${actionHtml}</div>`;
}

// ── Export XLS (tabela HTML — Excel separa em colunas certinho) ─
function exportXLS(headers, rows, filename) {
  const thead = '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const tbody = rows.map(r => '<tr>' + r.map(c => `<td>${esc(c == null ? '' : c)}</td>`).join('') + '</tr>').join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <style>
      table{border-collapse:collapse;}
      th{background:#1e3a5f;color:#fff;font-weight:bold;}
      th,td{border:1px solid #cbd5e1;padding:4px 8px;mso-number-format:"\\@";}
    </style></head><body><table>${thead}${tbody}</table></body></html>`;
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename + '.xls'; a.click();
  URL.revokeObjectURL(url);
}

// ── Export PDF (janela de impressão → salvar como PDF) ────────
function exportPDF(title, headers, rows) {
  const tr = rows.map(r => '<tr>' + r.map(c => `<td>${esc(c == null ? '' : c)}</td>`).join('') + '</tr>').join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;color:#1f2937;padding:16px;}
      h2{margin:0 0 12px;color:#1e3a5f;}
      table{width:100%;border-collapse:collapse;}
      th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-size:10px;}
      td{padding:5px 8px;border-bottom:1px solid #eee;}
      tr:nth-child(even){background:#f5f7fa;}
      p.gen{color:#999;font-size:10px;margin-top:12px;}
    </style></head><body>
    <h2>${esc(title)}</h2>
    <table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tr}</tbody></table>
    <p class="gen">Gerado em ${new Date().toLocaleString('pt-BR')} · SGA — IFRS Campus Rio Grande</p>
    </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html); win.document.close(); win.focus(); win.print();
}
