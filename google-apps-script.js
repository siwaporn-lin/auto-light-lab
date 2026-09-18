/**
 * Google Apps Script — วางโค้ดนี้ใน Apps Script แล้ว Deploy เป็น Web App
 *
 * ขั้นตอน:
 * 1. เปิด Google Sheet ที่ต้องการเก็บข้อมูล
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเดิม แล้ววางโค้ดนี้ทั้งหมด
 * 4. กด Deploy > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy URL ที่ได้ ไปใส่ในหน้าตั้งค่าของเว็บ Auto Light Lab
 *
 * Sheet จะสร้างคอลัมน์หัวข้ออัตโนมัติเมื่อรับข้อมูลครั้งแรก
 */

const SHEET_NAME = 'ผลการเรียนรู้';
const HEADERS = ['ID', 'ผู้เรียน', 'ภารกิจ', 'คะแนน', 'เวลา(วินาที)', 'จำนวนผิด', 'คำใบ้', 'วันที่'];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const action = e.parameter.action || '';

  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: 'connected' });
  }

  if (action === 'getResults') {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return jsonResponse({ status: 'ok', data: [] });
    }
    const results = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      results.push({
        id: String(row[0] || ''),
        player: String(row[1] || ''),
        level: Number(row[2]) || 0,
        score: Number(row[3]) || 0,
        seconds: Number(row[4]) || 0,
        wrong: Number(row[5]) || 0,
        hints: Number(row[6]) || 0,
        date: String(row[7] || ''),
      });
    }
    return jsonResponse({ status: 'ok', data: results });
  }

  return jsonResponse({ status: 'error', message: 'unknown action' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';

    if (action === 'addResult') {
      const d = body.data;
      if (!d || !d.id || !d.player) {
        return jsonResponse({ status: 'error', message: 'missing data' });
      }
      const sheet = getOrCreateSheet();

      // Check for duplicate by ID
      const existing = sheet.getDataRange().getValues();
      for (let i = 1; i < existing.length; i++) {
        if (String(existing[i][0]) === String(d.id)) {
          return jsonResponse({ status: 'ok', message: 'duplicate, skipped' });
        }
      }

      sheet.appendRow([
        d.id,
        d.player,
        d.level || 0,
        d.score || 0,
        d.seconds || 0,
        d.wrong || 0,
        d.hints || 0,
        d.date || new Date().toISOString(),
      ]);

      return jsonResponse({ status: 'ok', message: 'saved' });
    }

    return jsonResponse({ status: 'error', message: 'unknown action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
