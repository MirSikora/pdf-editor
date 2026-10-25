# PDF Editor

Lokální webová aplikace pro práci s PDF soubory — běží celá v prohlížeči (React + TypeScript + Vite),
žádná data se nikam neposílají. Zpracování PDF zajišťuje [pdf-lib](https://pdf-lib.js.org/)
(úpravy) a [pdf.js](https://mozilla.github.io/pdf.js/) (náhled).

## Funkce

- **Otevření / sloučení** — výběr více PDF najednou je automaticky sloučí do jednoho dokumentu;
  tlačítko "Sloučit další PDF" přidá další soubory k rozpracovanému dokumentu.
- **Stránky** — náhledy v postranním panelu, otáčení a mazání jednotlivých stránek, přeuspořádání
  tažením myší.
- **Rozdělení** — export rozsahu stránek jako nové PDF, nebo rozdělení na jednotlivé stránky.
- **Text a zvýraznění** — kliknutím na stránku vložíte text, tažením označíte oblast ke zvýraznění.
- **Vodoznak** — text, velikost, barva, průhlednost a natočení, aplikuje se na všechny stránky.
- **Formuláře** — detekce polí PDF formuláře (text, checkbox, dropdown, radio), vyplnění a uložení.
- **Zpět / Vpřed** — historie úprav v rámci rozpracovaného dokumentu.

Textové nástroje používají vestavěný font DejaVu Sans (`public/fonts`), aby správně fungovala
česká diakritika — standardní PDF fonty (Helvetica apod.) ji nepodporují.

## Spuštění

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
