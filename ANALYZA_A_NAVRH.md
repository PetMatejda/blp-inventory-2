# BLP Inventory 2.0: Analýza, návrh testů a zjednodušení UX/CX

*Datum: 14. 11. 2026 | Stav kódu: commit `589cbbb` (main)*

Dokument má pět částí:
1. Nalezené chyby a rizika
2. Návrh automatizovaných testů
3. Zjednodušení UX/UI a CX při zachování funkcí
4. Rozšíření o inventuru skladu
5. Doporučené pořadí prací a otevřené otázky

> **Jak byla analýza dělána:** prošel jsem celý zdrojový kód (cca 9 000 řádků), funkční specifikaci a dokumentaci. Chyby v kap. 1 jsou zjištěné čtením kódu, ne proklikáním aplikace. U položek označených „ověřit testem“ si jsem jistý logikou, ale potvrdí je až první automatické testy.

---

## Shrnutí v 6 bodech

1. **Aplikace funguje a je dobře použitelná na place.** Swipe, velký stepper, offline cache a realtime sync jsou dobrý základ.
2. **Některé funkce ze specifikace v aplikaci chybí, nebo jsou jen naoko:**
   - PDF předávací protokol nejde otevřít, komponenta existuje, ale nikde není zapojená.
   - Fotka závady je simulovaná, ukládá se náhodná fotka z Unsplash.
   - Vozidla nejdou přiřazovat, vše je natvrdo „v1“.
3. **Ve synchronizaci jsou dvě pravděpodobné chyby:**
   - Smazanou položku nejde do stejné zakázky znovu přidat.
   - Přepnutí Rigging/Derigging se nemusí propsat na ostatní telefony.
4. **Bezpečnost:** databáze je otevřená pro zápis komukoli a přihlášení `blp/blpblp` je zapsané přímo v kódu.
5. **Architektura s jedním dokumentem ve Firestore narazí na limit 1 MB.** Fotky se ukládají jako base64 přímo do dat. Pro inventuru skladu je potřeba přejít na samostatné kolekce. Paradoxně to zároveň výrazně zjednoduší kód.
6. **UX:** stejnou akci jde často spustit 3–4 způsoby a karta položky má 7 ovládacích prvků. Zjednodušení zrychlí práci v rukavicích a sníží počet omylů.

---

## 1. Nalezené chyby a rizika

