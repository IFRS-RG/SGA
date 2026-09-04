// ============================================================
// Portal do Aluno — Regras (lê Selecao/Vagas, grava Inscricoes)
// ============================================================

// Vagas dos processos PUBLICADOS e Abertos.
function getVagas() {
  const sels = _objs('Selecao').filter(s => String(s.Status) === 'Aberta');
  const vagas = _objs('Vagas');
  return sels.map(s => {
    const vs = vagas.filter(v => String(v.SelecaoID) === String(s.SelecaoID)).map(v => {
      let faixas = [], req = {}, crit = [];
      try { faixas = JSON.parse(v.FaixasJSON || '[]'); } catch (e) {}
      try { req = JSON.parse(v.RequisitosJSON || '{}'); } catch (e) {}
      try { crit = JSON.parse(v.CriteriosJSON || '[]'); } catch (e) {}
      return {
        vagaId: v.VagaID, titulo: v.Titulo, tipo: v.Tipo, acao: v.Acao, edital: v.Edital,
        faixas: faixas, requisitos: req, criterios: crit
      };
    });
    return { selecaoId: s.SelecaoID, nome: s.Nome, maxVagasAluno: Number(s.MaxVagasAluno) || 1, vagas: vs };
  });
}

// Inscrições do aluno logado.
function getMinhas(email) {
  const vagas = _objs('Vagas');
  const titulo = {}; vagas.forEach(v => { titulo[String(v.VagaID)] = v.Titulo; });
  return _objs('Inscricoes')
    .filter(i => String(i.EmailAluno).toLowerCase() === String(email).toLowerCase())
    .map(i => ({
      selecaoId: i.SelecaoID, vagaId: i.VagaID, titulo: titulo[String(i.VagaID)] || i.VagaID,
      faixaCH: i.FaixaCH, data: i.DataInscricao
    }));
}

function inscrever(email, nome, p) {
  p = p || {};
  const selId = String(p.selecaoId || '');
  const vagaId = String(p.vagaId || '');
  const faixa = String(p.faixaCH || '');
  const mat = String(p.matricula || '').trim();
  const curso = String(p.curso || '').trim();
  if (!mat) throw _uErr('Informe sua matrícula.');
  if (!curso) throw _uErr('Informe seu curso.');

  const sel = _objs('Selecao').find(s => String(s.SelecaoID) === selId && String(s.Status) === 'Aberta');
  if (!sel) throw _uErr('Este processo não está disponível.');
  const vaga = _objs('Vagas').find(v => String(v.SelecaoID) === selId && String(v.VagaID) === vagaId);
  if (!vaga) throw _uErr('Vaga indisponível.');

  let faixas = []; try { faixas = JSON.parse(vaga.FaixasJSON || '[]'); } catch (e) {}
  if (faixas.length && faixas.map(f => String(f.ch)).indexOf(faixa) === -1) throw _uErr('Faixa de CH inválida.');

  const minhas = _objs('Inscricoes').filter(i => String(i.EmailAluno).toLowerCase() === email.toLowerCase());
  if (minhas.some(i => String(i.VagaID) === vagaId)) throw _uErr('Você já está inscrito nesta vaga.');
  const naSel = minhas.filter(i => String(i.SelecaoID) === selId).length;
  const max = Number(sel.MaxVagasAluno) || 1;
  if (naSel >= max) throw _uErr('Limite de ' + max + ' vaga(s) por aluno neste processo.');

  _sheet('Inscricoes').appendRow([selId, vagaId, faixa, nome, mat, curso, email, email, _now()]);
  return { ok: true };
}

function cancelar(email, p) {
  p = p || {};
  const selId = String(p.selecaoId || '');
  const vagaId = String(p.vagaId || '');
  const sh = _sheet('Inscricoes');
  const data = sh.getDataRange().getValues();
  // EmailAluno = coluna 8 (índice 7); SelecaoID = 0; VagaID = 1.
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][7]).toLowerCase() === email.toLowerCase()
      && String(data[i][0]) === selId && String(data[i][1]) === vagaId) {
      sh.deleteRow(i + 1);
    }
  }
  return { ok: true };
}
