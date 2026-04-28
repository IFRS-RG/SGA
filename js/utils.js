// ============================================================
// SGA — Utilitários
// ============================================================

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const SEGMENTOS = ['Ensino','Pesquisa','Extensão','Indissociável','Conjunto'];

// ── Datas ─────────────────────────────────────────────────────
function mesAnoLabel(mesAno) {
  if (!mesAno) return '';
  const [ano, mes] = mesAno.split('-');
  return `${MESES[parseInt(mes) - 1]} ${ano}`;
}

function isoToBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildMesAnoOptions(start, end) {
  // start = {year, month(1-based)}, end = {year, month}
  const options = [];
  let y = start.year, m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    const val = `${y}-${String(m).padStart(2, '0')}`;
    options.push({ value: val, label: mesAnoLabel(val) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return options;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, duration);
  setTimeout(() => t.remove(), duration + 350);
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); }
}

function buildModal(id, title, bodyHtml, footer) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = id;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  }
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="closeModal('${id}')">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${footer || ''}</div>
    </div>`;
  return el;
}

// ── Loading ───────────────────────────────────────────────────
function showLoading(containerId, msg = 'Carregando...') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>${msg}</span></div>`;
}

function showEmpty(containerId, msg = 'Nenhum registro encontrado.') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty-state">${msg}</div>`;
}

// ── Validação ─────────────────────────────────────────────────
function validateForm(fields) {
  let valid = true;
  fields.forEach(({ el, msg }) => {
    if (!el) return;
    const v = el.value ? el.value.trim() : '';
    if (!v) {
      el.classList.add('error');
      el.title = msg || 'Campo obrigatório';
      valid = false;
    } else {
      el.classList.remove('error');
    }
  });
  return valid;
}

// ── Export XLS ────────────────────────────────────────────────
function exportXLS(headers, rows, filename) {
  let csv = '﻿'; // BOM for Excel
  csv += headers.join('\t') + '\n';
  rows.forEach(r => { csv += r.map(c => String(c || '').replace(/\t/g, ' ')).join('\t') + '\n'; });
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename + '.xls';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export PDF (print) ────────────────────────────────────────
function exportPDF(title, headers, rows) {
  const tableRows = rows.map(r =>
    '<tr>' + r.map(c => `<td>${c || ''}</td>`).join('') + '</tr>'
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; }
      h2 { margin-bottom: 12px; color: #50679c; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #50679c; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) { background: #f5f5f5; }
      p.gen { color: #999; font-size: 10px; margin-top: 12px; }
    </style></head><body>
    <h2>${title}</h2>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table>
    <p class="gen">Gerado em ${new Date().toLocaleString('pt-BR')} · SGA — IFRS Campus Rio Grande</p>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

// ── Collapse toggle ───────────────────────────────────────────
function toggleCollapse(headerEl, bodyEl) {
  const open = bodyEl.classList.toggle('open');
  headerEl.classList.toggle('expanded', open);
  return open;
}

// ── Sanitize ──────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Status badge HTML ─────────────────────────────────────────
function statusBadge(status) {
  const s = String(status || 'Inativo');
  const cls = s === 'Ativo' ? 'badge-green' : 'badge-gray';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

// ── Bool / checkbox helpers ───────────────────────────────────
function isTrue(v) { return v === true || v === 'TRUE' || v === 'true'; }
