/**
 * Endpoint para receber uma coleta bruta do Pluggy.
 * Depois de colar no Apps Script: Implantar > Nova implantação > App da Web.
 */
const ABA = 'pluggy_bruto';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA)
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet(ABA);
  const row = [new Date(), payload.collectedAt || '', payload.source || 'pluggy', JSON.stringify(payload)];
  if (sheet.getLastRow() === 0) sheet.appendRow(['recebido_em', 'coletado_em', 'fonte', 'payload_json']);
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
