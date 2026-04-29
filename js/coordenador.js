// ============================================================
// SGA — Coordenador Page Logic
// ============================================================

const Coord = (() => {

  let _session     = null;
  let _acoes       = [];
  let _bolsistas   = [];
  let _voluntarios = [];
  let _enviados    = [];
  let _periodo     = null;
  let _meCoord     = null;
  let _perfilMasked = true;

  function init(session) {
    _session = session;
    setupTabs();
    buildMesSelect();
    loadPerfil();
    loadAssiduidade();
  }

  // ── Tabs ─────────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content[id^="tab-"]').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'historico') loadHistorico();
      });
    });
  }

  // ── Mês select ───────────────────────────────────────────
  function buildMesSelect() {
    const sel  = document.getElementById('ass-mes-ref');
    const opts = buildMesAnoOptions({ year: 2026, month: 1 }, { year: 2028, month: 3 });
    const now  = new Date();
    const prev = now.getMonth() === 0
      ? { year: now.getFullYear() - 1, month: 12 }
      : { year: now.getFullYear(), month: now.getMonth() };
    const prevVal = `${prev.year}-${String(prev.month).padStart(2,'0')}`;
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      if (o.value === prevVal) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Perfil ────────────────────────────────────────────────
  async function loadPerfil() {
    const container = document.getElementById('perfil-container');
    const user = _session?.userInfo || {};
    const role = _session?.roleInfo || {};
    try {
      const coords = await API.getCoordenadores();
      _meCoord = coords.find(c => c.Email === user.email) || null;
      const isFirstAccess = !_meCoord?.CPF;
      renderPerfil(user, role, isFirstAccess ? 'edit' : 'view');
    } catch (e) {
      container.innerHTML = `<div class="empty-state text-danger">Erro ao carregar perfil: ${esc(e.message)}</div>`;
    }
  }

  function renderPerfil(user, role, mode) {
    const container = document.getElementById('perfil-container');
    const me = _meCoord || {};
    const u  = user  || _session?.userInfo || {};
    const r  = role  || _session?.roleInfo || {};

    const cpfVal = me.CPF      || '';
    const telVal = me.Telefone || '';
    const masked = _perfilMasked;

    const photoHtml = u.picture ? `<img src="${esc(u.picture)}" class="profile-avatar" alt="Foto">` : '';

    if (mode === 'view') {
      const cpfShow = masked && cpfVal ? '***.***.***-**'       : esc(cpfVal || '—');
      const telShow = masked && telVal ? '(**) * ****-****'     : esc(telVal || '—');
      container.innerHTML = `
        <div class="profile-card">
          ${photoHtml}
          <div class="profile-name">${esc(r.nome || u.name || u.email)}</div>
          <div class="profile-email">${esc(u.email)}</div>
          <div class="profile-role">Coordenador</div>
          <div style="margin:1.25rem 0;text-align:left;width:100%;max-width:380px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
              <span style="font-size:.8rem;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.05em">Dados complementares</span>
              <button class="btn btn-ghost btn-xs" title="${masked?'Exibir':'Ocultar'} dados sensíveis" onclick="Coord.toggleMaskPerfil()">
                ${masked ? '👁' : '🙈'}
              </button>
            </div>
            <div class="profile-data-row"><span class="text-muted text-small">CPF</span><span style="color:var(--gray-400);font-variant-numeric:tabular-nums">${cpfShow}</span></div>
            <div class="profile-data-row" style="margin-top:.4rem"><span class="text-muted text-small">Telefone</span><span style="color:var(--gray-400)">${telShow}</span></div>
          </div>
          <button class="btn btn-outline btn-sm" style="margin-top:.5rem" onclick="Coord.editPerfil()">Editar dados complementares</button>
        </div>`;
    } else {
      const isFirst = !cpfVal;
      container.innerHTML = `
        <div class="profile-card">
          ${photoHtml}
          <div class="profile-name">${esc(r.nome || u.name || u.email)}</div>
          <div class="profile-email">${esc(u.email)}</div>
          <div class="profile-role">Coordenador</div>
          ${isFirst ? '<div class="text-muted text-small mb-2" style="color:var(--warning)">⚠ Preencha seus dados complementares para continuar usando o sistema.</div>' : ''}
          <form id="perfil-form" style="width:100%;max-width:380px;margin-top:1rem;text-align:left">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">*CPF</label>
                <input class="form-control" id="p-cpf" value="${esc(cpfVal)}" placeholder="000.000.000-00" maxlength="14">
              </div>
              <div class="form-group">
                <label class="form-label">*Telefone</label>
                <input class="form-control" id="p-tel" value="${esc(telVal)}" placeholder="(53) 9 9999-9999" maxlength="16">
              </div>
            </div>
            <div style="display:flex;gap:.5rem;margin-top:.5rem">
              <button type="button" class="btn btn-primary" onclick="Coord.savePerfil()">Salvar</button>
              ${!isFirst ? `<button type="button" class="btn btn-ghost" onclick="Coord.cancelEditPerfil()">Cancelar</button>` : ''}
            </div>
          </form>
        </div>`;
      // Apply masks after render
      setTimeout(() => {
        bindMask(document.getElementById('p-cpf'), maskCPF);
        bindMask(document.getElementById('p-tel'), maskTelefone);
      }, 0);
    }
  }

  function editPerfil() {
    renderPerfil(null, null, 'edit');
  }

  function cancelEditPerfil() {
    renderPerfil(null, null, 'view');
  }

  function toggleMaskPerfil() {
    _perfilMasked = !_perfilMasked;
    renderPerfil(null, null, 'view');
  }

  async function savePerfil() {
    const cpfEl = document.getElementById('p-cpf');
    const telEl = document.getElementById('p-tel');
    const cpf = cpfEl?.value?.trim() || '';
    const tel = telEl?.value?.trim() || '';

    if (!cpf) { cpfEl?.classList.add('error'); toast('Informe o CPF.', 'warning'); return; }
    if (!validateCPF(cpf)) { cpfEl?.classList.add('error'); toast('CPF inválido.', 'error'); return; }
    cpfEl?.classList.remove('error');

    if (!tel) { telEl?.classList.add('error'); toast('Informe o Telefone.', 'warning'); return; }
    if (!validateTelefone(tel)) { telEl?.classList.add('error'); toast('Telefone inválido (mínimo 10 dígitos).', 'error'); return; }
    telEl?.classList.remove('error');

    try {
      await API.updatePerfilCoordenador({ cpf, telefone: tel });
      toast('Dados salvos com sucesso.', 'success');
      // Refresh from server
      const coords = await API.getCoordenadores();
      _meCoord = coords.find(c => c.Email === (_session?.userInfo?.email)) || null;
      _perfilMasked = true;
      renderPerfil(null, null, 'view');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── Assiduidade ───────────────────────────────────────────
  async function loadAssiduidade() {
    const mesAno = document.getElementById('ass-mes-ref')?.value;
    showLoading('ass-acoes-list', 'Carregando ações...');
    try {
      const [acoes, bolsistas, voluntarios, assiduidades, periodo] = await Promise.all([
        API.getAcoes(), API.getBolsistas(), API.getVoluntarios(),
        API.getAssiduidades({}), API.getPeriodo()
      ]);
      _acoes       = (acoes || []).filter(a => a.Status === 'Ativo' && a.CoordenadorEmail === _session?.roleInfo?.email);
      _bolsistas   = bolsistas   || [];
      _voluntarios = voluntarios || [];
      _enviados    = (assiduidades || []).filter(a => a.CoordenadorEmail === _session?.roleInfo?.email);
      _periodo     = periodo;
      renderPeriodBanner(periodo);
      renderAcoes(mesAno);
    } catch (e) {
      showEmpty('ass-acoes-list', 'Erro ao carregar: ' + e.message);
    }
  }

  function renderPeriodBanner(periodo) {
    const el = document.getElementById('period-banner');
    if (!el || !periodo) return;
    el.className = `period-alert ${periodo.aberto ? 'open' : 'closed'} mb-2`;
    el.textContent = periodo.aberto
      ? `✓ Período de respostas aberto: ${periodo.inicio} a ${periodo.fim}`
      : `⚠ Fora do período de respostas (${periodo.inicio} a ${periodo.fim}). O envio ainda é permitido, mas será marcado como fora do prazo.`;
  }

  function renderAcoes(mesAno) {
    const el = document.getElementById('ass-acoes-list');
    if (!_acoes.length) { showEmpty('ass-acoes-list', 'Nenhuma ação ativa vinculada a você.'); return; }
    const bySegmento = {};
    _acoes.forEach(a => {
      if (!bySegmento[a.Segmento]) bySegmento[a.Segmento] = [];
      bySegmento[a.Segmento].push(a);
    });
    el.innerHTML = Object.keys(bySegmento).sort().map(seg => `
      <div class="segmento-group">
        <div class="segmento-header">${esc(seg)}</div>
        ${bySegmento[seg].map(a => renderAcaoForm(a, mesAno)).join('')}
      </div>`).join('');
  }

  function renderAcaoForm(acao, mesAno) {
    const jaEnviado = _enviados.find(e => e.MesAno === mesAno && e.AcaoID === acao.ID);
    const snap = jaEnviado?.snapshot || (jaEnviado?.Snapshot ? JSON.parse(jaEnviado.Snapshot) : null);
    const foraPrazo = jaEnviado && isTrue(jaEnviado.ForaPrazo);

    const bolsistas   = _bolsistas.filter(b  => b.AcaoID === acao.ID && b.Status === 'Ativo');
    const voluntarios = _voluntarios.filter(v => v.AcaoID === acao.ID && v.Status === 'Ativo');
    const participantes = [
      ...bolsistas.map(b => ({ ...b, tipo: 'bolsista' })),
      ...voluntarios.map(v => ({ ...v, tipo: 'voluntario' }))
    ].sort((a, b) => (a.Nome || '').localeCompare(b.Nome || ''));

    if (!participantes.length) {
      return `<div class="card mb-1">
        <div class="card-header" style="cursor:default">
          <div class="card-header-left"><span class="dot dot-gray"></span>
            <div><div class="card-title">${esc(acao.Titulo)}</div><div class="card-sub">Nenhum participante ativo.</div></div>
          </div></div></div>`;
    }

    const badgeFora = foraPrazo ? `<span class="badge-fora-prazo">⚠ Enviado fora do prazo · ${isoToBR(jaEnviado.Timestamp)}</span>` : '';
    const mesLabel  = mesAnoLabel(mesAno);

    // ── Read-only view (already sent) ──
    if (jaEnviado && snap) {
      const validado = isTrue(jaEnviado.Validado);
      return `<div class="card mb-1">
        <div class="card-header expanded" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('expanded')">
          <div class="card-header-left">
            <span class="dot ${validado ? 'dot-green' : 'dot-blue'}"></span>
            <div><div class="card-title">${esc(acao.Titulo)}</div>
              <div class="card-sub">Enviado em ${isoToBR(jaEnviado.Timestamp)}</div>
            </div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            ${badgeFora}
            <span class="badge badge-green">✓ Enviado</span>
            <span class="badge ${validado ? 'badge-green' : 'badge-yellow'}">${validado ? '✓ Validado' : 'Aguardando validação'}</span>
          </div>
        </div>
        <div class="card-body open">
          ${snap.participantes.map(p => `
            <div class="participant-row">
              <span class="dot ${p.cumpriu ? 'dot-green' : 'dot-red'}"></span>
              <span class="participant-name">${esc(p.nome)}</span>
              <span class="badge ${p.tipo === 'bolsista' ? 'badge-blue' : 'badge-gray'} participant-badge">${p.tipo}</span>
              <span class="badge ${p.cumpriu ? 'badge-green' : 'badge-red'}">${p.cumpriu ? 'Sim' : 'Não'}</span>
              ${p.observacao ? `<span class="text-muted text-small">${esc(p.observacao)}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
    }

    // ── Form for input ──
    const rows = participantes.map(p => {
      const tipoArtigo = p.tipo === 'bolsista' ? 'O bolsista' : 'O voluntário';
      return `
        <div style="border-bottom:1px solid var(--gray-100);padding:.75rem 0" id="pr-wrap-${acao.ID}-${p.ID}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
            <div>
              <span class="participant-name fw-bold">${esc(p.Nome)}</span>
              <span class="badge ${p.tipo === 'bolsista' ? 'badge-blue' : 'badge-gray'} participant-badge">${p.tipo}</span>
            </div>
            <div>
              <div class="text-muted text-small" style="margin-bottom:.4rem">
                ${tipoArtigo} cumpriu as atividades no mês de <strong>${mesLabel}</strong>?
              </div>
              <div class="radio-group">
                <label><input type="radio" name="ass-${acao.ID}-${p.ID}" value="sim" onchange="Coord.toggleObs('${acao.ID}','${p.ID}',true)" checked> Sim</label>
                <label><input type="radio" name="ass-${acao.ID}-${p.ID}" value="nao" onchange="Coord.toggleObs('${acao.ID}','${p.ID}',false)"> Não</label>
              </div>
            </div>
          </div>
          <div style="margin-top:.5rem">
            <textarea class="form-control" id="obstext-${acao.ID}-${p.ID}" rows="2"
              placeholder="Observação (opcional)..." style="font-size:.85rem"></textarea>
            <div class="text-muted text-small" style="margin-top:.2rem;font-style:italic">
              ⚠ As observações ficam visíveis para o respectivo bolsista/voluntário.
            </div>
          </div>
        </div>`;
    }).join('');

    return `<div class="card mb-1">
      <div class="card-header expanded" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('expanded')">
        <div class="card-header-left">
          <span class="dot dot-yellow"></span>
          <div><div class="card-title">${esc(acao.Titulo)}</div>
            <div class="card-sub">${participantes.length} participante(s) · ${esc(mesLabel)}</div>
          </div>
        </div>
        <span class="badge badge-yellow">Pendente</span>
      </div>
      <div class="card-body open">
        ${rows}
        <div style="margin-top:1rem;display:flex;justify-content:flex-end">
          <button class="btn btn-primary" onclick="Coord.enviar('${acao.ID}','${mesAno}')">Enviar assiduidade</button>
        </div>
      </div>
    </div>`;
  }

  function toggleObs(acaoId, particId, cumpriu) {
    const obsEl = document.getElementById(`obstext-${acaoId}-${particId}`);
    if (!obsEl) return;
    obsEl.placeholder = cumpriu ? 'Observação (opcional)...' : 'Observação (obrigatória quando Não)...';
    if (cumpriu) obsEl.classList.remove('error');
  }

  async function enviar(acaoId, mesAno) {
    const acao = _acoes.find(a => a.ID === acaoId);
    if (!acao) return;

    const bolsistas   = _bolsistas.filter(b   => b.AcaoID === acaoId && b.Status === 'Ativo');
    const voluntarios = _voluntarios.filter(v  => v.AcaoID === acaoId && v.Status === 'Ativo');
    const participantes = [
      ...bolsistas.map(b => ({ ...b, tipo: 'bolsista' })),
      ...voluntarios.map(v => ({ ...v, tipo: 'voluntario' }))
    ];

    const payload = { acaoId, mesAno, participantes: [] };
    let valid = true;

    participantes.forEach(p => {
      const radio   = document.querySelector(`input[name="ass-${acaoId}-${p.ID}"]:checked`);
      const cumpriu = !radio || radio.value === 'sim';
      const obsEl   = document.getElementById(`obstext-${acaoId}-${p.ID}`);
      const obs     = obsEl ? obsEl.value.trim() : '';

      if (!cumpriu && !obs) {
        obsEl?.classList.add('error');
        obsEl?.focus();
        toast('Preencha a observação para quem não cumpriu as atividades.', 'warning');
        valid = false;
        return;
      }
      if (obsEl) obsEl.classList.remove('error');
      payload.participantes.push({ id: p.ID, nome: p.Nome, email: p.Email, tipo: p.tipo, cumpriu, observacao: obs });
    });

    if (!valid) return;

    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
      const r = await API.enviarAssiduidade(payload);
      toast(r.foraPrazo ? '⚠ Assiduidade enviada fora do prazo. Um e-mail foi enviado.' : 'Assiduidade registrada com sucesso!', r.foraPrazo ? 'warning' : 'success');
      await loadAssiduidade();
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.textContent = 'Enviar assiduidade';
    }
  }

  // ── Histórico ─────────────────────────────────────────────
  async function loadHistorico() {
    showLoading('historico-list', 'Carregando histórico...');
    try {
      const ass  = await API.getAssiduidades({});
      const meus = (ass || []).filter(a => a.CoordenadorEmail === _session?.roleInfo?.email)
        .sort((a, b) => (a.MesAno || '').localeCompare(b.MesAno || ''));

      if (!meus.length) { showEmpty('historico-list', 'Nenhum envio registrado.'); return; }

      const el = document.getElementById('historico-list');
      el.innerHTML = meus.map(a => {
        const snap = a.snapshot || (a.Snapshot ? JSON.parse(a.Snapshot) : {});
        const validado  = isTrue(a.Validado);
        const foraPrazo = isTrue(a.ForaPrazo);
        const badgeFora = foraPrazo ? `<span class="badge-fora-prazo">⚠ Enviado fora do prazo · ${isoToBR(a.Timestamp)}</span>` : '';

        const participList = snap.participantes ? snap.participantes.map(p => `
          <div class="participant-row">
            <span class="dot ${p.cumpriu ? 'dot-green' : 'dot-red'}"></span>
            <span class="participant-name">${esc(p.nome)}</span>
            <span class="badge ${p.tipo === 'bolsista' ? 'badge-blue' : 'badge-gray'} participant-badge">${p.tipo}</span>
            <span class="badge ${p.cumpriu ? 'badge-green' : 'badge-red'}">${p.cumpriu ? 'Sim' : 'Não'}</span>
            ${p.observacao ? `<span class="text-muted text-small">${esc(p.observacao)}</span>` : ''}
          </div>`).join('') : '';

        return `<div class="card mb-1">
          <div class="card-header" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('expanded')">
            <div class="card-header-left">
              <span class="dot ${validado ? 'dot-green' : 'dot-blue'}"></span>
              <div>
                <div class="card-title">${esc(a.acaoTitulo || a.AcaoID)}</div>
                <div class="card-sub">${a.MesAno ? mesAnoLabel(a.MesAno) : ''} · Enviado em ${isoToBR(a.Timestamp)}</div>
              </div>
            </div>
            <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
              ${badgeFora}
              <span class="badge badge-green">✓ Enviado</span>
              <span class="badge ${validado ? 'badge-green' : 'badge-yellow'}">${validado ? '✓ Validado' : 'Aguardando validação'}</span>
            </div>
          </div>
          <div class="card-body">${participList}</div>
        </div>`;
      }).join('');
    } catch (e) {
      showEmpty('historico-list', 'Erro ao carregar histórico: ' + e.message);
    }
  }

  // ── Public ────────────────────────────────────────────────
  return { init, savePerfil, editPerfil, cancelEditPerfil, toggleMaskPerfil, loadAssiduidade, toggleObs, enviar };

})();
