# Hlasové rozhraní – analýza a návrh

Stav: **návrh v3 – Gemini free tier** (2026-11-15). Nic z toho zatím není implementováno.

Vývoj návrhu: v1 počítala s placeným modelem, v2 s místním parserem jako jádrem. **v3 staví na
bezplatném tieru Google Gemini API** jako hlavním „mozku“; jednoduchá místní shoda zůstává jen jako
nouzová cesta (offline / vyčerpaný limit). Související návrh MCP serveru je v
[`MCP_SERVER_PLAN.md`](./MCP_SERVER_PLAN.md) – obě části sdílí stejný serverový základ (kap. 3.6).

Rozhodnuto: zatím **Vercel Hobby** (zkušebně), **přepínač Plán / Nakládka** v listu, **odebírání
hlasem se zvláštním potvrzením**.

## 1. Cíl

Uživatel přirozeně řekne, co má být na zakázce nebo co je naložené/sbalené, a aplikace z toho připraví
**návrh změn**. Co pozná jistě, předvyplní; co nepozná, ukáže jako „nenalezeno“. Zbytek se dodělá
současnými funkcemi (katalog, Ad-Hoc, swipe, +/-).

| Fáze zakázky | Co uživatel říká | Kde se hledá | Co se mění |
|---|---|---|---|
| **Příprava** (`LOADING`, přepínač „Plán“) | „Dej tam čtyři Skypanely S60, dvě dvacítky a deset kabelů 32 A pět metrů.“ | celý **katalog** (vč. setů) | `quantityRequested` – přidání / změna plánu / odebrání |
| **Nakládka** (`LOADING`, přepínač „Nakládka“) | „Skypanely naložený všechny, kabelů zatím šest.“ | jen **položky zakázky** | `quantityLoaded` / stav `LOADED` |
| **Derigging** (`DERIGGING`) | „Sbaleno: oba fukary, hadice. Jedna dvacítka má prasklý sklo.“ | jen **položky zakázky** | stav `PACKED`, počty, hlášení závady |
| Naskladnění (`RESTOCK`) | — | — | zatím ručně (mimo rozsah) |

## 2. Zásady

1. **Hlas jen navrhuje, nikdy rovnou nezapisuje.** Výsledek se ukáže v potvrzovacím listu; zápis až po „Použít“.
2. **Zápis jde přes stávající akce** (`inventoryActions.js`, `domain/items.js`) **na klientovi** –
   stejné stavy, audit, hlídání dostupnosti a offline fronta Firestore jako dnes.
3. **Gemini dostane jen kandidáty, ze kterých smí vybírat**, a vrací jejich ID. Odpověď se v aplikaci
   ověří – neexistující ID = „nenalezeno“.
4. **Klíč nikdy v prohlížeči.** Gemini se volá přes vlastní funkci na Vercelu, která ověří
   přihlášeného uživatele stejně jako `firestore.rules`.
5. **Poskytovatel je vyměnitelný** – adaptér se stejným vstupem/výstupem; přechod na placený tier
   nebo jiný model = proměnná prostředí.

## 3. Architektura

```
 [🎤 podržet a mluvit]
   │
   ▼
 Web Speech API (cs-CZ, zdarma) ──► přepis (živě, dá se opravit / napsat ručně)
   │                               (varianta B: krátká nahrávka zvuku rovnou do Gemini)
   ▼
 kandidáti podle fáze (domain/voice.js)
   Plán: katalog  id | název | kategorie | aliasy
   Nakládka/Derigging: položky zakázky  id | název | plán | naloženo | stav
   │
   │  POST /api/voice-parse   { mode, transcript, candidates }  + Firebase ID token
   ▼
 Vercel Function ── ověření tokenu + schválený e-mail
   │                 Gemini API (free tier, model Flash / Flash-Lite)
   │                 JSON schéma odpovědi
   ▼
 návrh (řádky s ID) ──► validace + výpočet před → po (domain/voice.js)
   │
   ▼
 VoiceReviewSheet ──► „Použít“ ──► actions.applyVoicePlan() → 1 batch + audit „Hlasový příkaz“

 Nouzová cesta (offline / limit 429 / chyba): místní fuzzy shoda název+aliasy (domain/voiceMatch.js)
```

### 3.1 Přepis řeči

**A) Web Speech API – výchozí.** `SpeechRecognition`, `lang = 'cs-CZ'`, průběžné výsledky.
Zdarma, bez klíče, funguje v Chrome na Androidu (i v nainstalované PWA) a v desktopovém Chrome/Edge.
Potřebuje síť. Slang („dvacítka“, „S60“, „32 A“) může přepsat po svém – nevadí, Gemini dostane
katalog a pozná, co se myslelo. Přepis je vždy vidět a dá se opravit.

