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
   startowych pomiarów profilu "Ja" (zaszyte w kodzie) do localStorage i do
   Arkusza (zakładka "Data", klucz `state_ja`).
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
- Ustawienia: "Waga startowa" i "Waga docelowa" edytowalne dla każdego
  profilu; zapis od razu przelicza i odświeża BMI aktualne/docelowe,
  deltę i pasek postępu na dashboardzie (ten sam `persistLocal()+render()`
  co przy zmianie celu). Wpisanie wagi startowej dla profilu, który jeszcze
  nie ma żadnego pomiaru (np. świeżo dodana osoba), samo ustawia też datę
  startu na dziś — nie trzeba czekać na pierwszy realny wpis.

## Trzy profile wagi: Ja / Beata / Żona
Segmentowy przełącznik pod paskiem tytułowym (widoczny tylko w trybie ⚖️ Waga)
przełącza CAŁY widok (Dashboard, Historia, Nowy pomiar) między niezależnymi
zestawami danych, trzymanymi w `state.profiles.ja` / `.beata` / `.zona`:
- **Ja**: R/W wg godziny, dwuliniowy wykres rano/wieczór, własne przypomnienia
  w Kalendarzu Google.
- **Beata** (teściowa): jeden pomiar dziennie, bez podziału R/W (pola
  Godzina/Pora ukryte w formularzu i tabeli historii, wykres jednoliniowy),
  bez przypomnień w kalendarzu. Start: 101.50 kg / 20.09.2026, wzrost 152 cm,
  cel 57.5 kg (górna granica prawidłowego BMI 24.9 dla tego wzrostu).
