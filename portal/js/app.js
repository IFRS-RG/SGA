// ============================================================
// Portal do Aluno — App (login @aluno, vagas, inscrição)
// ============================================================
const SEGMENTOS_PORTAL = ['Ensino', 'Pesquisa', 'Extensão', 'Indissociável'];
const CRONOGRAMA_PORTAL = [
  ['inicioInsc', 'Início das inscrições'],
  ['fimInsc', 'Fim das inscrições'],
  ['homologacao', 'Homologação das inscrições'],
  ['resultadoParcial', 'Resultado parcial'],
  ['prazoRecurso', 'Prazo de recurso'],
  ['resultadoFinal', 'Resultado final'],
  ['inicioAtividades', 'Início das atividades']
];

const Portal = {
  token: null,
  user: null,          // { email, nome }
  tab: 'vagas',
  vagas: [],           // processos publicados com suas vagas
  minhas: [],
  cursos: [],
  segAtivo: {},        // segmento ativo por processo (selecaoId -> segmento)
  procAberto: {},      // processo expandido/recolhido (selecaoId -> bool)
  _modalOk: null,

  _br(iso) { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : iso; },

  // ── util ──────────────────────────────────────────────
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  toast(msg, kind) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false;
    clearTimeout(this._tt); this._tt = setTimeout(() => { t.hidden = true; }, 3500);
  },
  _jwt(token) { try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } },

  async gasCall(action, extra) {
    const body = JSON.stringify(Object.assign({ action, token: this.token }, extra || {}));
    let resp;
    try {
      resp = await fetch(PORTAL_CONFIG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
    } catch (e) { throw new Error('Falha de conexão com o servidor.'); }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.error) {
      if (/sess[aã]o inv[aá]lida|expirada/i.test(data.error)) this.logout();
      throw new Error(data.error);
    }
    return data;
  },

  // ── login (Google Identity Services) ──────────────────
  initGIS() {
    if (!window.google || !google.accounts || !google.accounts.id) { setTimeout(() => this.initGIS(), 200); return; }
    google.accounts.id.initialize({ client_id: PORTAL_CONFIG.GOOGLE_CLIENT_ID, callback: (r) => Portal.onCredential(r) });
    google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_blue', size: 'large', text: 'signin_with', locale: 'pt-BR' });
  },

  async onCredential(resp) {
    this.token = resp.credential;
    const p = this._jwt(this.token);
    this.user = { email: (p.email || '').toLowerCase(), nome: p.name || p.email || '' };
    const msg = document.getElementById('login-msg');
    if (this.user.email.slice(-'@aluno.riogrande.ifrs.edu.br'.length) !== '@aluno.riogrande.ifrs.edu.br') {
      msg.textContent = 'Use sua conta @aluno.riogrande.ifrs.edu.br.'; msg.hidden = false; this.token = null; return;
    }
    msg.hidden = true;
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('userbox').hidden = false;
    document.getElementById('user-email').textContent = this.user.email;
    await this.load();
  },

  logout() {
    this.token = null; this.user = null;
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    location.reload();
  },

  async load() {
    const panel = document.getElementById('panel');
    panel.innerHTML = '<div class="spin"></div>';
    try {
      const [vagas, minhas, cursos] = await Promise.all([this.gasCall('getVagas'), this.gasCall('getMinhas'), this.gasCall('getCursos')]);
      this.vagas = vagas || []; this.minhas = minhas || []; this.cursos = cursos || [];
    } catch (e) { panel.innerHTML = `<div class="empty">${this.esc(e.message)}</div>`; return; }
    this.render();
  },

  showTab(t) { this.tab = t; document.getElementById('tab-vagas').classList.toggle('active', t === 'vagas'); document.getElementById('tab-minhas').classList.toggle('active', t === 'minhas'); this.render(); },

  render() { document.getElementById('panel').innerHTML = this.tab === 'minhas' ? this.renderMinhas() : this.renderVagas(); },

  _inscritoEm(vagaId) { return this.minhas.some(i => String(i.vagaId) === String(vagaId)); },
  _naSelecao(selId) { return this.minhas.filter(i => String(i.selecaoId) === String(selId)).length; },

  _reqList(req) {
    req = req || {}; const out = [];
    if (req.modalidade && req.modalidade.length) out.push('Modalidade: ' + req.modalidade.join(', '));
    if (req.cursos === 'todos') out.push('Cursos: todos');
    else if (req.cursosNomes && req.cursosNomes.length) out.push('Cursos: ' + req.cursosNomes.join(', '));
    if (req.periodoMin) out.push('Período/semestre mínimo: ' + req.periodoMin);
    if (req.assistencia) out.push('Beneficiário de assistência estudantil');
    (req.demais || []).forEach(d => { if (d.requisito) out.push(d.requisito + (d.comprovacao ? ' (comprovação: ' + d.comprovacao + ')' : '')); });
    return out;
  },

  _fmtMoney(v) { const n = Number(v); return isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },

  // Card recolhido de uma vaga (expande ao clicar no cabeçalho).
  _vagaCard(proc, v) {
    const faixas = (v.faixas || []).map(f => `<tr><td>${this.esc(f.ch)}h</td><td>${v.tipo === 'Bolsista' && f.valor !== '' && f.valor != null ? this._fmtMoney(f.valor) : '—'}</td><td>${this.esc(f.quantidade)}</td></tr>`).join('');
    const req = this._reqList(v.requisitos);
    const reqH = req.length ? '<ul>' + req.map(x => `<li>${this.esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">Sem requisitos eliminatórios.</p>';
    const crit = (v.criterios || []);
    const critH = crit.length ? `<table class="table"><thead><tr><th>Critério</th><th>Peso</th></tr></thead><tbody>${crit.map(c => `<tr><td>${this.esc(c.criterio || c.categoria)}</td><td>${this.esc(c.peso)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sem critérios.</p>';
    const inscrito = this._inscritoEm(v.vagaId);
    const btn = inscrito
      ? `<span class="tag tag-ok">✓ Inscrito</span>`
      : (proc.inscricoesAbertas
        ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Portal.abrirInscricao('${proc.selecaoId}','${v.vagaId}')">Inscrever-se</button>`
        : `<span class="tag">Inscrições fechadas</span>`);
    const totalVagas = (v.faixas || []).reduce((s, f) => s + (Number(f.quantidade) || 0), 0);
    return `<div class="card">
      <div class="card-head vg-toggle" onclick="Portal.toggleVaga('${proc.selecaoId}','${v.vagaId}')">
        <div><h3>${v.tipo === 'Bolsista' ? '🎓' : '🙌'} ${this.esc(v.titulo)} <span class="chev" id="chev-${proc.selecaoId}-${v.vagaId}">▸</span></h3>
          <span class="tag">${this.esc(v.tipo)}</span> <span class="muted">· ${totalVagas} vaga(s)</span></div>
        ${btn}
      </div>
      <div class="vg-body" id="body-${proc.selecaoId}-${v.vagaId}" hidden>
        <p class="kv"><b>Ação:</b> ${this.esc(v.acao || '—')}${v.edital ? ' · <b>Edital:</b> ' + this.esc(v.edital) : ''}</p>
        <p class="kv"><b>Coordenador:</b> ${this.esc(v.coordNome || '—')}${v.coordEmail ? ' · ' + this.esc(v.coordEmail) : ''}</p>
        ${v.resumo ? `<p class="kv"><b>Resumo:</b> ${this.esc(v.resumo)}</p>` : ''}
        <table class="table"><thead><tr><th>CH</th><th>Valor da bolsa</th><th>Vagas</th></tr></thead><tbody>${faixas || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
        ${(v.habilidades && (v.habilidades.soft || v.habilidades.hard)) ? `<p class="kv"><b>Habilidades desejadas:</b></p>
          ${v.habilidades.soft ? `<p class="kv">Soft skills: ${this.esc(v.habilidades.soft)}</p>` : ''}
          ${v.habilidades.hard ? `<p class="kv">Hard skills: ${this.esc(v.habilidades.hard)}</p>` : ''}` : ''}
        <details><summary>Requisitos</summary>${reqH}</details>
        <details><summary>Critérios de seleção</summary>${critH}</details>
      </div>
    </div>`;
  },

  _cronogramaHtml(cron) {
    cron = cron || {};
    const rows = CRONOGRAMA_PORTAL.filter(([k]) => cron[k])
      .map(([k, label]) => `<tr><td>${this.esc(label)}</td><td>${this.esc(this._br(cron[k]))}</td></tr>`).join('');
    if (!rows) return '';
    return `<details style="margin:6px 0"><summary>📅 Cronograma</summary>
      <table class="table"><tbody>${rows}</tbody></table></details>`;
  },

  renderVagas() {
    if (!this.vagas.length) return '<div class="empty">Nenhuma vaga aberta no momento.</div>';
    // Abertos primeiro; encerrados depois (histórico).
    const procs = this.vagas.slice().sort((a, b) => (a.status === 'Aberta' ? 0 : 1) - (b.status === 'Aberta' ? 0 : 1));
    return procs.map(proc => {
      const aberto = proc.status === 'Aberta';
      const expanded = this.procAberto[proc.selecaoId] !== undefined ? this.procAberto[proc.selecaoId] : aberto;
      const vagasSeg = {};
      SEGMENTOS_PORTAL.forEach(s => { vagasSeg[s] = []; });
      const outros = [];
      (proc.vagas || []).forEach(v => {
        if (SEGMENTOS_PORTAL.indexOf(v.segmento) !== -1) vagasSeg[v.segmento].push(v);
        else outros.push(v);
      });
      const segs = SEGMENTOS_PORTAL.slice();
      if (outros.length) { vagasSeg['Outros'] = outros; segs.push('Outros'); }
      let seg = this.segAtivo[proc.selecaoId];
      if (!seg || segs.indexOf(seg) === -1) seg = segs.find(s => vagasSeg[s].length) || segs[0];
      const subtabs = segs.map(s =>
        `<button class="tab ${s === seg ? 'active' : ''}" onclick="Portal.switchSeg('${proc.selecaoId}','${s}')">${this.esc(s)} <span class="muted">(${vagasSeg[s].length})</span></button>`).join('');
      const lista = vagasSeg[seg].length
        ? vagasSeg[seg].map(v => this._vagaCard(proc, v)).join('')
        : '<div class="empty">Nenhuma vaga neste segmento.</div>';
      const rest = proc.maxVagasAluno - this._naSelecao(proc.selecaoId);
      const statusTag = aberto
        ? (proc.inscricoesAbertas ? `<span class="tag tag-ok">Inscrições abertas</span>` : `<span class="tag">Inscrições fechadas</span>`)
        : `<span class="tag">Encerrada</span>`;
      return `<div class="proc">
        <div class="proc-head" onclick="Portal.toggleProc('${proc.selecaoId}')">
          <h2 style="margin:0">${this.esc(proc.nome)} ${statusTag}</h2>
          <span class="chev" id="pchev-${proc.selecaoId}">${expanded ? '▾' : '▸'}</span>
        </div>
        <div class="proc-body" id="pbody-${proc.selecaoId}" ${expanded ? '' : 'hidden'}>
          <p class="sub">Você pode se inscrever em até <b>${this.esc(proc.maxVagasAluno)}</b> vaga(s) deste processo · restam <b>${rest > 0 ? rest : 0}</b>.</p>
          ${this._cronogramaHtml(proc.cronograma)}
          <div class="tabs subtabs">${subtabs}</div>
          ${lista}
        </div></div>`;
    }).join('');
  },

  toggleProc(selId) {
    const cur = document.getElementById('pbody-' + selId);
    const chev = document.getElementById('pchev-' + selId);
    const open = cur ? cur.hidden : false;   // vai abrir se estava escondido
    this.procAberto[selId] = open;
    if (cur) cur.hidden = !open;
    if (chev) chev.textContent = open ? '▾' : '▸';
  },

  switchSeg(selId, seg) { this.segAtivo[selId] = seg; this.render(); },

  toggleVaga(selId, vagaId) {
    const body = document.getElementById('body-' + selId + '-' + vagaId);
    const chev = document.getElementById('chev-' + selId + '-' + vagaId);
    if (body) { body.hidden = !body.hidden; if (chev) chev.textContent = body.hidden ? '▸' : '▾'; }
  },

  renderMinhas() {
    if (!this.minhas.length) return '<div class="empty">Você ainda não se inscreveu em nenhuma vaga.</div>';
    return `<p class="sub" style="margin:0 0 10px">Todas as suas inscrições abaixo estão <b>válidas</b>. Para trocar de vaga, cancele uma e inscreva-se em outra.</p>
      <div class="card"><table class="table">
      <thead><tr><th>Vaga</th><th>Faixa</th><th>Data</th><th>Situação</th><th></th></tr></thead>
      <tbody>${this.minhas.map(i => `<tr>
        <td>${this.esc(i.titulo)}</td>
        <td>${i.faixaCH ? this.esc(i.faixaCH) + 'h' : '—'}</td>
        <td>${this.esc(this._br(i.data))}</td>
        <td><span class="tag tag-ok">✓ Válida</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="Portal.cancelar('${i.selecaoId}','${i.vagaId}')">Cancelar</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  // ── inscrição ─────────────────────────────────────────
  abrirInscricao(selId, vagaId) {
    const proc = this.vagas.find(p => String(p.selecaoId) === String(selId));
    const vaga = proc && proc.vagas.find(v => String(v.vagaId) === String(vagaId));
    if (!vaga) return;
    if (this._naSelecao(selId) >= proc.maxVagasAluno) { this.toast('Você atingiu o limite de vagas deste processo.', 'err'); return; }
    const faixas = vaga.faixas || [];
    const faixaField = faixas.length > 1
      ? `<div class="field"><label>Carga horária *</label><select class="input" id="i-faixa">${faixas.map(f => `<option value="${this.esc(f.ch)}">${this.esc(f.ch)}h/semana${vaga.tipo === 'Bolsista' && f.valor ? ' · ' + this._fmtMoney(f.valor) : ''}</option>`).join('')}</select></div>`
      : `<input type="hidden" id="i-faixa" value="${faixas[0] ? this.esc(faixas[0].ch) : ''}">`;
    const cursoField = (this.cursos && this.cursos.length)
      ? `<div class="field"><label>Curso *</label><select class="input" id="i-curso"><option value="">— selecione —</option>${this.cursos.map(c => `<option value="${this.esc(c.nome)}">${this.esc(c.nome)}</option>`).join('')}</select></div>`
      : `<div class="field"><label>Curso *</label><input class="input" id="i-curso" placeholder="seu curso"></div>`;
    const body = `
      <p class="kv"><b>${this.esc(vaga.titulo)}</b> · ${this.esc(vaga.tipo)}<br><span class="muted">${this.esc(vaga.acao || '')}</span></p>
      ${faixaField}
      <div class="field"><label>Nome completo *</label><input class="input" id="i-nome" value="${this.esc((this.user && this.user.nome) || '')}" placeholder="seu nome completo"></div>
      <div class="field"><label>Matrícula *</label><input class="input" id="i-mat" placeholder="sua matrícula"></div>
      ${cursoField}`;
    this.openModal('Confirmar inscrição', body, async () => {
      const faixaCH = (document.getElementById('i-faixa') || {}).value || '';
      const nome = (document.getElementById('i-nome') || {}).value.trim();
      const matricula = (document.getElementById('i-mat') || {}).value.trim();
      const curso = (document.getElementById('i-curso') || {}).value.trim();
      if (!nome) { this.toast('Informe seu nome completo.', 'err'); return; }
      if (!matricula) { this.toast('Informe sua matrícula.', 'err'); return; }
      if (!curso) { this.toast('Informe seu curso.', 'err'); return; }
      const ok = document.getElementById('modal-ok'); if (ok) { ok.disabled = true; ok.textContent = 'Enviando…'; }
      try {
        await this.gasCall('inscrever', { payload: { selecaoId: selId, vagaId: vagaId, faixaCH, nome, matricula, curso } });
        this.toast('Inscrição confirmada!', 'ok');
        this.closeModal();
        this.minhas = await this.gasCall('getMinhas') || [];
        this.render();
      } catch (e) { this.toast(e.message, 'err'); if (ok) { ok.disabled = false; ok.textContent = 'Confirmar'; } }
    });
  },

  cancelar(selId, vagaId) {
    if (!confirm('Cancelar esta inscrição?')) return;
    (async () => {
      try {
        await this.gasCall('cancelar', { payload: { selecaoId: selId, vagaId: vagaId } });
        this.toast('Inscrição cancelada.', 'ok');
        this.minhas = await this.gasCall('getMinhas') || [];
        this.render();
      } catch (e) { this.toast(e.message, 'err'); }
    })();
  },

  // ── modal ─────────────────────────────────────────────
  openModal(title, bodyHtml, onOk) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const ok = document.getElementById('modal-ok'); ok.disabled = false; ok.textContent = 'Confirmar';
    ok.onclick = onOk;
    document.getElementById('modal-overlay').hidden = false;
  },
  closeModal() { document.getElementById('modal-overlay').hidden = true; document.getElementById('modal-body').innerHTML = ''; }
};

window.addEventListener('DOMContentLoaded', () => Portal.initGIS());
