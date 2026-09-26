// Musi być identyczna wartość początkowa jak w index.html (PIN_STORAGE_KEY
// dostaje ją tylko przy pierwszym uruchomieniu) — po pierwszej zmianie przez
// "Zmień PIN" prawdziwy PIN żyje wyłącznie w PropertiesService.
const PIN_INITIAL = '1000499156';
const PIN_RESET_EMAIL = 'heatcoolfulawkawro@gmail.com';
// Zwracany zamiast danych z fetch(GET), gdy PIN się nie zgadza — pusty
// string ('') już oznacza "brak takiego klucza", więc potrzebny jest
// osobny, jednoznaczny sygnał, którego żadna prawdziwa wartość nigdy
// nie przyjmie.
const AUTH_FAIL_TEXT = '__BRAK_AUTORYZACJI__';

// ---------- Sync PIN-u z siostrzanymi appkami (ten sam PF/admin) ----------
// Żeby dołożyć kolejną appkę do tej samej "rodziny" jednego kodu:
//   1) w NOWEJ appce wklej dokładnie ten sam blok kodu (SIBLING_URLS,
//      bootstrapSyncSecret, syncPinPush, pushPinToSiblings) i dopisz wywołanie
//      pushPinToSiblings(newPin) na końcu jej confirmPinReset — patrz niżej.
//   2) do SIBLING_URLS TEJ appki i wszystkich pozostałych już istniejących
//      dopisz URL nowej appki (i dopisz URL-e istniejących do listy nowej).
//   3) zbootstrapuj w nowej appce TEN SAM sekret co reszta rodziny (jednym
//      POST-em z action:'bootstrap_sync_secret' — działa tylko raz, dopóki
//      SYNC_SECRET jest puste).
const SIBLING_URLS = [
  'https://script.google.com/macros/s/AKfycbwp2qGgpobvHRCOurqA614AxnIA5ozdLlv_EsIr1Ve8t3vNp3Qur8ZfashMQpSZFuM/exec' // Paliwo PF
];

function bootstrapSyncSecret(secret) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SYNC_SECRET')) return jsonOut({ ok: false, error: 'Sekret już ustawiony' });
  if (!secret || String(secret).length < 20) return jsonOut({ ok: false, error: 'Za krótki sekret' });
  props.setProperty('SYNC_SECRET', String(secret));
  return jsonOut({ ok: true });
}

// Odbiór PIN-u z siostrzanej appki — NIE rozsyła dalej (jeden przeskok,
// żeby appki nie wołały się w kółko).
function syncPinPush(secret, newPin) {
  const real = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  if (!real || String(secret) !== real) return jsonOut({ ok: false, error: 'Brak autoryzacji' });
  if (!/^\d{4,12}$/.test(String(newPin))) return jsonOut({ ok: false, error: 'Zły format PIN' });
  PropertiesService.getScriptProperties().setProperty('APP_PIN', String(newPin));
  return jsonOut({ ok: true });
}

// Wywoływane PO stronie appki, w której PIN faktycznie się zmienił —
// rozsyła nowy PIN do sióstr. Najlepszego wysiłku: appka, która akurat nie
// odpowie, dogoni przy najbliższym auth-fail (pokaże błąd, pójdzie reset mailem).
function pushPinToSiblings(newPin) {
  const secret = PropertiesService.getScriptProperties().getProperty('SYNC_SECRET');
  if (!secret) return;
  SIBLING_URLS.forEach(function (url) {
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'text/plain',
        payload: JSON.stringify({ action: 'sync_pin_push', secret: secret, newPin: newPin }),
        muteHttpExceptions: true
      });
    } catch (e) { /* best-effort — patrz komentarz wyżej */ }
  });
}

function currentPin() {
  return PropertiesService.getScriptProperties().getProperty('APP_PIN') || PIN_INITIAL;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (String(e.parameter.pin) !== currentPin()) {
    return ContentService.createTextOutput(AUTH_FAIL_TEXT).setMimeType(ContentService.MimeType.JSON);
  }
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

  if (body.action === 'request_pin_reset') return requestPinReset();
  if (body.action === 'confirm_pin_reset') return confirmPinReset(body.code, body.newPin);
  if (body.action === 'sync_pin_push') return syncPinPush(body.secret, body.newPin);
  if (body.action === 'bootstrap_sync_secret') return bootstrapSyncSecret(body.secret);

  if (String(body.pin) !== currentPin()) {
    return jsonOut({ ok: false, error: 'Brak autoryzacji' });
  }

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

  ids.rano = syncOneReminder(cal, ids.rano, cfg.rano, 'Waga – pomiar poranny (na czczo)',
    'Zważ się i wpisz wynik w aplikacji Waga PF.');
  ids.wieczor = syncOneReminder(cal, ids.wieczor, cfg.wieczor, 'Waga – pomiar wieczorny',
    'Zważ się i wpisz wynik w aplikacji Waga PF.');
  ids.trening = syncOneReminder(cal, ids.trening, cfg.trening, 'Trening – czas na sesję',
    'Zrób trening i wpisz wynik w aplikacji Waga PF.');

  setStoredValue('calendar_ids', JSON.stringify(ids));
}

// ---------- PIN: zmiana / przypomnienie przez kod z maila ----------
// Bez tokenu — to jedyna para akcji dostępna komuś, kto NIE zna aktualnego
// PIN-u (inaczej "zapomniałem PIN-u" nie dałoby się obsłużyć). Limit czasowy
// między żądaniami to jedyna ochrona przed zasypaniem skrzynki e-mail.
function requestPinReset() {
  const props = PropertiesService.getScriptProperties();
  const lastReq = Number(props.getProperty('PIN_RESET_LAST_REQ') || 0);
  if (Date.now() - lastReq < 2 * 60 * 1000) {
    return jsonOut({ ok: false, error: 'Poczekaj chwilę i spróbuj ponownie.' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  props.setProperty('PIN_RESET_CODE', code);
  props.setProperty('PIN_RESET_EXPIRES', String(Date.now() + 10 * 60 * 1000));
  props.setProperty('PIN_RESET_LAST_REQ', String(Date.now()));
  MailApp.sendEmail(PIN_RESET_EMAIL, 'Kod do zmiany PIN — Waga PF', 'Twój kod do zmiany PIN: ' + code + '\n\nWażny 10 minut. Jeśli to nie Ty, zignoruj tę wiadomość.');
  return jsonOut({ ok: true });
}

function confirmPinReset(code, newPin) {
  const props = PropertiesService.getScriptProperties();
  const storedCode = props.getProperty('PIN_RESET_CODE');
  const expires = Number(props.getProperty('PIN_RESET_EXPIRES') || 0);
  if (!storedCode || String(code) !== storedCode) return jsonOut({ ok: false, error: 'Nieprawidłowy kod' });
  if (Date.now() > expires) return jsonOut({ ok: false, error: 'Kod wygasł — poproś o nowy' });
  if (!/^\d{4,12}$/.test(String(newPin))) return jsonOut({ ok: false, error: 'PIN musi mieć od 4 do 12 cyfr' });
  props.setProperty('APP_PIN', String(newPin));
  props.deleteProperty('PIN_RESET_CODE');
  props.deleteProperty('PIN_RESET_EXPIRES');
  pushPinToSiblings(String(newPin));
  return jsonOut({ ok: true });
}

function syncOneReminder(cal, existingId, cfg, title, description) {
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
    description: description
  });
  series.addPopupReminder(0);
  return series.getId();
}
