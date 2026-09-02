# Arquitetura da base financeira

## Fontes

O Pluggy será tratado como uma fonte, não como a aplicação inteira. As telas relevantes são:

- **Overview**: resumo de contas, cartões, investimentos e evolução do saldo.
- **Fluxo**: despesas, receitas e movimentações das contas.
- **Ativos**: carteira de investimentos e seus itens.
- **Conexões**: apenas monitoramento técnico; não entra na base financeira principal.

## Padrão observado

As telas têm um padrão comum: cada registro pertence a uma fonte (`pluggy`), tem uma data de coleta, uma categoria/tipo, uma instituição, uma descrição e valores numéricos. Isso permite comparar Pluggy com Forms e notificações Android sem misturar a origem.

Modelo recomendado:

```text
id_origem | fonte | tipo | data_evento | data_coleta | instituicao | descricao | valor | status | dados_json
```

Exemplos de `tipo`: `saldo_conta`, `cartao`, `transacao`, `investimento`, `resumo`.

## Fluxo da aplicação

```text
Pluggy ─┐
Forms ──┼→ dados_brutos → normalização/validação → visão financeira
Android ┘                  └→ divergências e conferência manual
```

No Sheets, use abas separadas para `pluggy_bruto`, `forms_bruto`, `android_bruto`, `base_normalizada` e `conferencias`. O campo `fonte` permite escolher qual origem exibir e comparar valores equivalentes.

## Regra para Conexões

Não importar os detalhes da tela `/connections` para a base de lançamentos. No máximo, registrar em `status_coletas` a data da última verificação e se as conexões estavam ativas, para detectar falhas de atualização.

## Limitação atual

A primeira versão salva os textos localmente em JSON. Ela ainda não envia para Sheets e ainda precisa evoluir de texto bruto para registros estruturados, especialmente as transações do Fluxo e os 62 ativos.
