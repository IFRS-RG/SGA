// ============================================================
// SGA — Participante (Bolsista / Voluntário) Page Logic
// ============================================================

const Bolsista = (() => {

  let _session      = null;
  let _mesBolsistas = [];
  let _mesVols      = [];
  let _cursos       = [];
  let _profileComplete = false;
  let _editMode     = true;
  let _viewMasked   = true;

  const TIPOS_CONTA = ['Corrente','Poupança','Salário'];

  function init(session) {
    _session = session;
    setupTabs();
    loadPerfil();
  }

  // ── Tabs ─────────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        if (!_profileComplete && btn.dataset.tab !== 'perfil') {
          e.preventDefault();
          e.stopImmediatePropagation();
          toast('Complete seu perfil antes de acessar outras funcionalidades.', 'warning');
          return;
        }
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content[id^="tab-"]').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'assiduidade') loadTimeline();
      });
    });
  }

  function setTabsEnabled(enabled) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
      if (btn.dataset.tab !== 'perfil') {
        btn.style.opacity  = enabled ? '' : '.4';
        btn.style.cursor   = enabled ? '' : 'not-allowed';
        btn.title          = enabled ? '' : 'Complete seu perfil primeiro';
      }
    });
  }

  function isComplete(me, tipo) {
    if (!me) return false;
    const base = me.DataNascimento && me.CPF && me.Endereco && me.Telefone &&
                 me.EmailPessoal && me.Matricula && me.DataInicio;
    if (!base) return false;
    const cursoOk = !!(me.CursoID);
    if (tipo === 'bolsista') {
      return !!(base && cursoOk && me.Banco && me.Agencia && me.Conta && me.TipoConta);
    }
    return !!(base && cursoOk);
  }

  // ── Perfil ────────────────────────────────────────────────
  async function loadPerfil() {
    const container = document.getElementById('perfil-container');
    const user = _session?.userInfo || {};

    try {
      const [bolsistasAll, volsAll, cursosAll] = await Promise.all([
        API.getBolsistas(), API.getVoluntarios(), API.getCursos()
      ]);

      _mesBolsistas = (bolsistasAll || []).filter(b => b.Email === user.email && b.Status === 'Ativo');
      _mesVols      = (volsAll      || []).filter(v => v.Email === user.email && v.Status === 'Ativo');
      _cursos       = (cursosAll    || []).filter(c => c.Status === 'Ativo');

      const isBolsista   = _mesBolsistas.length > 0;
      const tipo         = isBolsista ? 'bolsista' : 'voluntario';
      const firstRec     = _mesBolsistas[0] || _mesVols[0] || {};

      _profileComplete = isComplete(firstRec, tipo);
      _editMode        = !_profileComplete;
      setTabsEnabled(_profileComplete);

      renderPerfilForm(user, firstRec, tipo);
    } catch (e) {
      container.innerHTML = `<div class="empty-state text-danger">Erro ao carregar perfil: ${esc(e.message)}</div>`;
    }
  }

  function renderPerfilForm(user, me, tipo) {
    const container  = document.getElementById('perfil-container');
    const role       = _session?.roleInfo || {};
    const isBolsista = tipo === 'bolsista';

    const hasBolsista   = _mesBolsistas.length > 0;
    const hasVoluntario = _mesVols.length > 0;
    const roleLabel = hasBolsista && hasVoluntario ? 'Bolsista · Voluntário'
      : hasBolsista ? 'Bolsista' : 'Voluntário';

    const photoHtml = user.picture ? `<img src="${esc(user.picture)}" class="profile-avatar" alt="Foto">` : '';

    const participacoes = [
      ..._mesBolsistas.map(b => `
        <div class="participant-row">
          <span class="badge badge-blue participant-badge">bolsista</span>
          <span class="participant-name">${esc(b.acaoTitulo || b.AcaoID)}</span>
          ${b.CargaHoraria ? `<span class="text-muted text-small"> · ${esc(b.CargaHoraria)}h/mês</span>` : ''}
        </div>`),
      ..._mesVols.map(v => `
        <div class="participant-row">
          <span class="badge badge-gray participant-badge">voluntário</span>
          <span class="participant-name">${esc(v.acaoTitulo || v.AcaoID)}</span>
        </div>`)
    ].join('') || '<div class="text-muted text-small">Nenhuma participação ativa.</div>';

    const headerHtml = `
      <div style="text-align:center;margin-bottom:1.25rem">
        ${photoHtml}
        <div class="profile-name">${esc(role.nome || user.name || user.email)}</div>
        <div class="profile-email">${esc(user.email)}</div>
        <div class="profile-role">${roleLabel}</div>
      </div>
      <div style="margin-bottom:1.25rem">
        <div class="section-subtitle">Minhas participações</div>
        ${participacoes}
      </div>`;

    if (_editMode) {
      container.innerHTML = _renderEditMode(user, me, tipo, isBolsista, headerHtml);
      setTimeout(() => {
        bindMask(document.getElementById('p-cpf'), maskCPF);
        bindMask(document.getElementById('p-tel'), maskTelefone);
      }, 0);
    } else {
      container.innerHTML = _renderViewMode(user, me, isBolsista, headerHtml);
    }
  }

  function _renderViewMode(user, me, isBolsista, headerHtml) {
    const maskIcon  = _viewMasked ? '👁' : '🙈';
    const maskTitle = _viewMasked ? 'Exibir dados sensíveis' : 'Ocultar dados sensíveis';
    const cpf     = _viewMasked ? (me.CPF     ? '***.***.***-**'    : '—') : (me.CPF     || '—');
    const tel     = _viewMasked ? (me.Telefone? '(**) * ****-****'  : '—') : (me.Telefone|| '—');
    const agencia = _viewMasked ? (me.Agencia ? '****'              : '—') : (me.Agencia || '—');
    const conta   = _viewMasked ? (me.Conta   ? '****-*'            : '—') : (me.Conta   || '—');

    const curso = _cursos.find(c => c.ID === me.CursoID);
    const cursoLabel = me.Curso || (curso ? `${curso.Nome} — ${curso.Modalidade}` : me.CursoID || '—');

    function row(label, val) {
      return `<div class="profile-data-row"><span class="text-muted text-small">${label}</span><span>${esc(String(val || '—'))}</span></div>`;
    }

    const bancario = (isBolsista || me.Banco) ? `
      <div class="form-section-title" style="margin-top:1.25rem">
        Dados Bancários${!isBolsista ? ' <span class="text-muted text-small">(opcional)</span>' : ''}
      </div>
      ${row('Banco', me.Banco)}
      ${row('Tipo de Conta', me.TipoConta)}
      ${row('Agência', agencia)}
      ${row('Conta', conta)}` : '';

    return `
      <div class="profile-card" style="max-width:560px;text-align:left">
        <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem;gap:.5rem">
          <button type="button" class="btn btn-ghost btn-sm" title="${maskTitle}" onclick="Bolsista.toggleMaskPerfil()">${maskIcon}</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Bolsista.editPerfil()">Editar dados complementares</button>
        </div>
        ${headerHtml}

        <div class="form-section-title">Dados Pessoais</div>
        ${row('Data de Nascimento', me.DataNascimento)}
        ${row('CPF', cpf)}
        ${row('Endereço', me.Endereco)}
        ${row('Telefone', tel)}
        ${row('E-mail Pessoal', me.EmailPessoal)}
        ${row('E-mail Institucional', user.email)}

        ${bancario}

        <div class="form-section-title" style="margin-top:1.25rem">Dados Acadêmicos</div>
        ${row('Curso / Modalidade', cursoLabel)}
        ${row('Matrícula', me.Matricula)}
        ${row('Ano/Semestre de Ingresso', me.AnoSemestreIngresso)}
        ${row('Semestre/Ano Atual', me.SemestreAtual)}

        <div class="form-section-title" style="margin-top:1.25rem">Dados da Atividade</div>
        ${row('Início das Atividades', me.DataInicio)}

        ${_buildDocumentos()}
      </div>`;
  }

  function _renderEditMode(user, me, tipo, isBolsista, headerHtml) {
    const cursoId   = me.CursoID || '';
    const cursoOpts = _cursos.map(c => {
      const sel = c.ID === cursoId;
      return `<option value="${esc(c.ID)}" ${sel ? 'selected' : ''}>${esc(c.Nome)} — ${esc(c.Modalidade)}</option>`;
    }).join('');

    const tipoContaOpts = TIPOS_CONTA.map(t =>
      `<option ${me.TipoConta === t ? 'selected' : ''}>${t}</option>`
    ).join('');

    const incompleteMsg = !_profileComplete
      ? `<div class="period-alert closed" style="margin-bottom:1rem;text-align:left">
           ⚠ <strong>Perfil incompleto.</strong> Preencha todos os campos obrigatórios para acessar as demais funcionalidades do sistema.
         </div>`
      : '';

    const cancelBtn = _profileComplete
      ? `<button type="button" class="btn btn-ghost" style="margin-left:.5rem" onclick="Bolsista.cancelEditPerfil()">Cancelar</button>`
      : '';

    return `
      <div class="profile-card" style="max-width:560px;text-align:left">
        ${headerHtml}
        ${incompleteMsg}

        <form id="perfil-form">
          <div class="form-section-title">Dados Pessoais</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">*Data de Nascimento</label>
              <input class="form-control" id="p-nascimento" type="date" value="${esc(me.DataNascimento||'')}">
            </div>
            <div class="form-group">
              <label class="form-label">*CPF</label>
              <input class="form-control" id="p-cpf" value="${esc(me.CPF||'')}" placeholder="000.000.000-00" maxlength="14">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">*Endereço Completo</label>
            <input class="form-control" id="p-endereco" value="${esc(me.Endereco||'')}" placeholder="Rua, número, bairro, cidade – UF, CEP">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">*Telefone</label>
              <input class="form-control" id="p-tel" value="${esc(me.Telefone||'')}" placeholder="(53) 9 9999-9999" maxlength="16">
            </div>
            <div class="form-group">
              <label class="form-label">*E-mail Pessoal</label>
              <input class="form-control" id="p-email-pessoal" type="email" value="${esc(me.EmailPessoal||'')}" placeholder="seuemail@gmail.com">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">E-mail Institucional</label>
            <input class="form-control" value="${esc(user.email)}" disabled style="opacity:.6">
          </div>

          <div class="form-section-title" style="margin-top:1.25rem">
            Dados Bancários${!isBolsista ? ' <span class="text-muted text-small">(opcional para voluntários)</span>' : ''}
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${isBolsista?'*':''}Nome do Banco</label>
              <input class="form-control" id="p-banco" value="${esc(me.Banco||'')}" placeholder="Ex: Banco do Brasil">
            </div>
            <div class="form-group">
              <label class="form-label">${isBolsista?'*':''}Tipo de Conta</label>
              <select class="form-select" id="p-tipo-conta">
                <option value="">Selecione...</option>${tipoContaOpts}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${isBolsista?'*':''}Agência</label>
              <input class="form-control" id="p-agencia" value="${esc(me.Agencia||'')}" placeholder="0000-0">
            </div>
            <div class="form-group">
              <label class="form-label">${isBolsista?'*':''}Conta</label>
              <input class="form-control" id="p-conta" value="${esc(me.Conta||'')}" placeholder="00000-0">
            </div>
          </div>

          <div class="form-section-title" style="margin-top:1.25rem">Dados Acadêmicos</div>
          <div class="form-group">
            <label class="form-label">*Curso / Modalidade</label>
            <select class="form-select" id="p-curso">
              <option value="">Selecione...</option>${cursoOpts}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">*Número de Matrícula</label>
              <input class="form-control" id="p-matricula" value="${esc(me.Matricula||'')}" placeholder="Ex: 2023001234">
            </div>
            <div class="form-group">
              <label class="form-label">*Ano/Semestre de Ingresso</label>
              <input class="form-control" id="p-ingresso" value="${esc(me.AnoSemestreIngresso||'')}" placeholder="Ex: 2023/1">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">*Semestre/Ano Atual no Curso</label>
            <input class="form-control" id="p-semestre-atual" value="${esc(me.SemestreAtual||'')}" placeholder="Ex: 4º semestre / 2026">
          </div>

          <div class="form-section-title" style="margin-top:1.25rem">Dados da Atividade</div>
          <div class="form-group">
            <label class="form-label">*Data de Início das Atividades</label>
            <input class="form-control" id="p-inicio" type="date" value="${esc(me.DataInicio||'')}">
          </div>

          <div style="margin-top:1.5rem">
            <button type="button" class="btn btn-primary" onclick="Bolsista.savePerfil()">Salvar dados complementares</button>
            ${cancelBtn}
          </div>
        </form>

        ${_buildDocumentos()}
      </div>`;
  }

  function _buildDocumentos() {
    return `
      <div style="margin-top:2rem">
        <div class="form-section-title">Documentos (PDF)</div>
        <div class="text-muted text-small" style="margin-bottom:.75rem">Tamanho máximo por arquivo: 8 MB</div>
        ${_buildUploadRow('doc-cpf',       'Cópia do CPF',                   'CPF.pdf')}
        ${_buildUploadRow('doc-matricula', 'Comprovante de Matrícula',        'Comprovante_Matricula.pdf')}
        ${_buildUploadRow('doc-residencia','Comprovante de Residência',        'Comprovante_Residencia.pdf')}
        ${_buildUploadRow('doc-auxilio',   'Comprovante de Beneficiário de Auxílio (se aplicável)', 'Comprovante_Auxilio.pdf', true)}
      </div>`;
  }

  function editPerfil() {
    _editMode = true;
    const user = _session?.userInfo || {};
    const isBolsista = _mesBolsistas.length > 0;
    const tipo = isBolsista ? 'bolsista' : 'voluntario';
    renderPerfilForm(user, _mesBolsistas[0] || _mesVols[0] || {}, tipo);
  }

  function cancelEditPerfil() {
    if (!_profileComplete) return;
    _editMode = false;
    const user = _session?.userInfo || {};
    const isBolsista = _mesBolsistas.length > 0;
    const tipo = isBolsista ? 'bolsista' : 'voluntario';
    renderPerfilForm(user, _mesBolsistas[0] || _mesVols[0] || {}, tipo);
  }

  function toggleMaskPerfil() {
    _viewMasked = !_viewMasked;
    const user = _session?.userInfo || {};
    const isBolsista = _mesBolsistas.length > 0;
    const tipo = isBolsista ? 'bolsista' : 'voluntario';
    renderPerfilForm(user, _mesBolsistas[0] || _mesVols[0] || {}, tipo);
  }

  function _buildUploadRow(inputId, label, fileName, optional = false) {
    return `
      <div class="upload-row" style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap">
        <span style="min-width:280px;font-size:.875rem">${label}${optional ? ' <span class="text-muted text-small">(opcional)</span>' : ''}</span>
        <input type="file" id="${inputId}" accept="application/pdf" style="display:none"
          onchange="Bolsista.uploadDoc('${inputId}','${fileName}')">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('${inputId}').click()">
          Selecionar PDF
        </button>
        <span id="${inputId}-status" class="text-muted text-small"></span>
      </div>`;
  }

  async function savePerfil() {
    const user = _session?.userInfo || {};
    const isBolsista = _mesBolsistas.length > 0;

    const cpf          = document.getElementById('p-cpf')?.value?.trim() || '';
    const tel          = document.getElementById('p-tel')?.value?.trim() || '';
    const nascimento   = document.getElementById('p-nascimento')?.value || '';
    const endereco     = document.getElementById('p-endereco')?.value?.trim() || '';
    const emailPessoal = document.getElementById('p-email-pessoal')?.value?.trim() || '';
    const cursoId      = document.getElementById('p-curso')?.value || '';
    const matricula    = document.getElementById('p-matricula')?.value?.trim() || '';
    const ingresso     = document.getElementById('p-ingresso')?.value?.trim() || '';
    const semestreAtual= document.getElementById('p-semestre-atual')?.value?.trim() || '';
    const dataInicio   = document.getElementById('p-inicio')?.value || '';
    const banco        = document.getElementById('p-banco')?.value?.trim() || '';
    const agencia      = document.getElementById('p-agencia')?.value?.trim() || '';
    const conta        = document.getElementById('p-conta')?.value?.trim() || '';
    const tipoConta    = document.getElementById('p-tipo-conta')?.value || '';

    if (!nascimento) { toast('Informe a data de nascimento.', 'warning'); return; }
    if (!cpf)        { toast('Informe o CPF.', 'warning'); return; }
    if (!validateCPF(cpf)) { toast('CPF inválido.', 'error'); document.getElementById('p-cpf')?.classList.add('error'); return; }
    document.getElementById('p-cpf')?.classList.remove('error');
    if (!tel)        { toast('Informe o Telefone.', 'warning'); return; }
    if (!validateTelefone(tel)) { toast('Telefone inválido.', 'error'); document.getElementById('p-tel')?.classList.add('error'); return; }
    document.getElementById('p-tel')?.classList.remove('error');
    if (!endereco)     { toast('Informe o Endereço.', 'warning'); return; }
    if (!emailPessoal) { toast('Informe o E-mail Pessoal.', 'warning'); return; }
    if (!cursoId)      { toast('Selecione o Curso.', 'warning'); return; }
    if (!matricula)    { toast('Informe a Matrícula.', 'warning'); return; }
    if (!ingresso)     { toast('Informe o Ano/Semestre de Ingresso.', 'warning'); return; }
    if (!semestreAtual){ toast('Informe o Semestre/Ano Atual.', 'warning'); return; }
    if (!dataInicio)   { toast('Informe a Data de Início das Atividades.', 'warning'); return; }
    if (isBolsista && (!banco || !agencia || !conta || !tipoConta)) {
      toast('Preencha todos os Dados Bancários (obrigatório para bolsistas).', 'warning'); return;
    }

    const curso = _cursos.find(c => c.ID === cursoId);
    const cursoLabel = curso ? `${curso.Nome} — ${curso.Modalidade}` : '';

    const payload = {
      cpf, telefone: tel, dataNascimento: nascimento, endereco, emailPessoal,
      cursoId, curso: cursoLabel, matricula,
      anoSemestreIngresso: ingresso, semestreAtual, dataInicio,
      banco, agencia, conta, tipoConta
    };

    try {
      const calls = [];
      if (_mesBolsistas.length) calls.push(API.updatePerfilBolsista(payload));
      if (_mesVols.length)      calls.push(API.updatePerfilVoluntario(payload));
      await Promise.all(calls);
      toast('Dados salvos com sucesso.', 'success');
      await loadPerfil();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function uploadDoc(inputId, fileName) {
    const input = document.getElementById(inputId);
    const statusEl = document.getElementById(`${inputId}-status`);
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast('Arquivo muito grande. Máximo: 8 MB.', 'error');
      input.value = '';
      return;
    }
    statusEl.textContent = 'Enviando...';
    const isBolsista = _mesBolsistas.length > 0;
    const sheetName  = isBolsista ? 'Bolsistas' : 'Voluntarios';
    try {
      const base64 = await _fileToBase64(file);
      await API.uploadDocumento({ base64, fileName, mimeType: 'application/pdf', sheetName });
      statusEl.textContent = '✓ Enviado';
      statusEl.style.color = 'var(--success)';
      toast(`${fileName} enviado com sucesso.`, 'success');
    } catch (e) {
      statusEl.textContent = '✗ Erro';
      statusEl.style.color = 'var(--danger)';
      toast('Erro ao enviar arquivo: ' + e.message, 'error');
      input.value = '';
    }
  }

  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      if (!minhas.length) { showEmpty('timeline-list', 'Nenhum registro de assiduidade encontrado.'); return; }

      el.innerHTML = `<div class="timeline">` + minhas.map(a => {
        const snap = a.snapshot || (a.Snapshot ? (typeof a.Snapshot === 'string' ? JSON.parse(a.Snapshot) : a.Snapshot) : {});
        const meuDado = snap.participantes?.find(p => p.email === email);
        if (!meuDado) return '';
        const validado  = isTrue(a.Validado);
        const foraPrazo = isTrue(a.ForaPrazo);
        const badgeFora = foraPrazo ? `<span class="badge-fora-prazo">⚠ Enviado fora do prazo · ${isoToBR(a.Timestamp)}</span>` : '';
        const obsHtml   = meuDado.observacao ? `<div class="text-muted text-small mt-1"><strong>Observação:</strong> ${esc(meuDado.observacao)}</div>` : '';
        return `<div class="timeline-item ${validado ? 'validated' : 'pending'}">
          <div style="flex:1">
            <div class="flex align-center justify-between" style="flex-wrap:wrap;gap:.5rem">
              <div>
                <strong>${a.MesAno ? mesAnoLabel(a.MesAno) : ''}</strong>
                <span class="text-muted text-small"> — ${esc(a.acaoTitulo || snap.acaoTitulo || a.AcaoID)}</span>
                <span class="badge ${meuDado.tipo === 'bolsista' ? 'badge-blue' : 'badge-gray'}" style="margin-left:.35rem">${meuDado.tipo}</span>
              </div>
              <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                ${badgeFora}
                <span class="badge ${meuDado.cumpriu ? 'badge-green' : 'badge-red'}">${meuDado.cumpriu ? '✓ Cumpriu' : '✗ Não cumpriu'}</span>
                <span class="badge ${validado ? 'badge-green' : 'badge-yellow'}">${validado ? '✓ Validado' : 'Aguardando validação'}</span>
              </div>
            </div>
            ${obsHtml}
            <div class="timeline-meta">Registrado pelo coordenador em ${isoToBR(a.Timestamp)}</div>
          </div>
        </div>`;
      }).filter(Boolean).join('') + `</div>`;
    } catch (e) {
      showEmpty('timeline-list', 'Erro ao carregar: ' + e.message);
    }
  }

  // ── Public ────────────────────────────────────────────────
  return { init, savePerfil, uploadDoc, editPerfil, cancelEditPerfil, toggleMaskPerfil };

})();
