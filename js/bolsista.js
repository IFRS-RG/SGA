// ============================================================
// SGA — Bolsista / Voluntário Page Logic
// ============================================================

const Bolsista = (() => {

  let _session = null;

  function init(session) {
    _session = session;
    setupTabs();
    loadPerfil();
    loadTimeline();
  }

  // ── Tabs ─────────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content[id^="tab-"]').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'assiduidade') loadTimeline();
      });
    });
  }

  // ── Perfil ────────────────────────────────────────────────
  async function loadPerfil() {
    const container = document.getElementById('perfil-container');
    const user = _session?.userInfo || {};
    const role = _session?.roleInfo || {};
    const isBolsista = role.tipo === 'bolsista';

    try {
      let me = null;
      let acaoTitulo = '';

      if (isBolsista) {
        const bolsistas = await API.getBolsistas();
        me = bolsistas.find(b => b.Email === user.email);
        acaoTitulo = me?.acaoTitulo || me?.AcaoID || '';
      } else {
        const vols = await API.getVoluntarios();
        me = vols.find(v => v.Email === user.email);
        acaoTitulo = me?.acaoTitulo || me?.AcaoID || '';
      }

      const cursoLabel = me?.cursoLabel || me?.Curso || '';

      container.innerHTML = `
        <div class="profile-card">
          ${user.picture ? `<img src="${esc(user.picture)}" class="profile-avatar" alt="Foto">` : ''}
          <div class="profile-name">${esc(role.nome || user.name || user.email)}</div>
          <div class="profile-email">${esc(user.email)}</div>
          <div class="profile-role">${isBolsista ? 'Bolsista' : 'Voluntário'}</div>
          ${acaoTitulo ? `<p class="text-muted mb-2"><strong>Ação:</strong> ${esc(acaoTitulo)}</p>` : ''}

          <form id="perfil-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CPF</label>
                <input class="form-control" id="p-cpf" value="${esc(me?.CPF || '')}" placeholder="000.000.000-00">
              </div>
              <div class="form-group">
                <label class="form-label">Telefone</label>
                <input class="form-control" id="p-tel" value="${esc(me?.Telefone || '')}" placeholder="(53) 9 9999-9999">
              </div>
            </div>
            ${isBolsista ? `
            <div class="form-group">
              <label class="form-label">Curso / Modalidade</label>
              <input class="form-control" id="p-curso" value="${esc(cursoLabel)}" placeholder="Ex: Engenharia de Computação — Superior">
            </div>` : ''}
            <button type="button" class="btn btn-primary" onclick="Bolsista.savePerfil()">Salvar dados complementares</button>
          </form>
        </div>`;
    } catch (e) {
      container.innerHTML = `<div class="empty-state text-danger">Erro ao carregar perfil: ${esc(e.message)}</div>`;
    }
  }

  async function savePerfil() {
    const cpf   = document.getElementById('p-cpf')?.value?.trim();
    const tel   = document.getElementById('p-tel')?.value?.trim();
    const curso = document.getElementById('p-curso')?.value?.trim();
    const tipo  = _session?.roleInfo?.tipo;

    try {
      if (tipo === 'bolsista') {
        await API.updatePerfilBolsista({ cpf, telefone: tel, curso });
      } else {
        await API.updatePerfilVoluntario({ cpf, telefone: tel });
      }
      toast('Dados salvos com sucesso.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── Timeline ──────────────────────────────────────────────
  async function loadTimeline() {
    showLoading('timeline-list', 'Carregando assiduidade...');
    const email = _session?.userInfo?.email;

    try {
      const ass = await API.getAssiduidades({});
      const minhas = (ass || []).filter(a => {
        const snap = a.snapshot || (a.Snapshot ? (typeof a.Snapshot === 'string' ? JSON.parse(a.Snapshot) : a.Snapshot) : null);
        return snap && snap.participantes && snap.participantes.some(p => p.email === email);
      }).sort((a, b) => (a.MesAno || '').localeCompare(b.MesAno || ''));

      const el = document.getElementById('timeline-list');

      if (!minhas.length) {
        showEmpty('timeline-list', 'Nenhum registro de assiduidade encontrado.');
        return;
      }

      el.innerHTML = `<div class="timeline">` + minhas.map(a => {
        const snap = a.snapshot || (a.Snapshot ? (typeof a.Snapshot === 'string' ? JSON.parse(a.Snapshot) : a.Snapshot) : {});
        const meuDado = snap.participantes?.find(p => p.email === email);
        const validado  = isTrue(a.Validado);
        const foraPrazo = isTrue(a.ForaPrazo);

        if (!meuDado) return '';

        const badgeFora = foraPrazo
          ? `<span class="badge-fora-prazo">⚠ Enviado fora do prazo · ${isoToBR(a.Timestamp)}</span>`
          : '';

        const obsHtml = meuDado.observacao
          ? `<div class="text-muted text-small mt-1"><strong>Observação:</strong> ${esc(meuDado.observacao)}</div>`
          : '';

        return `<div class="timeline-item ${validado ? 'validated' : 'pending'}">
          <div style="flex:1">
            <div class="flex align-center justify-between" style="flex-wrap:wrap;gap:.5rem">
              <div>
                <strong>${a.MesAno ? mesAnoLabel(a.MesAno) : ''}</strong>
                <span class="text-muted text-small"> — ${esc(a.acaoTitulo || snap.acaoTitulo || a.AcaoID)}</span>
              </div>
              <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                ${badgeFora}
                <span class="badge ${meuDado.cumpriu ? 'badge-green' : 'badge-red'}">
                  ${meuDado.cumpriu ? '✓ Cumpriu' : '✗ Não cumpriu'}
                </span>
                <span class="badge ${validado ? 'badge-green' : 'badge-yellow'}">
                  ${validado ? '✓ Validado' : 'Aguardando validação'}
                </span>
              </div>
            </div>
            ${obsHtml}
            <div class="timeline-meta">
              Registrado pelo coordenador em ${isoToBR(a.Timestamp)}
            </div>
          </div>
        </div>`;
      }).filter(Boolean).join('') + `</div>`;
    } catch (e) {
      showEmpty('timeline-list', 'Erro ao carregar: ' + e.message);
    }
  }

  // ── Public ────────────────────────────────────────────────
  return { init, savePerfil };

})();