**B) Zvuk rovnou do Gemini – experiment.** Gemini Flash umí vstup audio. Krátká nahrávka
(`MediaRecorder`, webm/ogg, pár sekund, inline base64) se pošle spolu s kandidáty a model udělá
přepis i porozumění najednou – s katalogem v kontextu by měl lépe chytat oborová slova.
Stojí víc tokenů free tieru a uživatel nevidí živý přepis (model vrátí i pole `transcript`).
Zapne se v Nastavení, pokud A nebude stačit; porovná se na testovací sadě (kap. 7).

### 3.2 Gemini – porozumění

Serverová funkce **`api/voice-parse.js`**.

- **SDK:** oficiální `@google/genai` (Node), klíč `GEMINI_API_KEY` z Google AI Studio (bez karty) ve Vercel env.
- **Model:** z proměnné `GEMINI_MODEL`. Vybere se aktuální model řady **Flash** (případně Flash-Lite,
  pokud bude stačit a má vyšší limity), který je ve free tieru – názvy se často mění, proto v kódu
  napevno nejsou. Ověřit na stránce modelů / v AI Studiu při založení klíče.
- **Strukturovaný výstup:** `responseMimeType: 'application/json'` + JSON schéma odpovědi
  (přesné názvy polí podle aktuální dokumentace SDK), nízká teplota. Odpověď:

```jsonc
{
  "transcript": "…",                      // jen u varianty B (zvuk)
  "lines": [
    {
      "heard": "čtyři skypanely",          // úsek věty
      "targetId": "cat-lgt-07",            // ID z kandidátů, nebo null = nenalezeno
      "alternatives": ["cat-lgt-08"],
      "op": "SET_PLAN",                    // ADD | SET_PLAN | SET_COUNT | DONE | DAMAGE | REMOVE
      "quantity": 4,                       // null = „všechny“ / bez počtu
      "confidence": "high",                // high | medium | low
      "note": ""                           // u DAMAGE popis závady
    }
  ],
  "unparsed": ""
}
```

- **Instrukce (system instruction):** role („pomocník party osvětlovačů, převádí diktát na změny
  zakázky“), pravidla českých číslovek a tvarů („dvě“, „oba“, „pár“, „všechny“), význam sloves
  (přidej/ještě = přičíst, celkem/má být = nastavit, rozbitý = závada, vyhoď = odebrat), výchozí
  výklad bez slovesa (Plán = celkem n, Nakládka/Derigging = naloženo/sbaleno n), čísla uvnitř názvů
  („S60“, „2.5 kW“) nejsou počty, smí se vybírat **jen** z dodaných ID. Instrukce je stálá, kandidáti
  a věta jdou za ní.
- **Velikost:** katalog ve formátu `id|název|kategorie|aliasy` je při stovkách položek pár tisíc
  tokenů – na volání free tieru v pořádku.
- **Limity a chyby:** odpověď 429 (vyčerpaný limit) → klient přejde na nouzovou místní shodu a ukáže
  „Chytré rozpoznání je teď vytížené“. Timeout ~10 s. Vlastní limit na uživatele (např. 15 volání/min),
  aby jeden člověk nevyčerpal limit celé partě.
- **Nic se neukládá** – zvuk ani přepis zůstávají jen v auditu aplikace.

**Free tier – co vědět:**
- Google přesné limity free tieru (požadavky/min, /den) veřejně neuvádí a v minulosti je snižoval;
  skutečné limity projektu ukáže AI Studio. Pro partu s desítkami až nízkými stovkami příkazů denně
  by měly stačit – ověří se v pilotu.
- V bezplatném tieru může Google odeslaný obsah používat ke zlepšování služeb. Posílají se jen věty
  a názvy techniky (žádní klienti, e-maily, termíny) – to je přijatelné, ale je dobré to vědět.
  Placený tier (zapnutí billingu v témže projektu) to vylučuje; kód se nemění.
- Při zakládání klíče ověřit, že je free tier pro český účet dostupný.

### 3.3 Nouzová místní shoda

`src/domain/voiceMatch.js` – malý a jednoduchý (ne plný parser z v2): rozdělit větu podle čárek a
„a“, poznat číslo na začátku úseku, fuzzy shoda s názvy a aliasy (bez diakritiky, prefixy, trigramy).
Výsledky jsou vždy **nejisté** (nezaškrtnuté). Slouží jen offline (napsaná věta) a když Gemini
neodpoví. Lze dodělat až ve fázi 3.

### 3.4 Logika v aplikaci

