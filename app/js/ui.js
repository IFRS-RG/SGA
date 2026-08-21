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
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3600);
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
