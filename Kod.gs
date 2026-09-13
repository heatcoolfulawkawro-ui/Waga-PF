function doGet(e) {
  const key = e.parameter.key;
  const sheet = getDataSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      return ContentService.createTextOutput(rows[i][1])
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const key = body.key;
  const value = body.value;
  setStoredValue(key, value);

  if (key === 'reminders') {
    try {
      syncReminders(JSON.parse(value));
    } catch (err) {
      getDataSheet().appendRow(['reminders_error', String(err)]);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Data');
  if (!sheet) {
    sheet = ss.insertSheet('Data');
    sheet.appendRow(['key', 'value']);
  }
  return sheet;
}

function getStoredValue(key) {
  const sheet = getDataSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) return rows[i][1];
  }
  return null;
}

function setStoredValue(key, value) {
  const sheet = getDataSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ---------- KALENDARZ ----------

function syncReminders(cfg) {
  const cal = CalendarApp.getDefaultCalendar();
  const idsRaw = getStoredValue('calendar_ids');
  const ids = idsRaw ? JSON.parse(idsRaw) : {};

  ids.rano = syncOneReminder(cal, ids.rano, cfg.rano, 'Waga – pomiar poranny (na czczo)');
  ids.wieczor = syncOneReminder(cal, ids.wieczor, cfg.wieczor, 'Waga – pomiar wieczorny');

  setStoredValue('calendar_ids', JSON.stringify(ids));
}

function syncOneReminder(cal, existingId, cfg, title) {
  if (existingId) {
    try {
      const series = cal.getEventSeriesById(existingId);
      if (series) series.deleteEventSeries();
    } catch (err) {
      // seria mogla juz nie istniec w kalendarzu - ignoruj
    }
  }

  if (!cfg || !cfg.enabled || !cfg.time) return null;

  const parts = cfg.time.split(':');
  const start = new Date();
  start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  if (start.getTime() < Date.now()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 5 * 60000);

  const recurrence = CalendarApp.newRecurrence().addDailyRule();
  const series = cal.createEventSeries(title, start, end, recurrence, {
    description: 'Zważ się i wpisz wynik w aplikacji Waga PF.'
  });
  series.addPopupReminder(0);
  return series.getId();
}
