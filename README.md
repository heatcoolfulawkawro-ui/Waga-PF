# Waga PF

Aplikacja webowa do dziennika pomiarów masy ciała. Wzorzec architektury:
jeden plik HTML (frontend) + Google Apps Script (backend, magazyn klucz-wartość
w Arkuszu Google) + GitHub Pages (hosting). Ten sam wzorzec co poprzednie
mini-aplikacje (np. karta godzin HVAC).

Wdrożona i działająca pod: **https://heatcoolfulawkawro-ui.github.io/Waga-PF/**

## Pliki w repo
- `index.html` — cały frontend (HTML+CSS+JS w jednym pliku, mobile-first, dark theme)
- `Kod.gs` — kod backendu Google Apps Script (nazwa pliku musi się zgadzać z
  nazwą pliku po stronie script.google.com — tam projekt nazywa się `Kod`)
- `appsscript.json` — manifest projektu Apps Script (pobrany przez `clasp pull`,
  nie edytować ręcznie bez potrzeby — pole `webapp.access` kontroluje kto może
  używać wdrożonej appki)
- `.clasp.json`, `.claspignore`, `.github/workflows/deploy-gas.yml` — auto-deploy
  backendu: `git push` na `main` z zmianą w `Kod.gs` sam aktualizuje działający
  Web App przez GitHub Actions + `clasp` (bez ręcznego kopiowania do edytora
  script.google.com). Wymaga sekretów repo `CLASP_CREDENTIALS` i
  `GAS_DEPLOYMENT_ID`.

## Podłączenie frontendu do backendu
W pliku `index.html`:
```js
const GAS_URL = 'https://script.google.com/macros/s/.../exec';
```
Już ustawione na deployment `@1` istniejącego projektu Apps Script.

## Test end-to-end
1. Otwórz link w przeglądarce.
2. W Ustawieniach (ikona trybika) kliknij "Test połączenia z Arkuszem" —
   powinien zwrócić status 200.
3. Aplikacja przy pierwszym uruchomieniu automatycznie zaimportuje 27
   startowych pomiarów (zaszyte w kodzie) do localStorage i do Arkusza
   (zakładka "Data", klucz `state`).
4. Sprawdź w Arkuszu, czy dane faktycznie się zapisały.
5. Na telefonie: otwórz link w Safari → "Dodaj do ekranu początkowego".

## Kluczowe decyzje funkcjonalne (już ustalone z użytkownikiem)
- Waga startowa: 96.50 kg (11.05.2026), cel: 86.0 kg, wzrost: 186 cm.
- Klasyfikacja pory pomiaru: do 15:00 → R (rano, na czczo), po 15:00 → W
  (wieczór). Edytowalne ręcznie przy dodawaniu/edycji wpisu.
- Trzy zakładki przesuwane poziomo: Dashboard / Historia / Nowy pomiar.
- Dashboard: start / ostatni pomiar / zmiana od startu, BMI aktualne vs
  docelowe z % postępu, dwukolorowy pasek postępu (zielony = wykonane %,
  czerwony = pozostało %), wykres wagi z przełącznikiem dzień/tydzień/
  miesiąc, linia celu 86 kg, punkty na wykresie, ostatni punkt podświetlony.
- Historia: pełna tabela (Data, Pora, Waga, Δ do poprz., Δ od startu) z
  ikonami edycji i usuwania każdego wpisu.
- Nowy pomiar: pole wagi domyślnie podpowiada wartość ostatniego wpisu,
  data/godzina automatyczne (edytowalne), auto-badge R/W.
- Przypomnienia: panel ustawień z przełącznikami rano/wieczór + godziną.
  Zapis w appce wysyła config do Arkusza (klucz `reminders`), co uruchamia
  w Apps Script funkcję `syncReminders()` — tworzy/aktualizuje/usuwa
  cykliczne wydarzenia w Kalendarzu Google (skrypt działa "jako właściciel",
  więc ma dostęp do jego kalendarza bez dodatkowego OAuth we frontendzie).

## Znane pułapki (już zaadresowane w kodzie, ale warto wiedzieć)
- POST z fetch() używa `Content-Type: text/plain;charset=utf-8` — omija to
  przekierowanie 302 Apps Script (które zamienia POST na GET) i CORS
  preflight.
- Dane trzymane najpierw w localStorage (natychmiastowe), potem
  synchronizowane w tle do Arkusza — appka działa nawet offline.
- Frontend nie wywołuje bezpośrednio Google Calendar API (unikamy OAuth
  po stronie klienta) — całą logikę kalendarza wykonuje Apps Script po
  stronie serwera.
