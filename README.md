Dokumentácia Projektu: Meteo Dashboard

1. Celkový Prehľad Projektu

Popis: Tento projekt sa skladá z dvoch hlavných častí:

Webová Aplikácia (Frontend): Slúži na vizualizáciu historických meteorologických dát. Skladá sa z hlavného dashboardu (index.html) a podstránky pre detailnú analýzu s grafmi (analysis.html). Dáta načítava z json súborov hosťovaných na GitHube.

Automatizačný Skript (Backend): Beží na platforme Google Apps Script. Jeho úlohou je automaticky konvertovať CSV súbory nahraté na Google Drive do formátu JSON, ukladať ich na Drive a synchronizovať ich s GitHub repozitárom, vrátane aktualizácie manifest.json.

2. Štruktúra Adresárov Webovej Aplikácie
Toto je stromová štruktúra, aby bolo hneď jasné, kde sa čo nachádza.

/ (hlavný adresár projektu)
├── index.html
├── analysis.html
├── data/
│   ├── 2024_04.json
│   ├── 2024_11.json
│   ├── ... (ďalšie json súbory)
│   └── manifest.json
├── css/
│   └── styles.css
└── js/
    ├── main.js
    ├── analysis.js
    ├── utils.js
    ├── data-loader.js
    ├── custom-aggregation.js
    └── chart-renderer.js

3. Kompletný Kód Google Apps Script

Názov súboru: transform_csv_json.gs

Popis: Tento skript obsahuje všetku logiku pre automatickú konverziu CSV súborov z Google Drive a ich následnú synchronizáciu s GitHub repozitárom. Obsahuje aj funkciu na jednorazové spracovanie starých formátov CSV.

Funkcie: diagnoseGitHubUrl, uploadOrUpdateFileOnGitHub, updateManifestOnGitHub, confertCSV_NovyFormat, processOldCSVs.)

4. Kľúčové Kroky pre Nastavenie a Konfiguráciu (Toto je kritické!)

Nastavenie Google Apps Script:

ID Adresárov na Google Drive:

Adresár pre nové CSV: nahradID

Archívny adresár pre JSON: nahradID

Adresár pre spracované CSV: nahradID

Prepojenie s GitHubom (API):

Skript vyžaduje GitHub Personal Access Token (classic).

Token musí mať povolenie (scope) repo.

Odporúčaná expirácia je "No expiration".

Nastavenie Vlastností Skriptu (Script Properties):

V editore Apps Script -> Project Settings -> Script Properties musia byť nastavené nasledujúce hodnoty:

GITHUB_TOKEN: Váš vygenerovaný Personal Access Token.

GITHUB_OWNER: Vaše používateľské meno na GitHube (napr. mstaskovan).

GITHUB_REPO: Názov repozitára (napr. MateoMeteo).

GITHUB_DATA_PATH: Cesta k dátovému adresáru bez lomky (napr. data).

Nastavenie Automatického Spúšťača (Triggeru):

Typ spúšťača: Time-driven -> ...

Funkcia na spustenie: confertCSV_NovyFormat

Čas: ...

5. Popis Dátového Toku (Workflow)
Toto zhrnie celý proces od začiatku do konca.

Proces spracovania dát:

Manuálne stiahnutie mesačného CSV súboru z Weathercloud.

Manuálne nahratie CSV súboru do určeného zdrojového adresára na Google Drive.

Automatický denný spúšťač spustí funkciu confertCSV_NovyFormat v Google Apps Script.

Skript skontroluje zdrojový adresár. Ak nájde nový súbor: a. Zistí formát (nový/starý) a správne ho prečíta a skonvertuje na JSON. b. Uloží výsledný JSON súbor do archívneho adresára na Google Drive. c. Nahrá ten istý JSON súbor do data/ adresára na GitHube. d. Presunie pôvodný CSV súbor do adresára pre spracované súbory.

Po spracovaní všetkých súborov skript načíta zoznam .json súborov z GitHubu a aktualizuje manifest.json.

Webová aplikácia si pri načítaní stiahne manifest.json a vie, ktoré dáta sú dostupné.
