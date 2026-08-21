# SGA — Sistema de Gestão de Ações (projeto novo)

Reescrita do zero. Só o módulo **Editais** + **Admin (perfis de acesso)** por enquanto.

- **Frontend:** HTML + JS puro (`app/`) → GitHub Pages
- **Backend:** Google Apps Script Web App (`app/gas/`)
- **Banco:** Google Sheets (abas: Editais, EditalDocumentos, Perfis)
- **Auth:** Google OAuth (Google Identity Services)
- **PDFs:** Google Drive (pasta "SGA — Editais" ou a que você configurar)

## Estrutura

```
app/
├── index.html          Login (OAuth)
├── main.html           Shell: sidebar + conteúdo
├── css/style.css
├── js/
│   ├── config.js       ← preencher GAS_URL e GOOGLE_CLIENT_ID
│   ├── auth.js         sessão / Google Sign-In
│   ├── api.js          cliente do Web App
│   ├── ui.js           modal, toast, helpers
│   ├── app.js          shell: menu lateral + roteamento
│   ├── editais.js      módulo Editais
│   └── admin.js        módulo Admin (perfis de acesso)
└── gas/
    ├── Config.gs       ← preencher SPREADSHEET_ID; SUPER_ADMIN = projetos@…
    ├── Auth.gs         verificação de token + perfis
    ├── Editais.gs      CRUD + clonar + upload PDF
    ├── Admin.gs        perfis de acesso
    ├── Router.gs       doPost (dispatcher)
    ├── Init.gs         initSheets() — cria as abas
    └── appsscript.json
```

## Passos de setup (feitos por você — eu não tenho acesso)

1. **Planilha nova:** crie uma planilha no Google Sheets com a conta `projetos@riogrande.ifrs.edu.br`. Copie o ID da URL.
2. **Projeto Apps Script novo:** em https://script.google.com crie um projeto. Cole os 6 arquivos `.gs` e o `appsscript.json` (Configurações → mostrar `appsscript.json`).
3. **Config.gs:** cole o ID da planilha em `SPREADSHEET_ID`. (Opcional) crie uma pasta no Drive p/ os PDFs e cole o ID em `DRIVE_ROOT_ID`.
4. **initSheets():** rode a função `initSheets()` uma vez (autorize as permissões). Isso cria as abas.
5. **Deploy:** Implantar → Nova implantação → tipo *App da Web* → executar como *você* → acesso *Qualquer pessoa*. Copie a URL `/exec`.
6. **OAuth Client ID:** no Google Cloud Console (mesmo projeto do Apps Script) → Credenciais → criar *ID do cliente OAuth* (Aplicativo da Web). Em *Origens JavaScript autorizadas* adicione a URL do GitHub Pages (ex.: `https://ifrs-rg.github.io`). Copie o Client ID.
7. **config.js:** cole `GAS_URL` (passo 5) e `GOOGLE_CLIENT_ID` (passo 6).
8. **Publicar frontend:** suba `app/` no GitHub Pages (ou aponte o Pages para essa pasta).

O super admin (`projetos@riogrande.ifrs.edu.br`) já entra como **Admin** sem precisar de cadastro. Ele libera os demais em **Admin → Perfis de acesso**.

## Perfis de acesso

- **Admin** — acesso geral, todos os segmentos, gerencia perfis.
- **Gestor de Segmento** — a diretoria/setor; cria e gerencia editais (e, futuramente, ações) do seu segmento (Ensino/Pesquisa/Extensão/Indissociável).
- **Visualizador** — somente leitura (de um segmento ou todos).

Editais são criados/editados por **Admin** e **Gestor**. Cada perfil (exceto Admin) carrega um **Segmento**.