| # | Priorita | Problém | Kde | Dopad |
|---|---|---|---|---|
| B1 | 🔴 Vysoká | **Smazanou položku nejde vrátit do stejné zakázky.** Smazání zapíše „náhrobky“ `jobId_cat_<id>` a `jobId_name_<název>`. Přidání z katalogu ale ruší jen `jobId_<název>` a nové ID. Nová položka se proto při čtení odfiltruje: v auditu je „Přidáno“, ale v seznamu nic není. Totéž platí pro Ad-Hoc. *(ověřit testem)* | `storageService.addCatalogItemToJob`, `consolidateItems` | Uživatel si myslí, že techniku přidal |
| B2 | 🔴 Vysoká | **PDF protokol je nedostupný.** `ProtocolModal` není vložený v `App.jsx` a `isProtocolModalOpen` v kontextu neexistuje. | `App.jsx`, `ProtocolModal.jsx` | Chybí klíčová funkce ze specifikace (kap. 6.1) |
| B3 | 🔴 Vysoká | **Fotka závady je falešná.** Tlačítko „Pořídit foto“ vybere náhodný obrázek z Unsplash. Bez fotky se uloží výchozí stock fotka. | `DamageReportModal.jsx` | Protokol o závadě obsahuje nepravdivou dokumentaci |
| B4 | 🔴 Vysoká | **Databáze je otevřená všem.** `allow read, write: if true` pro `inventory_store` i `users`. API klíč je veřejný v JS, takže kdokoli může data přečíst nebo smazat. | `firestore.rules` | Riziko ztráty všech dat |
| B5 | 🟠 Střední | **Testovací přihlášení v produkci.** `blp/blpblp`, `admin/bbbb` atd. obchází Firebase a chybová hláška heslo dokonce prozrazuje. Role jsou jen kosmetické (`isAdmin = () => true`). | `firebaseAuth.js`, `InventoryContext.jsx` | Kdokoli se „přihlásí“ |
| B6 | 🟠 Střední | **Limit 1 MB na Firestore dokument.** Všechna data (zakázky, položky, katalog, audit) jsou v jednom dokumentu. Obrázky katalogu nahrané ze souboru se ukládají jako base64 bez komprese. Jedna fotka z mobilu má 2–5 MB. | `CatalogItemDrawer`, `MasterCatalogModal`, `firebaseDb.pushPayload` | Po nahrání fotky nebo s rostoucími daty přestane sync fungovat úplně |
| B7 | 🟠 Střední | **Přepnutí režimu Rigging/Derigging nemusí dorazit na ostatní zařízení.** `toggleJobMode` nemění `updatedAt`. Při slučování se shodným časem si druhé zařízení nechá svůj starý režim. *(ověřit testem)* | `storageService.toggleJobMode`, `writeLocalCache` | Dva lidé pracují v různých režimech nad stejnou zakázkou |
| B8 | 🟠 Střední | **Možný pád aplikace při slučování duplicit.** `existing.serialNumber.includes(...)` spadne, když první záznam nemá SN. Error obrazovka pak nabízí „Obnovit a resetovat data“, což volá `localStorage.clear()`. Smaže tím i neodeslané změny a náhrobky, takže se smazané položky mohou vrátit. | `consolidateItems`, `App.jsx` ErrorBoundary | Ztráta dat |
| B9 | 🟡 Nízká | **Celodokumentový zápis (poslední vyhrává).** Každý push přepíše celé pole. Spotřebák (`consumables`) se při příjmu přepíše bez slučování. Při souběžné práci dvou lidí se může ztratit změna. | `firebaseDb` | Občasné „zmizení“ změny |
| B10 | 🟡 Nízká | **Neodpovídající popisky stavů.** Stav `LOADED` je v nakládce popsaný jako „Na place“ a v deriggingu filtr „K naložení“ nedává smysl. | `PackingList`, `ItemSwipeCard` | Zmatení, viz kap. 3.3 |
| B11 | 🟡 Nízká | **Postup se počítá z řádků, specifikace chce kusy.** Položka 1× světlo a položka 40× kabel váží stejně. | `JobDashboard`, `PackingList` | Je potřeba rozhodnout, viz otázky |
| B12 | 🟡 Nízká | **Testovací pozůstatky v produkci:** simulační seznam ve skeneru, natvrdo zadaná jména „Marek Radolf“ a „Petr M.“, překlep „Stavuu“, nepoužitý `modals/AuthModal.jsx`, dva různé editory katalogu (`CatalogItemDrawer` a `MasterCatalogModal`). | různé | Údržba a matení uživatelů |