| Soubor | Obsah |
|---|---|
| `src/domain/voice.js` | kandidáti podle fáze, validace odpovědi, výpočet „před → po“, převod na operace. Unit testy. |
| `src/domain/voiceMatch.js` | nouzová místní shoda (3.3). Unit testy. |
| `src/services/voiceService.js` | volání `/api/voice-parse` s tokenem, timeout, 429 → nouzová cesta, offline |
| `src/hooks/useSpeechInput.js` | Web Speech (push-to-talk, průběžný přepis, chyby mikrofonu); varianta B nahrávání |
| `src/components/voice/VoiceButton.jsx` | mikrofon (FAB v seznamu položek, v Katalogu pro přípravu) |
| `src/components/voice/VoiceReviewSheet.jsx` | potvrzovací list (3.5) |
| `api/voice-parse.js` | Gemini (3.2) |
| `api/_lib/*` | sdílený serverový základ (3.6) |

Rozšíření `inventoryActions.js`:
- `addCatalogItemToJob(jobId, catalogItem, qty = 1)` – dnes vždy 1 ks; doplní se počet (u setů
  násobek `bundleItems`). Stávající volání se nemění.
- **`applyVoicePlan(jobId, mode, lines, transcript)`** – složí operace ze stávajících čistých funkcí
  (`applyRequestedQuantity`, `applyExactQuantity`, `markDone`, `reportDamage`, `newItemFromCatalog`,
  `expandBundle`) do **jednoho commitu** + audit `Hlasový příkaz` (přepis, souhrn, zdroj `gemini` /
  `místní` a co uživatel opravil). Vrací původní stav pro **Zpět**. Stejnou funkci použije i MCP server.

| op | Plán | Nakládka | Derigging |
|---|---|---|---|
| `ADD` | nová položka z katalogu nebo `plán + n` | `naloženo + n` | `sbaleno + n` |
| `SET_PLAN` | plán = n | — | — |
| `SET_COUNT` | — | naloženo = n | sbaleno = n |
| `DONE` („všechny“) | — | `markDone` → `LOADED` | `markDone` → `PACKED` |
| `DAMAGE` | — | `reportDamage` (foto ručně) | `reportDamage` |
| `REMOVE` | odebrat – **zvláštní potvrzení** | — | — |

Pravidla:
- **Přepínač Plán / Nakládka** jen ve fázi `LOADING`; výchozí Plán, dokud není nic naloženo, pak
  Nakládka. Přepnutí pošle větu znovu s jinými kandidáty. V Katalogu vždy Plán.
- **Odebírání:** červený řádek, není předem zaškrtnutý, „Použít“ se zeptá ještě jednou; jen v Plánu a
  jen u nenaložených položek. Zpět přes stávající `restoreJobItem`.
- **Kusově sledované položky (štítky):** hlas počítá jako ruční +/- (bez `unitIds`); hint „kusy se
  štítkem raději naskenuj“.
- **Dostupnost** v Plánu přímo v listu (`availabilityFor`) – „⚠ v termínu chybí 2 ks“.
- Archivovaná zakázka / `RESTOCK`: mikrofon se nezobrazí.

### 3.5 Potvrzovací list

```
┌ Hlasový příkaz ─────────────── [ Plán | Nakládka ] ✕ ┐
│ „dej tam čtyři skypanely dvě dvacítky a deset         │
│  kabelů třicet dva ampér pět metrů“         [upravit] │
├───────────────────────────────────────────────────────┤
│ ☑ ARRI SkyPanel S60-C              plán 2 → 4  [−][+] │
│ ☐ HMI 2.5 kW  (+1 další shoda ▾)     nové   2  [−][+] │
│ ☑ Kabel 32A 5m                       nové  10  [−][+] │
│   ⚠ v termínu chybí 2 ks                              │
│ ✗ „na přívěs“ – nenalezeno  [Hledat] [Ad-Hoc]         │
├───────────────────────────────────────────────────────┤
│   [🎤 Doplnit]                      [Použít 2 změny]   │
└───────────────────────────────────────────────────────┘
```

- Nejisté řádky (`medium`/`low`) nejsou předem zaškrtnuté; alternativy v rozbalovacím seznamu.
- „🎤 Doplnit“ přidá další větu do téhož listu; „upravit“ přepis → znovu poslat.
- Po „Použít“ toast se **Zpět**. Haptika jako u skeneru.

**Aliasy:** do `catalog/{id}` volitelné pole `aliases: string[]`. Posílají se Gemini i nouzové shodě.
Když uživatel v listu změní shodu, aplikace nabídne „Pamatovat si ‚dvacítka‘ = HMI 2.5 kW?“ →
`updateCatalogItem` (auditováno). Editovatelné i v detailu katalogu.

### 3.6 Sdílený serverový základ (hlas + MCP)

