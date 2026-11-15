# Příprava na ostré testování — vozidla a import skladu

Stav k 15. 11. 2026. Analýza bez programování; implementace je samostatný další krok.

---

## 0. Vyčištění databáze (provedeno)

Smazáno přímo ve Firestore (projekt `blp-inventory`) přes admin přístup:

| Kolekce | Smazáno |
|---|---|
| jobs (zakázky) | 9 |
| jobItems (položky zakázek) | 58 |
| catalog (katalog) | 73 |
| consumables (spotřební materiál) | 8 |
| stockLevels / stocktakes / stocktakeLines | 13 / 1 / 68 |
| movements (pohyby skladu) | 36 |
| auditLogs | 200 |
| inventory_store (stará záloha z verze 1) | 2 |

**Ponecháno:** `users` (8 profilů), `meta/migration_v3` (příznak „migrace hotová"; bez něj by aplikace při startu znovu importovala starou zálohu), seznam e-mailů ve `firestore.rules`.

**Záloha všeho před smazáním:** `scratch/backup/firestore-backup-2026-11-15.json` (vše, 474 dokumentů).

Na co si dát pozor:
- **Auta v aplikaci nejsou v databázi** — jsou natvrdo v kódu (`INITIAL_VEHICLES` v `src/mockData/initialData.js`: Iveco Daily, Sprinter 7AH 1240, přívěs Agados — smyšlená). Smazání proto vyžaduje úpravu kódu a řeší se v kroku 1 níže.
- **Tlačítko „Obnovit katalog"** (`RestoreCatalogCard` v katalogu) nyní, když stará záloha neexistuje, nahraje **ukázkový demo katalog** z kódu. Do ostrého testu ho nemačkat; při implementaci ho doporučuji odstranit.
- Zařízení, které bylo offline a má ve frontě neodeslané zápisy, je po připojení pošle. V praxi jde nejvýš o pár záznamů; stačí, aby si všichni před testem aplikaci otevřeli online.

---

## 1. Firemní vozidla (STK, dálniční známka)

### 1.1 Data z tabule (přepis k ověření)

| # | Vůz | SPZ | Poznámka | STK do | Dálniční známka do | Stav k 15. 11. 2026 |
|---|---|---|---|---|---|---|
| 1 | Mercedes Sprinter | 9AN 8877 | černý | 1/2027 | 21. 4. 2027 | 🟠 STK za ~2 měsíce |
| 2 | Mercedes Sprinter | 1AH R754 | bílý | 1/2029 | 17. 10. 2027 | 🟢 |
| 3 | VW Transporter | 9P5 5481 | bílý, automat | 8/2028 | 17. 10. 2027 | 🟢 |
| 4 | VW Transporter | 8P9 6375 | bílý, manuál | 2/2027 | 23. 3. 2027 | 🟠 STK za ~3 měsíce |
| 5 | Dacia Bigster | 6SX 7540 | el./natur, automat | 3/2030 | 21. 4. 2027 | 🟢 |
| 6 | Dacia Jogger | 5ST 3525 | cihlová | 5/2028 | 26. 7. 2027 | 🟢 |
| 7 | Mercedes Viano | 6P7 1711 | černá | 9/2027 | 28. 4. 2027 ⚠️ | 🟢 |
| 8 | Mercedes T180 | 1AR T457 | šedá | 9/2030 | 6. 9. 2027 | 🟢 |

⚠️ **Ověřit:** u Viana je datum známky na tabuli nečitelné („28 4.27"? ); dále SPZ `1AH R754` a `8P9 6375` (podobné znaky 8/B, 9/g). Značky vozů (Mercedes, VW, Dacia) jsem doplnil podle názvů modelů.

### 1.2 Návrh řešení

**Data — nová kolekce `vehicles`** (jeden dokument = jedno auto), nahradí natvrdo zapsané `INITIAL_VEHICLES`:

| Pole | Příklad | Pozn. |
|---|---|---|
| `name` | „Sprinter černý" | krátký název pro výběr v zakázce |
| `model` | Mercedes Sprinter | |
| `plate` | 9AN 8877 | SPZ, unikátní |
| `color`, `transmission`, `fuel` | černá / automat / LPG | volitelné, z poznámky |
| `stkDue` | `2027-01` nebo `2027-01-18` | měsíc (jako na nálepce), přesný den pokud je znám z protokolu |
| `vignetteDue` | `2027-04-21` | konec platnosti e-známky |
| `note` | | volný text |
| `active` | true | vyřazené auto se skryje, ale zůstane v historii zakázek |
| `order` | 1 | pořadí v seznamech |

Rozšiřitelné o další termíny stejného typu (povinné ručení, servis/olej, revize hasicího přístroje, lékárnička) — doporučuji termíny ukládat obecně jako seznam `deadlines: [{type, due}]`, ať se další typ přidá bez zásahu do kódu.

**Správa — „Nastavení → Vozidla"** (stávající `SettingsModal`): seznam aut, přidat / upravit / vyřadit. Formulář: SPZ, název, model, poznámka, STK (měsíc + volitelně den), známka (datum). Po úpravě zápis do auditu („Upravena STK Sprinter 9AN 8877: 1/2027 → 1/2029"). Ve fázi „všichni jsou admin" upravovat mohou všichni; až budou role, jen admin.

**Grafické upozornění** — stejný semafor všude, kde se auto ukáže:

| Stav | STK | Dálniční známka | Zobrazení |
|---|---|---|---|
| OK | > 60 dní | > 30 dní | šedý/zelený štítek s datem |
| Blíží se | ≤ 60 dní | ≤ 30 dní | 🟠 oranžový štítek „STK za 23 dní" |
| Propadlé / ≤ 7 dní | ≤ 7 dní nebo po termínu | totéž | 🔴 červený štítek „STK PROPADLÁ" + ikona výstrahy |

STK zadaná jen měsícem se počítá do posledního dne měsíce (s doporučením doplnit přesný den, protože skutečná platnost běží od data minulé kontroly).

Kde se zobrazí:
1. **Seznam vozidel v Nastavení** — každé auto se dvěma štítky (STK, známka).
2. **Výběr aut u zakázky** (Nová / Upravit zakázku) — u auta s propadlým termínem červená výstraha; když termín propadne **v době zakázky** (riggingDate–deriggingDate), upozornit i oranžově dopředu.
3. **Dashboard / horní lišta** — jeden souhrnný pruh „2 auta: blíží se STK" (klik → Nastavení → Vozidla). Zobrazit jen když je co hlásit.
4. Předávací protokol (PDF) beze změny, jen bere auta z databáze.

**Dopady v kódu** (pro implementaci): `firestore.rules` (nová kolekce), `inventoryRepo.COLLECTIONS`, `InventoryContext` (vehicles z Firestore místo mocku), `NewJobModal` (výchozí `vehicleIds: ['v1']`), `domain/items.js` (výchozí `assignedVehicleId = 'v1'`), `SettingsModal`, nová čistá funkce `vehicleStatus(vehicle, today)` + unit testy. Odhad: menší rozsah (1 den práce agenta).

---

## 2. Import skladu ze ZapSklad SQL

### 2.1 Kde jsou data

Složka `G:\Můj disk\SkladComsys\ZapSkladSql\ZapSkladSql` obsahuje **jen program** (zapSklad.EXE, FoxPro knihovny, šablony tisků, prázdné složky na fotky). Skutečná databáze je na **MS SQL Server Express**:

- server `DESKTOP-6NFB2AC\SQLEXPRESS`, databáze `zapskladA` (zjištěno z chybových logů programu)
- tento počítač (PetrSurfacePro9) ten server nevidí → **k aktuálním datům jsem se nedostal**, analýza je z přiloženého Excelu (export ~2 roky starý).
- Složky fotek (`foto/balloon/CENIK`, `EVCISLAPR`, `SKLAD`…) jsou prázdné — fotky položek nejsou k dispozici.

**Jak získat aktuální data** (až budete u počítače DESKTOP-6NFB2AC), od nejjednoduššího:
1. V zapSkladu export ceníku / evidenčních čísel do Excelu → stejný postup jako s přiloženým souborem.
2. SQL Server Management Studio → databáze `zapskladA` → Tasks → Back Up → soubor `.bak` na Google Disk. Z něj se dají vyčíst všechny tabulky (zejm. `CENIK` = karty zboží, `EVCISLAPR` = evidenční čísla kusů, `SKLAD` = stavy).
3. Povolit vzdálený přístup k SQL Expressu (TCP 1433 + uživatel jen pro čtení) — nejpracnější, nedoporučuji kvůli jednorázovému importu.

Import navrhuji postavit tak, aby šel spustit znovu s čerstvými daty (stejné ID modelů → přepíše se, nic se nezdvojí).

### 2.2 Co je v Excelu

Soubor `Sklad Balloonlight.xlsx`, 3 listy, **1 451 skutečných kusů** (+ 1 151 prázdných řádků — rezervovaná inventární čísla bez dat, ty se neimportují).

| List | Kusů | Názvů v Excelu | Sloupce |
|---|---|---|---|
| Balloon | 306 | 57 | Inv. č., V. č. (výrobní číslo, vyplněno u 162), Typ (Stative/Flying), Tvar, Stav A–D, Velikost, LED ano/ne, Název, Poznámka |
| Electro | 1 087 | 130 | Ev. č., Druh (LED modul / kabel / zdroj / ostatní), Typ (LED/HMI/Tungsten/Hybrid), Výkon, Použití, Výrobce, Název, Poslední revize |
| Accessories | 58 | 27 | Ev. č., Druh (filtr / flatlight / difúze / Moonlite), Velikost, Použití, Výrobce, Název |

Kvalita dat:
- Sloupce **Umístění a EAN jsou všude prázdné** → kódy na štítky vygeneruje aplikace (už to umí).
- **Inventární čísla nejsou unikátní** u springballů (1250–1253 opakovaně, 15–28×), u LED kabelů (469–480) a filtrů (3021–3023) → tyto se vedou **počtem**, ne po kusech.
- Stejná věc pod více názvy: „Gaffair 1,2 Kw B/W" × „1,2Kw B/W", „Balast" × „Ballast 600W Inteca 35V", „Světlo springball 3kW" × „3kw" → sloučit.
- Kusy číslované v názvu („LED panel RGB carbon #1…#12", „LED pannel long RGBA #1…#14", „short RGBA #1…#16", „Moonlite set (1)…(5)") → **jeden model, víc kusů**.
- **Revize elektro** (447 kusů) jsou z let 2022–2023 (Excel data 44739 = 27. 6. 2022 … 44888 = 23. 11. 2022, jedna chybná „27.22023") → **všechny jsou dnes propadlé**. Viz 2.5.
- Export je 2 roky starý → po importu **udělat v aplikaci inventuru** (funkce už existuje) a stavy srovnat se skutečností.

Po sloučení vychází **cca 160 katalogových modelů** a 1 451 kusů.

### 2.3 Převod do aplikace

| Excel | Aplikace (katalog) | Evidence |
|---|---|---|
| Balloon (všechny tvary) | kategorie **Světla / Balony** | po kusech (SERIAL): kód = Inv. č., výrobní č. = V. č., stav A–D, poznámka |
| Balloon Springball (sdílená čísla) | Světla / Balony | počtem (QUANTITY) |
| Electro → LED module (panely, sítě, pad, springball LED) | **Světla** | po kusech; Flatlight 250W (266 ks) zvážit počtem |
| Electro → Cable HMI/Tungsten/Hybrid („Balloon 5×1000W Tungsten", „Gaffair 4kW HMI"…) | **Světla – světelné vložky balonů** | po kusech (mají revize) |
| Electro → Cable LED (Mumoco/Inteca 5–50 m) | **Kabely** | počtem |
| Electro → Zdroj / Power supply (balasty, dimmery) | **Balasty & Zdroje** | po kusech |
| Electro → Ostatní: prodlužovačky, redukce, drei stecker | **Kabely** | počtem |
| Electro → Ostatní: power box, splitter box | **Distribuce** | počtem |
| Electro → Ostatní: fukary | **nová kategorie Nářadí** (nebo Grip) | počtem |
| Accessories → filtry, difúze, cover, eggcrate | **Textil & Difúze** | počtem |
| Accessories → Flatlight frame | **Stativy & Grip** | počtem |
| Accessories → Moonlite set | **Distribuce** (bezdrát. DMX) | po kusech |

Do katalogu se přenese i výkon, velikost, výrobce, použití (do kterého balonu), LED ano/ne. Doporučuji v katalogu přidat dvě volitelná pole: **„Použití / pro balon"** a **„Výrobce"** — usnadní výběr správné vložky k balonu.

### 2.4 Grafické ikony

Aplikace má teď ikony jen podle 7 kategorií. Návrh: ikona podle **typu položky** (pole `icon` v katalogu, při importu se nastaví automaticky podle tvaru/druhu, ručně jde změnit). Vše z knihovny Lucide, kterou aplikace už používá — kromě dvou vlastních:

| Položky | Ikona | Proč |
|---|---|---|
| Balon Cloud | `Cloud` | tvar mraku |
| Balon Tuba / Tube | `Cylinder` | válec |
| Balon Koule / Round | `Globe` | koule |
| Balon Kostka / Cube | `Box` | krychle |
| Balon Elipsa | `Egg` | elipsoid |
| Balon Zero gravity | `Disc3` | plochý disk |
| Balon Gaffair (na stativu) | `LampFloor` | světlo na stativu |
| Balon Springball | **vlastní SVG** (koule s paprsky/pružinou) | v Lucide nic výstižného |
| LED panel / Flatlight / pad-light | `PanelTop` | plochý panel |
| LED síť (net 4×4, 8×4) | `Grid3x3` | síť |
| Světelná vložka HMI / Tungsten / Hybrid | `Lightbulb` | žárovky v balonu |
| Balast, zdroj | `Cpu` | elektronika (jako dnešní kategorie) |
| Dimmer | `SlidersHorizontal` | regulace |
| LED kabel, prodlužovací kabel | `Cable` | kabel |
| Redukce, drei stecker | `PlugZap` | přechod mezi konektory |
| Power box, splitter box | `Split` | rozbočení |
| Fukar | `Fan` | ventilátor |
| Filtr set (scrim + CTO) | `Aperture` | filtr světla |
| Difúze (grid / magic cloth), cover | `SquareDashed` | látka |
| Eggcrate | `Grid2x2` (příp. `Grid3x3`) | voština |
| Flatlight frame | `Frame` | rám |
| Moonlite (bezdrátové DMX) | `Radio` | vysílač |

Každá ikona v barvě kategorie (balony jantarová, balasty azurová, kabely zelená…), takže v seznamu je hned vidět druh i tvar. Fotku jde k modelu kdykoli přidat — ikona je jen náhrada, když fotka chybí.

### 2.5 Návrh navíc: revize elektro

Excel eviduje „Poslední revize" u 447 kusů a prázdný sloupec „Platnost revize". Je to stejný typ problému jako STK u aut. Doporučuji u elektro položek evidovat datum revize a **stejným semaforem** hlídat propadlé revize (v katalogu a hlavně při nakládce na zakázku: „tento kus má propadlou revizi"). Dnes by svítily všechny — nejdřív udělat revize, pak nahrát data.

### 2.6 Postup importu

**Stav 15. 11. 2026: proveden import z Excelu** — 161 modelů, 1 452 kusů, z toho 794 se štítkem (kód = staré inventární číslo). Přehled modelů: `ZAPSKLAD_IMPORT_MODELY.csv`. Skripty: `scripts/zapsklad/`.

Původní návrh:

1. Získat čerstvá data (2.1) — nebo vědomě použít Excel z roku 2024.
2. Připravit převodní tabulku modelů (sloučení názvů, kategorie, ikona, SERIAL/QUANTITY) jako CSV → **vy ji projdete a opravíte** v Excelu.
3. Import skriptem: katalog → kusy s kódy → stavy skladu → pohyb „Založení stavu" do historie.
4. V aplikaci inventura po kategoriích, rozdíly opravit.
5. Tisk štítků (QR) na kusy, které je ještě nemají.

---

## Otázky k rozhodnutí

1. Import z dnešního Excelu (2 roky starý), nebo nejdřív stáhnout aktuální data ze SQL na DESKTOP-6NFB2AC?
2. Flatlight LED panely (266 ks) vést po kusech se štítkem, nebo jen počtem?
3. Hlídat i elektro revize (2.5)?
4. Další termíny u aut (povinné ručení, servis)?
