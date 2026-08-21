// ============================================================
// SGA — Roteador (Web App)
// Ponto de entrada. Todas as chamadas do frontend passam por doPost.
// ============================================================

function doGet() {
  return respond({ ok: true, service: 'SGA API', time: isoNow() });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Autenticação: valida o id_token do Google.
    let userEmail = null;
    if (data.token) {
      const v = verifyGoogleToken(data.token);
      if (!v.valid) return respond({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
      userEmail = v.email;
    }

    switch (action) {
      // ── Sessão ──
      case 'getRole':
        return respond(getRole(userEmail));

      // ── Editais ──
      case 'getEditais':
        return respond(getEditais());
      case 'addEdital':
        return respond(addEdital(data.payload, userEmail));
      case 'updateEdital':
        return respond(updateEdital(data.id, data.payload, userEmail));
      case 'deleteEdital':
        return respond(deleteEdital(data.id, userEmail));
      case 'cloneEdital':
        return respond(cloneEdital(data.id, userEmail));

      // ── Documentos de edital ──
      case 'getEditalDocs':
        return respond(getEditalDocs(data.editalId));
      case 'uploadEditalDoc':
        return respond(uploadEditalDoc(data.payload, userEmail));
      case 'deleteEditalDoc':
        return respond(deleteEditalDoc(data.docId, userEmail));

      // ── Admin: perfis de acesso ──
      case 'getPerfis':
        return respond(getPerfis(userEmail));
      case 'addPerfil':
        return respond(addPerfil(data.payload, userEmail));
      case 'updatePerfil':
        return respond(updatePerfil(data.email, data.payload, userEmail));
      case 'deletePerfil':
        return respond(deletePerfil(data.email, userEmail));

      default:
        return respond({ error: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    return respond({ error: err.message || String(err) });
  }
}
