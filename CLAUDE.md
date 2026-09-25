# Waga PF — pamięć projektu

Prywatna mini-appka webowa: dziennik pomiarów masy ciała (kilka profili osób)
plus zakładka Trening. Używana głównie na iPhonie (Safari → „Dodaj do ekranu
początkowego"). Z użytkownikiem rozmawiaj po polsku („Szefie"); to inżynier, nie
programista — rób sam wszystko, co nie wymaga jego logowania.

## Gdzie co leży

- **Frontend**: `index.html` (jeden plik: HTML + CSS + JS, bez frameworków, bez
  build stepu) → GitHub Pages: https://heatcoolfulawkawro-ui.github.io/Waga-PF/
- **Backend**: `Kod.gs` + `appsscript.json` → Google Apps Script przypięty do
  Arkusza Google (zakładka `Data`, kolumny `key` / `value`). Generyczny magazyn
  klucz-wartość (`doGet` / `doPost`) plus `syncReminders` (przypomnienia jako
  cykliczne wydarzenia w Kalendarzu Google właściciela).
- **Web App URL** — stała `GAS_URL` w `index.html` (deployment `@1`). NIE MOŻE
  się zmienić: telefony mają appkę zapisaną na ekranie początkowym.
- `.clasp.json` / `.claspignore` — clasp wypycha tylko `Kod.gs` i
  `appsscript.json`.
- `README.md` — pełna dokumentacja funkcji, profili i pułapek. Przeczytaj przed
  zmianą logiki profili, treningu albo scrolla pagera zakładek.
- Dane pomiarowe żyją w Arkuszu Google (klucze `state_<profil>`, `training`,
  `reminders`), NIE w repo — poza pomiarami startowymi zaszytymi w `index.html`
  na pierwsze uruchomienie.

## Praca z telefonu i z PC (ważne)

- Zmiany w tym repo bywają robione z TELEFONU: sesja chmurowa „WAGA PF" w Code
  (claude.ai/code, środowisko „Program Do Notatek") wypycha commity na GitHub.
  Kopia na PC (`F:\AI\Waga-PF`) potrafi więc być ZA GitHubem (25.09.2026 miała 4
  commity zaległości). Przed pracą lokalną: `git fetch`, potem
  `git pull --ff-only`. Po pracy `git push` — niewypchnięte zmiany z PC nie są
  widoczne z telefonu.
- Push bez zapisanych poświadczeń gita:
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main`
- Sesję lokalną zaczynaj w folderze `F:\AI\Waga-PF` (nie w `F:\AI`).

## Wdrażanie — wszystko przez `git push` na `main`

- **Frontend**: push → GitHub Pages publikuje samo (~1 min). Appka sama wykrywa
  nową wersję (nagłówek `last-modified` strony, skrypt na górze `index.html`),
  przeładowuje się i pokazuje wersję pod tytułem (`#appVersion`) — niczego nie
  ustawiaj ręcznie.
- **Backend**: push zmieniający `Kod.gs` lub `appsscript.json` uruchamia
  `.github/workflows/deploy-gas.yml`: `clasp push -f` + `clasp deploy
  --deploymentId <istniejące>` (sekrety repo: `CLASP_CREDENTIALS`,
  `GAS_DEPLOYMENT_ID`). Nigdy nie wdrażaj bez `--deploymentId` — powstałby nowy
  URL i appki na telefonach przestałyby zapisywać. Sama zmiana `index.html` nie
  rusza backendu.
- Po wdrożeniu backendu sprawdź: `gh run watch` (workflow „Deploy Apps Script
  backend") i to, że `GAS_URL` nadal odpowiada.
- `appsscript.json` pochodzi z `clasp pull` — nie edytuj z głowy; pola
  `webapp.access` / `executeAs` sterują dostępem do appki.
- Kroków z autoryzacją Google (pierwsze wdrożenie, nowe zgody Kalendarza/Dysku)
  żaden agent nie ominie — klika Szef.

## Zasady przy zmianach

- Przed widoczną zmianą UI (nowy ekran / panel) pokaż makietę do akceptacji.
- Po każdej zmianie JS sprawdź składnię (wytnij `<script>` do pliku i
  `node --check`) i przetestuj w przeglądarce, zanim wypchniesz.
- POST do Apps Script zawsze z `Content-Type: text/plain;charset=utf-8` —
  `application/json` wywołuje preflight CORS, a przekierowanie 302 zamienia POST
  na GET i dane po cichu się nie zapisują.
- `localStorage` to natychmiastowy bufor, `fetch` do Arkusza idzie w tle — appka
  ma działać offline. W polach wpisywanych na telefonie nie przebudowuj DOM-u
  przy wpisywaniu (gubi fokus).
- Zmiana formatu danych w Arkuszu = migracja istniejących danych (patrz
  `loadState()`), nie rób jej mimochodem. Backend jest generyczny — nowe klucze
  nie wymagają zmian w `Kod.gs`.
- Prawdziwy web push odrzucony (iOS Safari go ogranicza): przypomnienia to
  cykliczne wydarzenia w Kalendarzu Google zakładane przez Apps Script.

## Dane osobowe (zdrowotne)

- Repo jest PUBLICZNE. Nie wpisuj do commitów, README, CLAUDE.md ani do czatów
  prawdziwych pomiarów, wag i wymiarów osób z profili — dane są w Arkuszu. Nowy
  profil bez znanej wagi startowej zakładaj wzorcem `startWaga: null` (opis w
  README), nie zgaduj liczb.

## Historia i kontekst

- Powstało 12–18.09.2026 w czacie claude.ai „Waga" (projekt „PF - Domowe").
  Notatka techniczna z tego czatu: `F:\AI\_wiedza-z-czatow\05-waga.md`. Sam czat
  zawiera dane zdrowotne — nie ma po co do niego wracać, całość techniczna jest
  tu i w README.
- Dalsze prace (Trening, wykres rano/wieczór, profile osób) — sesja chmurowa
  „WAGA PF" (20.09.2026).
- Wzorzec architektury wspólny z `karta-godzin`, `Paliwo-PF`, `AGENT_JOHN`;
  mapa projektów: `F:\AI\CLAUDE.md`.
