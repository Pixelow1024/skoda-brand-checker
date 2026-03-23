# Škoda Brand Compliance Checker

Narzędzie do weryfikacji materiałów reklamowych zgodnie z Škoda Brand Guidelines 2024.

---

## Jak postawić na Vercel (10 minut)

### Krok 1 — Wgraj projekt na GitHub

1. Wejdź na [github.com](https://github.com) → zaloguj się lub załóż konto
2. Kliknij **New repository** → nazwa: `skoda-brand-checker` → **Create repository**
3. Na stronie repozytorium kliknij **uploading an existing file**
4. Przeciągnij **wszystkie pliki i foldery** z tej paczki → kliknij **Commit changes**

### Krok 2 — Połącz z Vercel

1. Wejdź na [vercel.com](https://vercel.com) → zaloguj się przez GitHub
2. Kliknij **Add New → Project**
3. Wybierz repozytorium `skoda-brand-checker` → kliknij **Import**
4. Framework Preset: **Next.js** (wykryje automatycznie)
5. **Nie klikaj jeszcze Deploy** — najpierw krok 3

### Krok 3 — Dodaj klucz API

W panelu Vercel przed deployem:
1. Rozwiń sekcję **Environment Variables**
2. Name: `ANTHROPIC_API_KEY`
3. Value: wklej klucz API Anthropic (format: `sk-ant-api03-...`)
4. Kliknij **Add**

### Krok 4 — Deploy

1. Kliknij **Deploy**
2. Za ~2 minuty Vercel poda gotowy link, np. `skoda-brand-checker.vercel.app`
3. Ten link możesz dać klientowi

---

## Aktualizacja reguł brandbooka

Reguły są w pliku `app/page.js` w zmiennej `BRANDBOOK_RULES` (góra pliku).
Edytuj tekst → wypchnij na GitHub → Vercel automatycznie przebuduje stronę.

---

## Struktura projektu

```
skoda-checker/
├── app/
│   ├── api/check/route.js   ← proxy do Anthropic API (klucz ukryty)
│   ├── layout.js
│   └── page.js              ← cały interfejs
├── package.json
├── next.config.js
└── README.md
```

---

## Bezpieczeństwo

Klucz API Anthropic jest przechowywany wyłącznie po stronie serwera Vercel (zmienna środowiskowa).
Klient nigdy go nie widzi. Przeglądarka wywołuje tylko `/api/check` na waszym serwerze.