```
api/
  voice-parse.js          hlas → Gemini
  mcp.js                  MCP server (viz MCP_SERVER_PLAN.md)
  _lib/
    approvedEmails.js     JEDEN seznam schválených e-mailů (dnes jen ve firestore.rules)
    verifyFirebaseUser.js ověření Firebase ID tokenu (hlas z aplikace)
    gemini.js             adaptér Gemini (model z env, JSON schéma, 429)
    firestoreAdmin.js     firebase-admin (jen MCP)
    rateLimit.js          jednoduchý limit na uživatele
```

- Seznam e-mailů se vytáhne do `approvedEmails.js` a malý skript (`npm run rules:emails`) ho vepíše
  do `firestore.rules`, aby se neudržoval dvakrát (rules se dál publikují ručně v konzoli).
- Proměnné ve Vercelu: `GEMINI_API_KEY`, `GEMINI_MODEL`, (pro MCP) `FIREBASE_SERVICE_ACCOUNT`.
- Ověření Firebase ID tokenu: `firebase-admin` (`verifyIdToken`) – stejná knihovna jako pro MCP.
- **Vercel Hobby** je podle podmínek pro nekomerční použití – pro pilot OK, před ostrým provozem rozhodnout.

## 4. Offline a chyby

- Diktování i Gemini potřebují síť. Offline: mikrofon šedý, textové pole + nouzová místní shoda;
  zápis jde do offline fronty Firestore jako dnes.
- 429 / chyba / timeout Gemini → nouzová shoda + hláška; přepis zůstává v listu, dá se zkusit znovu.
- Prohlížeč bez `SpeechRecognition` (např. Firefox) → textové pole (nebo varianta B).

## 5. Bezpečnost a soukromí

- Klíč jen na serveru; funkce přijme jen ověřený token schváleného uživatele; limit na uživatele.
- Ven odchází jen zvuk (přes prohlížeč Googlu/Microsoftu, u varianty B do Gemini) a věta + názvy techniky.
- Gemini nic nezapisuje – vrací návrh; zápis dělá klient přes existující akce a rules.

## 6. Náklady

| Část | Služba | Cena |
|---|---|---|
| Přepis řeči | Web Speech API | 0 Kč |
| Porozumění | Gemini API free tier | 0 Kč v rámci limitů |
| Nouzová cesta | místní shoda | 0 Kč |
| Hosting funkce | Vercel Hobby | 0 Kč (pilot) |

Kdyby free tier nestačil: zapnutí billingu v Google projektu (Flash modely jsou levné), bez změny kódu.

## 7. Testování a měření

- **Unit testy (vitest):** `voice.js` (validace, před → po, štítky, sety, archiv, odebírání),
  `voiceMatch.js`, `applyVoicePlan` proti in-memory repu, `voice-parse` s mockem Gemini.
- **Testovací sada vět:** 50–100 reálných vět od party (Plán, Nakládka, Derigging, slang) s
  očekávaným výsledkem v `tests/voice-cases.json`. Skript `npm run voice:eval` je pošle na Gemini
  (spotřebovává free-tier limit) a vypíše úspěšnost; spouští se při změně instrukce, modelu nebo
  varianty A/B.
- **Měření v provozu:** audit ukládá zdroj řádků a opravy uživatele → po pár týdnech je vidět
  úspěšnost a co doladit (aliasy, instrukce, varianta B).
- **Ručně:** PWA na Androidu, hluk ve skladu a v autě.

## 8. Postup po fázích

| Fáze | Obsah | Výsledek |
|---|---|---|
| **0 – základ** | klíč v Google AI Studio, Vercel env, `api/_lib` (e-maily, ověření tokenu, Gemini adaptér), prázdný `voice-parse` | funkce odpoví jen přihlášenému |
| **1 – Plán (příprava)** | Web Speech, `voice-parse` pro katalog, `voice.js`, `VoiceReviewSheet`, `addCatalogItemToJob(qty)`, `applyVoicePlan`, audit + Zpět, odebírání, aliasy | diktování výbavy na zakázku |
| **2 – Nakládka a Derigging** | přepínač, kandidáti z položek zakázky, `SET_COUNT` / `DONE` / `DAMAGE` | hlasové odškrtávání |
| **3 – zpřesnění** | testovací sada + eval, nouzová místní shoda, varianta B (zvuk do Gemini) | lepší přesnost, práce bez limitu/offline |

## 9. Otevřené

1. Založit klíč Gemini (Google AI Studio) – kdo bude vlastníkem Google projektu (firemní účet).
2. Hosting pro ostrý provoz (Vercel Pro / jinde), až se pilot osvědčí.
3. Varianta B (zvuk rovnou do Gemini) – rozhodnout podle testovací sady.