- **Żona**: R/W i dwuliniowy wykres tak jak "Ja" (`hasReminders: true`
  w `PROFILES_META` — to tylko flaga "ma podział rano/wieczór", nie "ma
  własny kalendarz"), ale **bez własnej sekcji przypomnień w Ustawieniach**
  — zostaje jedno, wspólne przypomnienie z profilu "Ja" (sekcja kalendarza
  w Ustawieniach jest gated na `activeProfile()==='ja'`, nie na
  `hasReminders`). Brak znanej wagi startowej przy starcie: profil rusza
  bez żadnego pomiaru (cel 56 kg, wzrost 159 cm), a **pierwszy wpis, który
  sama doda, automatycznie staje się jej punktem startowym** (bootstrap w
  handlerze `btnSave` — patrz pułapka niżej o `startWaga: null`).

**Backend bez zmian.** `Kod.gs` to generyczny magazyn klucz-wartość, więc
obsługuje nowe klucze automatycznie:
- `state_ja` / `state_beata` / `state_zona` — pomiary i ustawienia per profil
- `training` — `exercises`/`workouts`, wspólne, niezależne od profilu wagi
- `reminders` — `{rano, wieczor, trening}` w jednym obiekcie, zawsze tylko
  z profilu "Ja" + wspólne przypomnienie treningowe — Żona i Beata nie mają
  własnych wpisów w tym obiekcie (świadomie, na życzenie użytkownika: jedno
  przypomnienie w kalendarzu wystarczy niezależnie od liczby profili wagi)

Appka pobiera przy starcie wszystkie profile wagi (`pullWeightState('ja')`,
`pullWeightState('beata')`, `pullWeightState('zona')`) plus dane treningowe
(`pullTraining()`), więc przełączanie profilu w UI jest natychmiastowe (bez
dodatkowego zapytania). Zapis (`pushState()`) zawsze wysyła aktywny profil
wagi + trening razem.

Istniejący stan sprzed tej zmiany (płaska struktura `measurements`/`settings`/
`reminders` bez `profiles`, albo już zmigrowany do `profiles.ja`+`.beata` ale
jeszcze bez `.zona`) jest migrowany/dopełniany automatycznie przy starcie —
`loadState()` wykrywa obie stare struktury i dopełnia brakujące profile
świeżym seedem; `exercises`/`workouts` zawsze przechodzą bez zmian.

### Pułapka: profil bez żadnego pomiaru (`startWaga: null`)
Ja/Beata zawsze mają co najmniej jeden zaszyty pomiar startowy, ale "Żona"
startuje z **pustą** listą pomiarów i `settings.startWaga = null` (nie
zgadywaliśmy jej wagi). `renderDashboard()` ma osobną, wczesną ścieżkę dla
`startWaga === null` (same myślniki na dashboardzie, pusty wykres), a
`btnSave` przy pierwszym, nie-edycyjnym zapisie dla profilu z `startWaga:
null` sam ustawia `settings.startWaga`/`settings.startData` na ten pierwszy
wpis. Jeśli dodajesz kolejny profil bez znanej wagi startowej — kopiuj ten
wzorzec, nie wymyślaj liczby.

### Pułapka: `resetAddForm()`/`resetTrainingAddForm()` wywoływane wielokrotnie ze scrolla
Handler `scroll` na pagerze zakładek (`if(i === 2) resetAddForm();`) fireuje
się dla KAŻDEGO zdarzenia scroll, które akurat zaokrągli się do indeksu 2 —
a `scroll-behavior: smooth` generuje wiele takich zdarzeń podczas osiadania
animacji, nie jedno. Dla profilu z istniejącymi pomiarami to niewidoczne
(reset nadpisuje pole tą samą wartością), ale dla **pustego** profilu
(`lastMeasurement() === null`) każdy taki dodatkowy reset czyści pole wagi
na `''` — jeśli użytkownik zdążył już wpisać wagę tuż po przejściu na
zakładkę "Nowy pomiar", jego wpis potrafił zniknąć tuż przed zapisaniem
(złapane testem end-to-end na profilu "Żona", zanim ten profil istniał ten
bug był niewidoczny). Naprawione przez pilnowanie poprzedniego indeksu
(`lastWagaTabIndex`/`lastTreningTabIndex`) i odpalanie resetu tylko przy
faktycznym PRZEJŚCIU na zakładkę 2, nie przy każdym scrollu, który tam akurat
wyląduje.

## Zakładka Trening
Przełącznik u góry ⚖️ Waga | 💪 Trening — osobny pager Dashboard/Historia/Nowy
wpis dla ćwiczeń, dane w Arkuszu pod kluczem `training` (nie zależą od
wybranego profilu wagi).
- **Typy ćwiczeń**: `czas` (sekundy, np. Deska — metryka dnia = najlepsza
  seria), `liczba` (powtórzenia, np. Pompki/Przysiady/Brzuszki — metryka dnia
  = suma serii), `cardio` (Orbitrek — czas [min] + dystans [km] + poziom,
  każda metryka ma osobny wykres/rekord/cel).
- Wpis dnia to lista serii (np. 15+15+10), nie pojedyncza wartość.
- Zarządzanie ćwiczeniami (dodaj/edytuj/usuń, cel) — w Ustawieniach.
- Trzecie przypomnienie w Kalendarzu ("Trening") obok rano/wieczór wagi,
  domyślnie 20:00, jeden event dziennie (nie per ćwiczenie).
- Eksport do Excela (Ustawienia → Kopia zapasowa) dorzuca zakładki
  "Trening - Historia", "Trening - Ćwiczenia", "Trening - Wykresy".

## Znane pułapki (już zaadresowane w kodzie, ale warto wiedzieć)
- POST z fetch() używa `Content-Type: text/plain;charset=utf-8` — omija to
  przekierowanie 302 Apps Script (które zamienia POST na GET) i CORS
  preflight.
- Dane trzymane najpierw w localStorage (natychmiastowe), potem
  synchronizowane w tle do Arkusza — appka działa nawet offline.
- Frontend nie wywołuje bezpośrednio Google Calendar API (unikamy OAuth
  po stronie klienta) — całą logikę kalendarza wykonuje Apps Script po
  stronie serwera.
