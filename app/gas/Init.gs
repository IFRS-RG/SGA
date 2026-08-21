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
    }
    // (Se já houver dados, não mexe no cabeçalho para não desalinhar colunas.)
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