**Technický dluh:**
- Hlavní JS balík má 1,4 MB (370 kB gzip). Pomůže rozdělení na části a dynamický import `jspdf`, `html2canvas` a `html5-qrcode`.
- Projekt nemá žádné testy, lint ani CI.
- Build ve složce OneDrive padá na čtení `node_modules`. Doporučuji projekt přesunout mimo OneDrive (například `C:\dev\`), Git je stejně záloha.

---

## 2. Návrh automatizovaných testů

### 2.1 Nástroje

| Vrstva | Nástroj | Proč |
|---|---|---|
| Unit a logika | **Vitest** + jsdom | Nativně k Vite, rychlé, stejná konfigurace |
| Komponenty | **@testing-library/react** + user-event | Testuje chování z pohledu uživatele |
| Firestore pravidla | **@firebase/rules-unit-testing** + Firebase Emulator | Ověří, že cizí člověk nezapíše |
| End-to-end | **Playwright** (mobilní viewport Pixel 7) + Firebase Emulator | Celé scénáře včetně dvou zařízení najednou |
| CI | **GitHub Actions** na každý push/PR | Vercel nasadí jen to, co prošlo |

### 2.2 Předpoklad: oddělit logiku od úložiště

Dnes je business logika (stavy, slučování, náhrobky) promíchaná s `localStorage` a Firebase, a proto se špatně testuje. Navrhuji ji vytáhnout do čistých funkcí:

```
src/domain/itemStatus.js     – applyQuantityChange(item, delta, mode) → nový item
src/domain/mergeState.js     – mergeRemote(local, remote, tombstones) → stav
src/domain/consolidate.js    – consolidateItems(items, tombstones)
src/domain/progress.js       – jobProgress(items, mode)
```

Tyto funkce nic nečtou ani nezapisují, takže jdou otestovat v milisekundách. Stávající `scratch/test_sync_logic.mjs` se přepíše do Vitestu a bude testovat skutečný kód, ne jeho kopii.

### 2.3 Konkrétní testovací případy

**A. Stavový automat položky (unit, podle specifikace kap. 4)**
- Přičtení na 100 % → `LOADED` (nakládka) / `PACKED` (derigging).
- Odečtení z `LOADED` pod 100 % → `PENDING` (pravidlo Decrement).
- Množství nikdy neklesne pod 0. Přičtení nad požadavek zvýší požadavek (dnešní chování, potvrdit jako záměr).
- Swipe doprava = plný počet, swipe doleva = 0 / zpět „na place“.
- Zrušení závady: plný počet → `LOADED`, jinak → `PENDING`. Poznámky a fotky se smažou.
- Archivovaná zakázka: žádná mutace neprojde.

**B. Synchronizace a slučování (unit, nejvyšší hodnota)**
- Smazaná položka se nevrátí, ani když ji pošle jiné zařízení.
- **Smazanou položku jde znovu přidat** (B1, dnes selže).
- **Změna režimu na zařízení A se projeví na B** (B7, dnes pravděpodobně selže).
- `ARCHIVED` nepřepíše starší `ACTIVE`, novější obnovení ano.
- Novější `updatedAt` vyhrává, při shodě se chování určí explicitně.
- Slučování duplicit bez SN nespadne (B8).
- Audit log se při slučování neztrácí a je oříznutý na 300 záznamů.
- Payload je menší než 900 kB (hlídací test proti limitu 1 MB).

**C. Komponenty (Testing Library)**
- `ItemSwipeCard`: swipe pod 40 px nic nedělá, nad 40 px změní stav. Tlačítko − je zakázané na 0.
- `PackingList`: filtry počítají správně, vyhledávání podle názvu i SN, prázdný stav.
- `JobDashboard`: aktivní a archiv, ukončení zakázky s potvrzením.
- `DamageReportModal`: bez popisu nejde odeslat a bez fotky se **neuloží žádná fotka**.
- Skener: známý kód → +1 ke správné položce, neznámý kód → nabídka z katalogu.

**D. Firestore pravidla (emulátor)**
- Nepřihlášený nemůže číst ani zapisovat.
- Přihlášený uživatel mimo seznam nemůže zapisovat.
- Uživatel smí upravit jen svůj profil.

**E. E2E scénáře (Playwright, mobilní viewport)**
1. Přihlášení → nová zakázka → přidat 3 položky z katalogu a 1 set → naložit swipem → 100 % → ukončit → je v archivu.
2. Derigging: přepnout → sbalit vše → protokol PDF se stáhne (po opravě B2).
3. **Dvě zařízení:** dva prohlížečové kontexty nad stejným emulátorem. A naloží položku a B ji do 2 s vidí. A smaže položku a B ji nevrátí.
4. **Offline:** vypnout síť → 5 změn → zapnout → změny jsou v cloudu.
5. Nahlášení závady → položka červená → „Opraveno“ → vrátí se správný stav.

**Odhad:** základ (A + B + CI) zhruba 1–2 dny práce, celé A–E zhruba 4–6 dní.

---

## 3. Zjednodušení UX/UI a CX (při zachování funkcí)

**Výchozí princip:** aplikace se používá ve spěchu, v rukavicích, venku na slunci a často jednou rukou. Každý zbytečný prvek na obrazovce zdržuje a zvyšuje riziko omylu.

### 3.1 Jedna akce = jedno místo

| Dnes | Návrh |
|---|---|
| Zakázku jde otevřít 4 způsoby: tap na kartu, tlačítko „Otevřít Packaging“, ⋮ menu a long press. Karta má navíc v patičce „Použít jako vzor“ a „Ukončit“. | **Tap na kartu otevře zakázku a ⋮ nabídne vše ostatní.** Patička z karty zmizí, karta bude o třetinu menší a na obrazovku se vejde víc zakázek. |
| Karta položky má swipe, −/+, ikonu závady, koš, ⋮, long press a náhled fotky, tedy 7 prvků. | **Karta = název, počet, −/+ a swipe.** Závada, smazání, ruční počet a fotka se přesunou do ⋮ (spodní panel). Koš na kartě je nejčastější zdroj omylů. |
| Ruční zadání počtu přes `prompt()` | Tap na číslo otevře velkou numerickou klávesnici. |
| 19× systémové `alert/confirm/prompt` | Vlastní spodní panely ve stylu aplikace. U vratných akcí (smazání položky, ukončení zakázky) místo „Opravdu?“ použít **„Smazáno, VRÁTIT ZPĚT“** po dobu 5 s. Je to rychlejší i bezpečnější. |
| Dva různé editory katalogu | Jeden editor |

### 3.2 Navigace

Dnes je ve spodní liště 5 záložek (Dashboard, Packing, Katalog, Brácha, Historie). V horní liště je navíc avatar, výběr zakázky, sync, nastavení a odhlášení.

**Návrh (s ohledem na sklad):**

```
[ Zakázky ]  [ Balení ]  [ Sklad ]  [ Brácha ]  [ Více ]
                             │                     └─ Historie, Nastavení, Profil/Odhlášení
                             └─ Katalog · Stav zásob · Inventura · Příjem
```

- **Odhlášení** se přesune do profilu. Dnes je hned vedle synchronizace, takže se na něj snadno ťukne omylem.
- Horní lišta bude jen **název aktuální zakázky a stav synchronizace**.

### 3.3 Jednotný jazyk stavů

Dnes stav `LOADED` znamená v nakládce „Na place“, filtr se jmenuje „K naložení“ i během deriggingu a progress bar se jmenuje „PRŮBĚH NAKLÁDKY (NA PLACE)“. Návrh je, aby si **každá fáze používala vlastní slova** a zobrazovala jen relevantní filtry:

| Fáze | Filtry (výchozí tučně) | Swipe → | Swipe ← |
|---|---|---|---|
| Rigging (sklad → auto) | **Zbývá naložit** · Naloženo · Závady · Vše | Naloženo | Zpět ke skladu |
| Derigging (plac → sklad) | **Zbývá sbalit** · Sbaleno · Závady · Vše | Sbaleno | Zpět na plac |
| Naskladnění (nové) | **Zbývá naskladnit** · Naskladněno · Do servisu | Naskladněno | — |

Výchozí filtr „Zbývá …“ znamená, že hotové položky ze seznamu mizí. Seznam se zkracuje, uživatel vidí postup a nemusí scrollovat přes hotové věci.

### 3.4 Fáze zakázky jako průvodce, ne přepínač

Dnes je Rigging/Derigging přepínač, kterým jde fázi změnit omylem. Návrh je lineární tok s jasným dalším krokem:

```
Příprava → Nakládka → Na place → Derigging → Naskladnění → Protokol a archiv
```

- Na konci každé fáze je jedno velké tlačítko, například **„Vše naloženo, zahájit cestu“**. Zobrazí souhrn: co chybí a co je poškozené.
- **Ukončení zakázky** proběhne jako průvodce: souhrn chybějících a poškozených kusů → podpis → PDF → archiv. Tím se zároveň zapojí dnes nedostupný protokol (B2).

### 3.5 Hlášení závady na 2 ťuknutí

- Místo falešného hledáčku použít skutečný fotoaparát telefonu (`<input type="file" accept="image/*" capture="environment">`).
- Fotku zmenšit na telefonu (zhruba 1600 px, JPEG, cca 200 kB) a uložit do **Firebase Storage**. Do dat se uloží jen odkaz.
- Výchozí závažnost je „Nefunkční“, popis nepovinný a hlasové diktování funguje přes klávesnici telefonu.

### 3.6 Skener

- **Kontinuální režim:** sken přičte +1, zavibruje nebo pípne a zůstane otevřený pro další kus.
- Neznámý kód nabídne „Přidat z katalogu“ nebo „Přiřadit kód existující položce“. Tím se katalog postupně naplní kódy.
- Simulační seznam se zobrazí jen v testovacím režimu.

### 3.7 Čitelnost a ovladatelnost v terénu

- Velká část textů má 10–11 px a monospace verzálky. **Minimum by mělo být 14 px** a pro čísla a názvy 16 px.
- Ikony akcí na kartě mají zhruba 28 px. **Minimum pro dotyk (i v rukavici) je 44–48 px.**
- Ověřit kontrast světlého režimu na slunci a přidat volbu „vysoký kontrast“.
- Emoji v hláškách nahradit konzistentními ikonami.

### 3.8 Stav synchronizace (důvěra = CX)

Dnes se zobrazuje ikona, která se točí, plus občasný toast. Uživatel neví, jestli je jeho práce v bezpečí. Návrh je jeden jasný indikátor:

- ✓ **Uloženo v cloudu**
- ⏳ **Ukládám…**
- ⚠ **Offline: 4 změny čekají** (tap ukáže které)

Error obrazovka nesmí nabízet „resetovat data“. Má nabídnout „Zkusit znovu“, a pokud nic nepomůže, „Odeslat chybu a obnovit z cloudu“.

### 3.9 Formuláře a výchozí hodnoty

- Gaffer a BLP odpovědný: výběr ze seznamu uživatelů, výchozí hodnota je přihlášený uživatel. Natvrdo zadaná jména zmizí.
- Datum deriggingu je automaticky rigging + 1 den.
- Kopie zakázky („vzor“) je hlavní způsob zakládání. „Nová zakázka“ proto nabídne nejdřív **„Začít z předchozí zakázky“**.

### 3.10 CX mimo obrazovky

- Přihlášení: odstranit testovací účty a ponechat Google a e-mail, volitelně otisk prstu. Nový uživatel uvidí jednu úvodní obrazovku „Jak swipovat“.
- Brácha: funkce ze specifikace „Objednat doplnění“ vygeneruje seznam REFILL položek a sdílí ho přes WhatsApp nebo e-mail na sklad.
- PDF protokol automaticky odeslat produkci a skladu e-mailem (po potvrzení).

---

## 4. Rozšíření: inventura a evidence skladu

### 4.1 Co dnes chybí

Aplikace dnes řeší **techniku na zakázce**, ne **techniku na skladě**:
- Katalog má jen statické pole `availableCount`, které se nikde neodečítá.
- Neexistuje umístění (regál, auto, servis), pohyb materiálu ani historie konkrétního kusu.
- Stav `RESTOCKED` ze specifikace není implementovaný, takže derigging končí stavem „K odvozu“.
- Aplikace nekontroluje, jestli je technika volná, a jedno světlo jde dát do dvou souběžných zakázek.
- Neexistuje inventurní proces (porovnání „systém říká × fyzicky je“).

### 4.2 Navržený datový model

```
CatalogItem  (typ techniky: „ARRI SkyPanel S60-C“)
   ├─ trackingType: SERIAL | QUANTITY
   │     SERIAL   = každý kus má vlastní kód/SN (světla, balasty)
   │     QUANTITY = sleduje se jen počet (kabely, sukně, difuze)
   │
   ├─ StockUnit  (jen SERIAL: konkrétní kus, SN, QR kód, stav, aktuální umístění)
   └─ StockLevel (jen QUANTITY: počet na každém umístění)

Location     (Sklad A / regál 3 / Auto Crafter / Zakázka X / Servis / Vyřazeno)

StockMovement (neměnný záznam každého pohybu)
   typ: PŘÍJEM | VÝDEJ_NA_ZAKÁZKU | NÁVRAT | DO_SERVISU | ZE_SERVISU
        | VYŘAZENÍ | INVENTURNÍ_ROZDÍL | PŘESUN
   kdo, kdy, co, kolik, odkud → kam, zakázka

Stocktake    (inventura: rozsah, kdo, stav, očekávané × napočítané, rozdíly)
```

**Klíčová vlastnost:** stav skladu se nepíše ručně. **Počítá se z pohybů.** Díky tomu je historie každého kusu dohledatelná („kde bylo světlo SN 1234 posledních 6 měsíců“).

### 4.3 Napojení na stávající toky zakázky

| Krok zakázky | Pohyb ve skladu |
|---|---|
| Přidání techniky do zakázky | **Rezervace** na termín rigging–derigging. Při kolizi se zobrazí varování „Volné jen 2 z 4“. |
| Nakládka (Rigging) | `VÝDEJ_NA_ZAKÁZKU`: sklad → zakázka. U SERIAL se při nakládce naskenuje konkrétní kus. |
| Derigging | Beze změny skladu, jen „sbaleno k odvozu“ |
| **Naskladnění (nová fáze)** | `NÁVRAT`: zakázka → sklad (`RESTOCKED`). Nesedí-li počty, vznikne seznam **chybějících kusů**. |
| Závada | `DO_SERVISU`: kus se nepočítá jako dostupný, dokud neprojde opravou. |

### 4.4 Inventura

1. **Zahájit inventuru:** zvolit rozsah (celý sklad / regál / kategorie). Zakázky v běhu se počítají zvlášť.
2. **Počítání:**
   - SERIAL: skenovat kusy jeden po druhém (kontinuální skener).
   - QUANTITY: zadat počet (stepper nebo numerická klávesnice).
   - Seznam ukazuje „očekáváno / napočítáno“ a hotové řádky mizí stejně jako v balení.
3. Počítat může **více lidí najednou**, každý jiný regál, a data se sčítají v reálném čase.
4. **Vyhodnocení:**
   - přehled rozdílů (chybí, přebývá, kus na jiném místě),
   - u každého rozdílu poznámka,
   - schválení vedoucím.
5. Schválení vytvoří pohyby `INVENTURNÍ_ROZDÍL`, stav se srovná a uloží se **PDF/CSV protokol inventury**.

**Podpora:** tisk QR štítků pro kusy a regály přímo z katalogu (A4 arch se štítky) a export stavu skladu do Excelu.

### 4.5 Architektura: nutný předpoklad

Sklad s tisíci kusy a historií pohybů **se do jednoho 1MB dokumentu nevejde**. Navrhuji přechod na:
- **samostatné kolekce** `jobs`, `jobItems`, `catalog`, `stockUnits`, `stockLevels`, `movements`, `stocktakes`, `locations`, `auditLogs`;
- **vestavěnou offline perzistenci Firestore** (`persistentLocalCache`). Ta nahradí vlastní vrstvu v `localStorage`, ruční slučování a „náhrobky“. Firestore offline zápisy, frontu i konflikty po jednotlivých dokumentech řeší sám;
- **transakce** pro změny počtů ve skladu, aby se dvě souběžná odečtení nepřepsala;
- **Firebase Storage** pro fotky.

**Přínos:**
- Zmizí zhruba 500 řádků nejsložitějšího a nejchybovějšího kódu (`storageService` slučování a `firebaseDb.writeLocalCache`).
- Vyřeší se B1, B6, B7, B8 i B9.
- Odpadne limit velikosti dat.

**Riziko:** migrace stávajících dat. Řeší ji jednorázový migrační skript, testy z kap. 2 a krátký souběžný provoz.

---

## 5. Doporučené pořadí prací

| Fáze | Obsah | Proč v tomto pořadí |
|---|---|---|
| **0. Pojistka** (1–2 dny) | Vitest + CI, testy A a B. Opravit B4 (pravidla) a B5 (testovací login). Zapnout zálohu Firestore. | Bez testů a se zápisem pro kohokoli je každá další změna riziko. |
| **1. Rychlé opravy** (2–3 dny) | B1, B2 (zapojit protokol), B3 (skutečná fotka do Storage), B7, B8. Odstranit testovací pozůstatky. | Funkce ze specifikace, které uživatelé už teď čekají. |
| **2. Datová architektura** (1–2 týdny) | Kolekce, offline perzistence Firestore, migrace dat, testy pravidel a E2E se dvěma zařízeními. | Předpoklad pro sklad. Zároveň zjednoduší kód. |
| **3. Zjednodušení UX** (1 týden) | Kap. 3.1–3.4 a 3.8: karta položky, jednotné stavy, průvodce fázemi, undo místo confirm, indikátor synchronizace. | Nejvíc ušetří čas na place. |
| **4. Modul Sklad** (2–3 týdny) | Kap. 4: umístění, pohyby, rezervace, naskladnění, inventura, QR štítky, export. | Staví na fázích 2 a 3. |
| **5. Doladění** | Skener v kontinuálním režimu, čitelnost, výkon (rozdělení balíku), Brácha objednávky. | — |

---

## Otevřené otázky (potřebuji tvé rozhodnutí)

1. **Postup zakázky:** počítat podle **kusů** (jak říká specifikace), nebo podle **řádků** (jak to funguje dnes)?
2. **Sledování kusů:** které kategorie chceš sledovat po kusech se SN/QR (světla, balasty?) a které jen počtem (kabely, sukně, difuze)?
3. **Sklad:** jeden sklad, nebo víc míst (sklad, auta, externí sklad)? Má být auto „umístěním“?
4. **Inventura:** kdo ji dělá a jak často (celoroční, průběžná po regálech)? Kdo schvaluje rozdíly?
5. **Role:** stačí dnešní „všichni jsou admin“, nebo omezit mazání, katalog a schvalování inventury na vedoucí?
6. **Přírůstek nad požadavek:** když na place přičtu víc kusů, než bylo v plánu, má se požadavek automaticky navýšit (dnes ano)?
