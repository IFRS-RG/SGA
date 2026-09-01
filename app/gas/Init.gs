// ============================================================
// SGA — Inicialização da planilha
// Rode initSheets() UMA vez após colar o SPREADSHEET_ID em Config.gs.
// Cria as abas (Editais, EditalDocumentos, Perfis) com cabeçalhos.
// É seguro rodar de novo: só cria o que estiver faltando.
// ============================================================

function initSheets() {
  const book = ss();

  Object.keys(HEADERS).forEach(name => {
    let sh = book.getSheetByName(name);
    if (!sh) sh = book.insertSheet(name);
    const headers = HEADERS[name];

    if (sh.getLastRow() === 0) {
      // Aba nova/vazia: cria o cabeçalho.
      sh.appendRow(headers);
    } else if (sh.getLastRow() === 1) {
      // Só tem cabeçalho (sem dados): sincroniza colunas com o schema atual (seguro).
      const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join('|');
      if (cur !== headers.join('|')) {
        sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).clearContent();
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    } else {
      // Já há dados: ADITIVO SEGURO — se o cabeçalho atual for um prefixo do schema
      // e houver colunas novas ao final, acrescenta-as sem tocar nos dados existentes.
      const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      const isPrefix = cur.length <= headers.length && cur.every((h, i) => h === headers[i]);
      if (isPrefix && headers.length > cur.length) {
        const extra = headers.slice(cur.length);
        sh.getRange(1, cur.length + 1, 1, extra.length).setValues([extra]);
      }
    }
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
  });

  // Remove a aba padrão "Página1"/"Sheet1" se estiver vazia.
  ['Página1', 'Sheet1', 'Planilha1'].forEach(n => {
    const s = book.getSheetByName(n);
    if (s && s.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(s);
  });

  Logger.log('initSheets: abas criadas/verificadas com sucesso.');
  return 'OK — abas prontas.';
}

// Diagnóstico: confirma se o serviço avançado "Drive" está ativo e autorizado.
// Rode uma vez no editor. Esperado no log: "Drive OK — ...".
function testeDrive() {
  var res = Drive.Files.list({ q: 'trashed=false', maxResults: 1 });
  var msg = 'Drive OK — serviço avançado ativo (itens de amostra: ' + ((res.items || []).length) + ').';
  Logger.log(msg);
  return msg;
}
