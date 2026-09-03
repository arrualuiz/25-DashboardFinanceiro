# Primeira versão — monitor do Pluggy

## Instalação

Abra o PowerShell nesta pasta e execute:

```powershell
npm install
```

## Primeira execução

```powershell
npm run coletar
```

Uma janela do Chrome será aberta. Faça login manualmente no Pluggy. A sessão fica salva em `perfil-chrome`, sem armazenar sua senha no código. Pressione Enter no PowerShell após concluir o login.

As coletas aparecem em `saida/` como JSON histórico e screenshot. O nome segue o padrão `registro-HHmmDDMMAAAA.json`; na coleta completa, `registro-completo-HHmmDDMMAAAA.json`.

## Observações

- Feche outras janelas usando o mesmo perfil que possam causar conflito durante a execução.
- Esta versão coleta Overview, Fluxo (`Todos`, `Entradas` e `Saídas`) e Ativos (`Classes` e `Instituições`). Conexões não entra nos dados financeiros: apenas o número de conexões ativas e um eventual aviso técnico são registrados.
- Os dados ainda são brutos, preservando duplicidades e a ordem em que aparecem na tela. A navegação histórica por mês e o importador do Google Sheets serão as próximas etapas.
- O próximo passo é um Apps Script ler `ultimo.json` a partir do Drive e normalizar os registros em `dados_brutos`.
- Para a coleta expandida, use `node coletar-completo.mjs`. Ela preserva os dados brutos de Overview, Fluxo com os três filtros e Ativos nas visões Classes/Instituições. A navegação de meses históricos será adicionada depois de validarmos esses controles.
- O arquivo `sheets/Code.gs` contém um endpoint opcional. Após publicar o Apps Script como Web App, configure `SHEETS_WEBHOOK_URL` no terminal antes de executar para enviar o JSON à aba `pluggy_bruto`.
