"use client";
import { useState, useRef, useCallback } from "react";

const BRANDBOOK_RULES = `
SZKODA BRAND GUIDELINES 2024 - ZASADY CI/CD (wersja 2.0)

=== LOGO / WORDMARK ===
- Logo uzywane w dwoch kolorach: Emerald Green (#0E3A2F) lub Electric Green (#78FAAE).
- Jesli tlo jest zielone (Emerald lub Electric), uzyj bialego lub czarnego logo - kontrast OBOWIAZKOWY.
- Logo moze byc tez biale lub czarne gdy brakuje kontrastu z zielonym tlem.
- Clear space: minimum 1 BU (= wysokosc wordmarku) ze wszystkich stron.
- Logo moze byc w rogach lub wycentrowane - zaleznie od kompozycji.
- Logo NIE MOZE byc: przycinane, obracane, znieksztalcane, odbijane, rozciagane, z cieniem.
- Spacing wordmarku: 100%, 130% lub 160% szerokosci - elastyczny.

=== KOLORY PRIMARY ===
- Emerald Green: #0E3A2F (RGB 14-58-47)
- Electric Green: #78FAAE (RGB 120-250-174)
- Te dwa kolory to fundament identyfikacji marki.

=== KOLORY SECONDARY ===
- Black, Dark Grey, Stone Grey, Medium Grey, White
- Tylko jako neutral/supporting, nigdy dominujace.

=== KOLORY TERTIARY - TYLKO w infografikach ===
- Red, Blue, Teal, Yellow, Orange
- ZAKAZ uzycia w reklamach i digital ads.

=== TYPOGRAFIA ===
- Font: Skoda Next (warianty: Light, Regular, Bold)
- Mixed casing - ZAKAZ pisania naglowkow i nazw modeli CAPSLOCKIEM.
- Tekst musi miec wystarczajacy kontrast z tlem - czytelnosc obowiazkowa.

=== FACETY (Skoda Facets) ===
- Facety to wielokaty wciagane do layoutu z 4 kierunkow: gora, dol, lewo, prawo.
- Kat obrotu: 10 do 35 stopni w obu kierunkach. ZAKAZ katow bliskich 0, 45 lub 90 stopni.
- Dozwolona liczba facetow: max 3 w jednym layoucie.
- Kolory facetow: TYLKO Electric Green LUB Emerald Green - NIGDY oba w jednym layoucie.
- ZAKAZ: cieni na facetach, przezroczystosci, nakladania sie facetow.
- Facety NIE MOGA zakrywac waznych czesci fotografii (twarze, kluczowe elementy).
- Facety powinny byc zbalansowane proporcjonalnie.

=== LAYOUT ===
- Zasady kompozycji: Contrast, Clarity, Dynamic.
- Unikaj rownolegly facetow - daja wrazenie sztywnosci.

=== CTA BUTTON ===
- Dozwolone kolory CTA: Electric Green, Emerald Green, Black.
- Ksztalt: pill (zaokraglony prostokat).

=== PRICE TAG ===
- Price tag to angular label (ukosna etykieta) - uzywana w print i digital.
- Ksztalt ukosny jest PRAWIDLOWY i zgodny z brandbook.
`;

const LOADING_MESSAGES = [
  "Analizuję logo i wordmark...",
  "Sprawdzam paletę kolorów...",
  "Weryfikuję typografię...",
  "Oceniam użycie facet...",
  "Sprawdzam clear space...",
  "Generuję raport...",
];

const SEV = {
  high:   { color: "#FF4444", bg: "rgba(255,68,68,0.12)",      label: "WYSOKA",  border: "#FF4444" },
  medium: { color: "#F78046", bg: "rgba(247,128,70,0.10)",     label: "ŚREDNIA", border: "#F78046" },
  low:    { color: "#78FAAE", bg: "rgba(120,250,174,0.08)",    label: "NISKA",   border: "rgba(120,250,174,0.3)" },
};

// ─── Post-processing: deterministyczny filtr fałszywych alarmów ──────────────
//
// Każdy wpis definiuje jeden znany false positive.
// test(v) → true = usuń to naruszenie z wyników przed pokazaniem użytkownikowi.
// Dodawanie nowych filtrów: dopisz kolejny obiekt do tablicy.
//
const FALSE_ALARM_FILTERS = [
  {
    id: "hacek_slogan_graficzny",
    reason: "Háček w sloganie graficznym — prawidłowy font brandowy (háček wbudowany w kształt litery S)",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""} ${v.suggestion || ""}`.toLowerCase();
      const isHacek   = /há[cč]ek|haček|diacryt|diakryt|accent|znak diakr/.test(h);
      const isSlogan  = /let.?s.?get|life.?gets|slogan.{0,15}graficz|font.{0,10}brand|brand.{0,10}font|element.{0,15}graficz|logotyp/.test(h);
      // isMissing tylko jeśli kontekst wyraźnie wskazuje na logotyp graficzny, nie body copy
      const isMissing = /brak.{0,25}(há[cč]ek|haček|znaku|diakryt|litery|ogonka).{0,40}(slogan|logotyp|element.{0,10}graficz|let.?s.?get|life.?gets)/.test(h);
      return isHacek && (isSlogan || isMissing);
    },
  },
  {
    id: "biale_logo_ciemne_tlo",
    reason: "Białe logo na ciemnym tle — prawidłowe użycie zgodnie z brandbook",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
      return /bia[łl][ae]?.{0,25}logo/.test(h) && /ciemn|emerald|czarn|dark/.test(h);
    },
  },
  {
    id: "logo_centrum_dolu_portrait",
    reason: "Centrum dołu w formacie pionowym — dozwolona pozycja dla sloganu brandowego",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
      return /centrum.{0,12}do[łl]u|center.{0,12}bottom/.test(h);
    },
  },
  {
    id: "kolor_na_zdjeciu",
    reason: "Kolor na fotografii/zdjęciu — kolory na zdjęciach nie podlegają ocenie kolorystycznej brandbook",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""} ${v.suggestion || ""}`.toLowerCase();
      // Kolor auta
      const isCarColor = /kolor.{0,25}(auto|samoch|pojazd|car\b|vehicle)/.test(h)
          || /(auto|samoch|pojazd|car\b).{0,25}kolor/.test(h);
      // Kolor tła fotografii / zdjęcia
      const isPhotoBackground = /(zdj[eę][cć]|fotograf|photo|obraz|tło.{0,20}zdj|background.{0,20}photo|naturalne.{0,20}(tło|zdj)|pole|łąk|tulipan|kwiat|krajobraz|pejzaż|sceneri|scenery)/.test(h)
          && /(kolor|dominuj|tertiar|pomarańcz|czerwon|niebieski|żółt|orange|red\b|blue\b|yellow)/.test(h);
      return isCarColor || isPhotoBackground;
    },
  },
  {
    id: "capslock_liczby_jubileusz",
    reason: "Capslock na liczbach, cenach, roku lub elemencie jubileuszowym — nie podlega zasadzie mixed case",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
      const isCapsRule = /caps|capslock|full.?cap|wielk|kapital/.test(h);
      const isNumberOrJubilee = /\d{4}|\d+\s*(zł|pln|eur|tys|lat\b)|130.?lat|roczni|jubile|anniver/.test(h);
      return isCapsRule && isNumberOrJubilee;
    },
  },
  {
    id: "disclaimer_prawny",
    reason: "Disclaimer prawny w małym druku — dozwolony element materiału reklamowego",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
      return /disclaimer|drobny.{0,12}druk|ma[łl]y.{0,12}druk|drobnodruk|legal.{0,12}text|prawny/.test(h);
    },
  },
  {
    id: "capslock_false_alarm_mixed_case",
    reason: "Tekst zawiera małe litery — nie jest full caps, fałszywy alarm capslock",
    test: (v) => {
      const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
      const isCapsViolation = /caps|capslock|full.?cap|wielk|kapital/.test(h);
      if (!isCapsViolation) return false;
      // Wyciągnij cytowany tekst z observation (apostrofy lub cudzysłowy)
      const quoted = (v.observation || "").match(/['''„"«]([^'''„"«»]{3,})['''""»]/);
      if (!quoted) return false;
      const text = quoted[1];
      // Jeśli cytowany tekst zawiera małe litery — to nie jest full caps
      return /[a-ząćęłńóśźż]/.test(text);
    },
  },
];

const SEV_PENALTY = { high: 45, medium: 25, low: 10 };

/**
 * Czyści wyniki modelu z fałszywych alarmów.
 * Działa niezależnie od promptu — jako ostatnia linia obrony.
 */
function filterFalseAlarms(parsed) {
  if (!Array.isArray(parsed.violations)) return parsed;

  const removedReasons = [];

  parsed.violations = parsed.violations.filter((v) => {
    // Istniejąca logika: is_violation === false → do compliant
    if (v.is_violation === false) {
      removedReasons.push(
        v.rule + (v.observation ? ": " + v.observation.substring(0, 70) : "")
      );
      return false;
    }
    // Nowa logika: znane wzorce fałszywych alarmów
    for (const filter of FALSE_ALARM_FILTERS) {
      if (filter.test(v)) {
        removedReasons.push(filter.reason);
        return false;
      }
    }
    return true;
  });

  if (removedReasons.length > 0) {
    parsed.compliant_elements = [
      ...(parsed.compliant_elements || []),
      ...removedReasons,
    ];
  }

  // Przelicz score tylko jeśli nie ma BLOCKERa (score=0, MAJOR z modelu)
  const wasBlocker =
    parsed.score === 0 &&
    parsed.status === "MAJOR" &&
    parsed.violations.some((v) => v.severity === "high");

  if (!wasBlocker) {
    if (parsed.violations.length === 0) {
      parsed.score = 100;
      parsed.status = "OK";
    } else {
      const penalty = parsed.violations.reduce(
        (sum, v) => sum + (SEV_PENALTY[v.severity] || 0),
        0
      );
      parsed.score = Math.max(10, 100 - penalty);
      parsed.status =
        parsed.score >= 90 ? "OK" : parsed.score >= 60 ? "MINOR" : "MAJOR";
    }
  }

  return parsed;
}

/**
 * Deterministyczne sprawdzanie háčka w nazwie marki Škoda.
 * Działa na polu analysis.texts — niezależnie od tego co model ocenił.
 * Szuka "Skoda" lub "SKODA" (bez háčka) w polskim copy, pomija logotypy graficzne.
 */
function checkSkodaHacek(parsed) {
  const texts = parsed?.analysis?.texts;
  if (!texts) return parsed;

  const allText = Array.isArray(texts) ? texts.join(" ") : String(texts);

  // Wzorce logotypów graficznych które pomijamy
  const isLogoContext = (match, fullText, index) => {
    const surrounding = fullText.substring(Math.max(0, index - 20), index + 30).toLowerCase();
    return /life.{0,10}gets|let.{0,5}s.{0,5}get|logotyp|wordmark|(prawy|lewy|górny|dolny|gorny).{0,15}(r[oó]g)|logo.{0,15}r[oó]g|r[oó]g.{0,15}logo/.test(surrounding);
  };

  // Szukaj "Skoda" lub "SKODA" bez háčka (nie "Škoda" z háčkiem) — wszystkie formy odmiany
  // Skoda, Skody, Skodą, Skodę, Skodzie, SKODA, SKODY itp.
  const pattern = /(?<![Šš])S[Kk][Oo][Dd][a-zA-Z\u00C0-\u017E]{1,5}(?![a-zA-Z\u00C0-\u017E])/g;
  let match;
  const found = [];

  while ((match = pattern.exec(allText)) !== null) {
    // Pomiń jeśli to kontekst logotypu graficznego
    if (!isLogoContext(match[0], allText, match.index)) {
      found.push(match[0]);
    }
  }

  if (found.length === 0) return parsed;

  // Próg bezpieczeństwa: pojedyncze wystąpienie może być błędem OCR modelu
  // Flaguj tylko jeśli ta sama forma bez háčka pojawia się 2+ razy LUB 2+ różne formy
  const uniqueFound = [...new Set(found)];
  if (found.length < 2 && uniqueFound.length < 2) return parsed;

  // Sprawdź czy model już to flaguje jako brak háčka w nazwie marki (nie w logotypie)
  const alreadyFlagged = (parsed.violations || []).some((v) => {
    const h = `${v.rule || ""} ${v.observation || ""}`.toLowerCase();
    const isHacekViolation = /há[cč]ek|haček/.test(h);
    const isAboutBrandName = /skoda|škoda/.test(h);
    const isAboutModel = /octav|enyaq|karoq|superb|fabia|scala|kodiaq|kamiq/.test(h);
    const isAboutLogo = /logotyp|life.?gets|let.?s.?get|slogan|element.?graficz/.test(h);
    return isHacekViolation && isAboutBrandName && !isAboutModel && !isAboutLogo;
  });

  if (alreadyFlagged) return parsed;

  // Dodaj naruszenie MEDIUM
  parsed.violations = [
    ...(parsed.violations || []),
    {
      is_violation: true,
      rule: "Typography — háček w nazwie marki",
      observation: `Nazwa marki zapisana bez háčka: ${uniqueFound.join(", ")} zamiast 'Škoda'`,
      severity: "medium",
      suggestion: "Popraw pisownię nazwy marki na 'Škoda' z háčkiem we wszystkich wystąpieniach w copy",
    },
  ];

  // Przelicz score
  const penalty = parsed.violations.reduce((sum, v) => sum + (SEV_PENALTY[v.severity] || 0), 0);
  parsed.score = Math.max(10, 100 - penalty);
  parsed.status = parsed.score >= 90 ? "OK" : parsed.score >= 60 ? "MINOR" : "MAJOR";

  return parsed;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMediaType, setImageMediaType] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const msgInterval = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalUrl = e.target.result;
      setPreviewUrl(originalUrl);
      setResults(null);
      setError(null);

      // Compress via canvas — max 1800px wide, quality 0.82, always JPEG
      const img = new Image();
      img.onload = () => {
        const MAX = 1800;
        let { width, height } = img;
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setImageBase64(compressed.split(",")[1]);
        setImageMediaType("image/jpeg");
      };
      img.src = originalUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const reset = () => {
    setImageBase64(null); setImageMediaType(null);
    setPreviewUrl(null); setResults(null); setError(null);
  };

  const runCheck = async () => {
    if (!imageBase64) return;
    setResults(null); setError(null); setLoading(true);
    let idx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    msgInterval.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 1800);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
          system: `Jesteś ekspertem audytorem materiałów reklamowych Škoda Polska. Oceniasz polskie materiały marketingowe pod kątem zgodności z Škoda Brand Guidelines 2024.

KROK 1 — ZANIM COKOLWIEK OCENISZ, OPISZ CO WIDZISZ:
Systematycznie zidentyfikuj WSZYSTKIE elementy na grafice:
- MARKA: czy to jest materiał Škoda? Czy widać logo Škoda, modele Škoda, wordmark?
- KOLORY DOMINUJĄCE: jakie kolory zajmują największą powierzchnię grafiki?
- TEKSTY: wypisz każdy napis który widzisz i jego kapitalizację (CAPS/Mixed/lower)
- LOGO I MARKI: gdzie jest wordmark Škoda, jaki kolor, jaki rozmiar? Czy są inne logotypy lub nazwy marek?
- FACETY: czy są obecne? ile? jaki kolor? z której strony wchodzą?
- FOTOGRAFIA/RENDER: czy tło to naturalne zdjęcie z otoczeniem, czy cyklorama/render studyjny?
- BUTTON CTA: czy jest present? jaki kształt, kolor, tekst?
- EYECATCHER: czy jest trapezowy element z komunikatem ofertowym?
- OBCE MARKI: czy widać nazwy lub logotypy marek innych niż Škoda?
- SLOGAN: czy jest "Let's get Škoda/[model]" lub "Life gets Škoda"?

JEŚLI GRAFIKA NIE JEST MATERIAŁEM ŠKODA:
Jeśli na grafice nie ma żadnego elementu Škoda (logo, wordmark, modelu Škoda, kolorów brandowych) — BLOCKER: score 0, status MAJOR, naruszenie: "Brak jakiegokolwiek elementu identyfikacji marki Škoda. To nie jest materiał Škoda."
Jeśli obca marka dominuje wizualnie (logo lub nazwa obcej marki większa lub równa wordmarkowi Škody) — BLOCKER: score 0, status MAJOR.

KROK 2 — OCEŃ WEDŁUG ZASAD:

ZASADY NADRZĘDNE:
1. DOMNIEMANIE ZGODNOŚCI: jeśli nie jesteś w 95% pewny że to naruszenie — NIE flaguj. Wątpliwość = zgodność. PRZED zapisaniem każdego naruszenia do violations zadaj sobie pytanie: "Czy jestem absolutnie pewny że to błąd?" Jeśli w swoim opisie używasz słów takich jak "jednak", "ale", "zgodnie z wytycznymi jest prawidłowe", "brak naruszenia", "jest dozwolone", "wydaje się być poprawnie" — to znaczy że SAM wątpisz. Taki wpis MUSI być usunięty z violations i przeniesiony do compliant_elements.
2. TYLKO TO CO WIDZISZ: flaguj wyłącznie to co konkretnie widzisz. Nie zakładaj błędów których nie możesz wskazać.
3. MAXIMUM 5 naruszeń — tylko te których jesteś absolutnie pewny. Uwzględnij WSZYSTKIE kategorie: HIGH, MEDIUM i LOW. Nie pomijaj naruszeń MEDIUM (np. capslock) tylko dlatego że są już naruszenia HIGH.
4. MATERIAŁY POLSKIE: oceniamy polskie materiały. Tekst po angielsku w sloganach (Let\'s get, Life gets) jest dozwolony.

KOLORY:
- Dozwolone dominujące: Emerald Green (#0E3A2F), Electric Green (#78FAAE), czerń, biel, fotografia.
- Kolory tertiary (czerwony, niebieski, żółty, pomarańczowy) jako dominujące tło lub główny element brandowy — naruszenie HIGH.
- Kolor samochodu na zdjęciu NIE jest kolorem brandowym — nie oceniaj koloru auta.
- Kolory na FOTOGRAFII (tło zdjęcia: niebo, pola, kwiaty, krajobraz, otoczenie) NIE są kolorami brandowymi — nie oceniaj kolorów które należą do zdjęcia/otoczenia. Zasada kolorów tertiary dotyczy WYŁĄCZNIE elementów graficznych nałożonych na materiał (tła layoutu, facetów, buttonów, grafik), NIE dotyczy treści fotografii.

LOGO I WORDMARK:
- Kolor logo zależy od tła — obie wersje są prawidłowe i NIE flaguj jeśli zapewniają kontrast:
  * Logo na ciemnym tle (Emerald Green #0E3A2F, czarnym, ciemnoszarym) = białe logo → PRAWIDŁOWE
  * Logo na jasnym tle (białym, szarym, jasnym) = Electric Green (#78FAAE) lub Emerald Green → PRAWIDŁOWE
  * Logo Electric Green na Electric Green tle = nieczytelne → naruszenie MEDIUM
  * Logo w kolorze szarym, srebrnym, złotym lub innym spoza palety = naruszenie MEDIUM
- Prawidłowa pozycja logo zależy od orientacji formatu:
  * Format POZIOMY (landscape): TYLKO prawy dolny róg lub prawa strona = prawidłowe. Inne pozycje = naruszenie LOW (-10 pkt).
  * Format PIONOWY (portrait, ratio ~1:2 lub 9:16): centrum dołu jest DOZWOLONE jeśli element "Let's get ŠKODA!" lub "Life gets ŠKODA" zajmuje całą szerokość formatu. To jest prawidłowa kompozycja dla formatów pionowych.
  * Użyj pola logo_position_valid: false tylko jeśli pozycja jest faktycznie nieprawidłowa dla danego formatu.
- Wordmark "ŠKODA" pisany caps to prawidłowy logotyp — NIE flaguj jako capslock.
- Logo NIE MOŻE być zniekształcone, obrócone, rozciągane, z cieniem.

FORMAT SLOGANÓW — ZASADY OBOWIĄZKOWE:

KROK 0 — WYKRYJ FORMAT MATERIAŁU:

Zanim ocenisz logotyp, określ format na podstawie dwóch sygnałów: eyecatcher i nagłówek.

DETEKCJA EYECATCHERA:
- Eyecatcher = ścięty/trapezowy boks z tekstem (benefit produktowy, cena, finansowanie, wyprzedaż)
- Jeśli NIE JESTEŚ pewny czy widzisz eyecatcher → przyjmij że go NIE MA
- Wpisz wynik w polu analysis.eyecatcher

FORMAT TOF (Top of Funnel):
- Sygnały: brak eyecatchera + rounded button CTA + szerokie zdjęcie z otoczeniem
- Logo OBOWIĄZKOWE: "Life gets ŠKODA"
- "Let's get ŠKODA!" zamiast "Life gets ŠKODA" = naruszenie HIGH — "Let's get ŠKODA!" jest zarezerwowane WYŁĄCZNIE dla formatu BOF
- Brak obu logotypów = naruszenie HIGH
- Rekomendacja: "Dodaj logotyp 'Life gets ŠKODA' — format TOF wymaga tego elementu. 'Let's get ŠKODA!' jest zarezerwowane dla formatu BOF z eyecatcherem i nagłówkiem 'Let's get [model]'"

FORMAT MOF (Middle of Funnel):
- Sygnały: eyecatcher obecny + nazwa modelu w nagłówku BEZ "Let's get" (np. "Škoda Octavia", "Nowa Octavia")
- Logo OBOWIĄZKOWE: "Life gets ŠKODA"
- "Let's get ŠKODA!" zamiast "Life gets ŠKODA" = naruszenie HIGH
- Brak obu logotypów = naruszenie HIGH
- Rekomendacja: "Dodaj logotyp 'Life gets ŠKODA' — format MOF wymaga tego elementu"

FORMAT BOF (Bottom of Funnel):
- Sygnały: eyecatcher obecny + "Let's get [model]!" w nagłówku
- Logo OBOWIĄZKOWE: "Let's get ŠKODA!"
- "Life gets ŠKODA" zamiast "Let's get ŠKODA!" = naruszenie HIGH
- Brak obu logotypów = naruszenie HIGH
- Rekomendacja: "Zamień 'Life gets ŠKODA' na 'Let's get ŠKODA!' — format BOF wymaga tego logotypu"

KADROWANIE AUTA (ciasne vs szerokie) = INFO, 0 punktów — zaznacz tylko w recommendation.

DOZWOLONE:
- TOF: brak eyecatchera + rounded CTA + "Life gets ŠKODA" = prawidłowe
- MOF: eyecatcher + nazwa modelu w nagłówku + "Life gets ŠKODA" = prawidłowe
- BOF: eyecatcher + "Let's get [model]!" + "Let's get ŠKODA!" = prawidłowe
- Warianty w copy: "Życie nabiera Škody", "Lato nabiera Škody" = dozwolone jako copy ale NIE zastępują logotypu graficznego

- "ŠKODA!" jako część sloganu graficznego = element wizualny, NIE flaguj jako capslock
- "SKODA" bez háčka w elemencie graficznym sloganu "Let's get" lub "Life gets" = PRAWIDŁOWE. To jest specjalny font brandowy gdzie háček jest wbudowany w kształt litery S. NIGDY nie flaguj braku háčka w tym elemencie.
- Standalone wordmark graficzny "SKODA" lub "ŠKODA" w dowolnym rogu materiału (prawy dolny, prawy górny, lewy dolny, lewy górny) = PRAWIDŁOWE — to jest logotyp brandowy, nie tekst copy. NIGDY nie flaguj braku háčka w standalone wordmarku graficznym w rogu.
- Slogan graficzny "Let's get ŠKODA!" lub "Life gets ŠKODA" nie podlega zasadzie háčka w copy — to jest logotyp, nie tekst.

TYPOGRAFIA:
- Nazwa marki w copy: zawsze "Škoda" (z háčkiem). "SKODA" bez háčka w body copy — naruszenie MEDIUM. UWAGA: zasada háčka dotyczy WYŁĄCZNIE nazwy marki "Škoda" — nigdy nazw modeli (Octavia, Enyaq, Karoq, Superb, Fabia itd.).
- WYJĄTEK KRYTYCZNY: Element graficzny sloganu "Let's get ŠKODA!" lub "Life gets ŠKODA" używa specjalnego fontu brandowego gdzie háček jest wbudowany w kształt litery S. NIE flaguj braku háčka w tym elemencie — to jest prawidłowy logotyp graficzny. Zasada háčka dotyczy TYLKO zwykłego tekstu copy, nie elementu sloganu graficznego.
- WYJĄTEK KRYTYCZNY 2: Standalone wordmark "SKODA" lub "ŠKODA" jako samodzielny element graficzny w dowolnym rogu materiału (logotyp bez towarzyszącego sloganu) = PRAWIDŁOWE z punktu widzenia háčka. NIE flaguj braku háčka w standalone wordmarku — to jest logotyp brandowy użyty graficznie, nie nazwa marki pisana w body copy. Zasada háčka dotyczy WYŁĄCZNIE nazwy "Škoda" pisanej jako zwykły tekst w nagłówkach i body copy.
- Full caps w nagłówkach i body copy — naruszenie MEDIUM. Wyjątki: logotyp Škoda, element graficzny "Let's get ŠKODA!" (ŠKODA! w caps to prawidłowy logotyp graficzny — ABSOLUTNY ZAKAZ flagowania), element graficzny "Life gets ŠKODA", nazwy modeli (iV, RS, 4x4), skróty techniczne (CO2, kW, km/h), liczby i ceny (18 000 zł, 2025), elementy jubileuszowe i rocznicowe (130 LAT, 130 lat itp.).
- DROP SHADOW pod tekstem — naruszenie MEDIUM (-25 pkt). Bardzo częsty błąd — dodaj silną rekomendację zmiany w polu suggestion.
- Font szeryfowy lub handwriting — naruszenie HIGH.
- Nazwy modeli: "iV", "RS", "4x4", "Enyaq", "Octavia", "Karoq" itd. — prawidłowe, NIE flaguj.

FOTOGRAFIA VS RENDER:
- Naturalne zdjęcie z prawdziwym tłem = preferowane, pełne punkty.
- Render studyjny/cyklorama (auto bez otoczenia) = INFO, 0 punktów nie odejmujesz. Zaznacz TYLKO w polu recommendation że preferowane jest naturalne zdjęcie. Sprawdź jednak czytelność — jeśli render jest na białej lub szarej cykloramie i tekst jest słabo czytelny, zaznacz to w rekomendacji jako problem do rozwiązania.

FACETY:
- Zawsze identyfikuj i opisz w compliant_elements jeśli są obecne.
- Brak facetu = NIE naruszenie.
- NIE oceniaj kąta.
- Flaguj tylko: 0°/90°, nakładające się, z cieniem, lub Emerald + Electric razem.

BUTTON CTA VS EYECATCHER:
- Button CTA: zaokrąglony (pill), Electric Green, tekst call-to-action (Sprawdź, Odkryj, Poznaj itp.) = sygnał formatu TOF
- Eyecatcher: trapezowy/ścięty boks z komunikatem ofertowym (cena, benefit, finansowanie, wyprzedaż) = sygnał formatu MOF lub BOF
- ZAKAZ łączenia: button CTA (pill) i eyecatcher trapezowy w tym samym materiale — naruszenie HIGH.

CO-BRANDING I OBCE MARKI:
- Obca marka dominująca (logo lub nazwa ≥ wordmark Škody) — BLOCKER, score 0.
- Obca marka obecna ale marginalna (małe logo dealera, drobny co-branding) — naruszenie HIGH (-45 pkt).
- Drobne disclaimery prawne w małym druku — dozwolone, nie flaguj.

ABSOLUTNA CZARNA LISTA — te rzeczy NIGDY nie mogą trafić do violations, bez żadnych wyjątków:
- Háček w elemencie graficznym "Let's get ŠKODA!" lub "Life gets ŠKODA" — ABSOLUTNY ZAKAZ flagowania. Ten element używa specjalnego fontu brandowego. Nieważne co widzisz — nie flaguj háčka w sloganie graficznym.
- Brak háčka w standalone wordmarku graficznym "SKODA" w dowolnym rogu materiału (prawy dolny, prawy górny, lewy dolny, lewy górny) — ABSOLUTNY ZAKAZ flagowania. Wordmark w rogu to logotyp brandowy użyty graficznie, nie tekst copy. Zasada háčka dotyczy WYŁĄCZNIE nazwy marki pisanej jako zwykły tekst w body copy lub nagłówkach.
- Kolor logo białe na ciemnym tle — PRAWIDŁOWE, nie flaguj
- Kolor logo Electric Green na jasnym tle — PRAWIDŁOWE, nie flaguj
- Pozycja "centrum dołu" w formacie pionowym — PRAWIDŁOWE, nie flaguj
- Brak oddzielnego wordmarku "ŠKODA" gdy obecny jest slogan "Let's get ŠKODA!" lub "Life gets ŠKODA" — PRAWIDŁOWE, nie flaguj. Te slogany graficzne SĄ kompletnym logotypem kampanii — oddzielny wordmark nie jest wymagany ani oczekiwany.
- Kolor samochodu na zdjęciu (czerwony, niebieski itd.) — kolor auta to nie kolor brandowy, nie flaguj
- Kolory tła fotografii (tulipany, pola, niebo, krajobraz, kwiaty, otoczenie) — to są kolory zdjęcia, NIE elementy brandowe, absolutny zakaz flagowania jako naruszenia kolorów tertiary
- Brak háčka w nazwie modelu (Octavia, Enyaq, Karoq, Superb, Fabia, Scala, Kodiaq, Kamiq itd.) — zasada háčka dotyczy TYLKO nazwy marki "Škoda", nigdy nazw modeli
- Skróty chemiczne i techniczne (CO2, kW, km/h) pisane caps — nie są naruszeniem zasady capslock

WYTYCZNE BRANDBOOK:
${BRANDBOOK_RULES}

ZASADY SCORINGU — stosuj ściśle:

BLOCKER (score 0, status MAJOR — natychmiast, niezależnie od reszty):
- Brak jakiegokolwiek elementu Škoda na grafice
- Obca marka dominująca wizualnie (logo lub nazwa obcej marki większa lub równa wordmarkowi Škody)

HIGH (-45 pkt, status MAJOR):
- Obce marki obecne ale marginalne (małe logo dealera, drobny co-branding)
- Font szeryfowy lub handwriting
- Button CTA i eyecatcher trapezowy w tym samym materiale
- Brak OBU elementów logotypu kampanii: ani "Life gets ŠKODA" ani "Let's get ŠKODA!" nie są obecne — naruszenie HIGH. UWAGA: logotypem kampanii jest WYŁĄCZNIE pełna forma "Life gets ŠKODA" (TOF/MOF) lub "Let's get ŠKODA!" (BOF) jako jeden nierozerwalny element graficzny. Sam wordmark "ŠKODA" bez poprzedzających słów "Life gets" lub "Let's get" NIE jest wystarczającym logotypem — ale jego obecność bez sloganu NIE jest naruszeniem jeśli slogan graficzny jest obecny.
- Kolory tertiary (czerwony, niebieski, żółty) jako dominujące tło lub element brandowy
- MIESZANIE FORMATÓW: nagłówek "Let's get [model]" + logotyp "Life gets ŠKODA" w materiale bez eyecatchera (TOF z sygnałem BOF) — zawsze HIGH, bez wyjątków. UWAGA: dotyczy WYŁĄCZNIE nagłówka w formule "Let's get [nazwa modelu]" — nagłówki kampanijne (np. "Cała Polska w Octavii", "Nowa Škoda Enyaq") NIE są sygnałem BOF.
- MIESZANIE FORMATÓW: nagłówek "Let's get [model]" + logotyp "Life gets ŠKODA" w materiale z eyecatcherem (MOF z sygnałem BOF) — zawsze HIGH, bez wyjątków. UWAGA: dotyczy WYŁĄCZNIE nagłówka w formule "Let's get [nazwa modelu]".
- BŁĘDNY LOGOTYP DLA TOF: logotyp "Let's get ŠKODA!" w materiale TOF (brak eyecatchera + rounded button) — zawsze HIGH. "Let's get ŠKODA!" jest zarezerwowane WYŁĄCZNIE dla BOF.

LOW (-10 pkt, status MINOR):
- Logo nie po prawej stronie (dotyczy formatu poziomego)
- "Let's get ŠKODA!" BEZ nagłówka "Let's get [model]!" w copy — dotyczy WYŁĄCZNIE formatu BOF. W TOF i MOF logotyp "Life gets ŠKODA" jest prawidłowy bez nagłówka "Let's get [model]".

MEDIUM (-25 pkt, status MINOR):
- Full caps w nagłówkach lub body copy (nie dotyczy logotypu i nazw modeli). UWAGA: "ŠKODA!" w elemencie graficznym "Let's get ŠKODA!" to prawidłowy logotyp — NIGDY nie flaguj jako capslock. Nie flaguj też: liczb (2025, 18 000 zł), skrótów (CO2, kW), elementów jubileuszowych (130 LAT), nazw modeli. WERYFIKACJA OBOWIĄZKOWA: przed zapisaniem naruszenia capslock przepisz dosłownie flagowany tekst do pola observation w cudzysłowie. Jeśli przepisany tekst zawiera jakąkolwiek małą literę — to NIE jest full caps, usuń naruszenie.
- "SKODA" bez háčka w treści copy
- Logo w złym kolorze (nie Electric Green #78FAAE ani biały)
- Drop shadow pod tekstem — SILNA REKOMENDACJA ZMIANY, bardzo częsty błąd obniżający jakość



INFO (0 pkt odejmowania — tylko rekomendacja w polu recommendation):
- Render studyjny/cyklorama zamiast naturalnego zdjęcia — zaznacz w rekomendacji że preferowane jest naturalne zdjęcie z otoczeniem

SPRAWDZANIE JĘZYKA POLSKIEGO:
Przeczytaj uważnie KAŻDY polski tekst widoczny na grafice (nagłówki, body copy, CTA, disclaimery).
WAŻNE: Porównaj to co DOSŁOWNIE widzisz piksel po pikselu z poprawną polszczyzną — nie to co "powinno" tam być.
Sprawdź literówki i błędy ortograficzne. Błędy wpisz do pola "language_errors" — NIE do violations, NIE odejmują punktów.
Przykłady: jeśli widzisz "Polse" → błąd, poprawka "Polsce". Jeśli widzisz "samochoduw" → błąd, poprawka "samochodów".
Nie sprawdzaj: elementów graficznych logotypu (Let's get ŠKODA!, Life gets ŠKODA), nazw modeli, anglojęzycznych elementów copy.

OBLICZANIE SCORE:
- Jeśli jest BLOCKER → score 0, koniec
- 0 naruszeń → score 100, status OK
- Odejmuj punkty za każde naruszenie: HIGH=-45, MEDIUM=-25, LOW=-10
- Minimum score bez BLOCKER: 10
- Status: score 90-100=OK, score 60-89=MINOR, score 0-59=MAJOR

Zwróć TYLKO czysty JSON bez markdown. NAJPIERW wypełnij pole "analysis" — to jest twój obowiązkowy opis grafiki przed oceną. Dopiero po wypełnieniu analysis przejdź do violations:

{
  "analysis": {
    "is_skoda_material": true/false,
    "logo_color": "opisz dokładnie kolor logo który widzisz. UWAGA: element graficzny 'Let's get ŠKODA!' lub 'Life gets ŠKODA' JEST logo Škody — jeśli jest obecny, wpisz jego kolor. Nie pisz 'brak logo' jeśli slogan graficzny jest obecny.",
    "format_orientation": "poziomy (landscape, szerokość > wysokość) / pionowy (portrait, wysokość > szerokość) / kwadratowy",
    "logo_position": "wybierz DOKŁADNIE jeden z: [lewy górny róg] / [centrum góry] / [prawy górny róg] / [lewy dolny róg] / [centrum dołu] / [prawy dolny róg] / [centrum]. Dla formatu poziomego: prawy dolny róg i prawa strona to jedyne prawidłowe pozycje. Dla formatu pionowego: centrum dołu jest dozwolone jeśli slogan/logo zajmuje całą szerokość.",
    "logo_position_valid": true/false,
    "background_colors": "wymień WSZYSTKIE kolory tła które widzisz — w tym smugi, gradienty, kolory dymu, kolory świateł",
    "tertiary_colors_present": "czy widzisz czerwony/niebieski/żółty/różowy/fioletowy jako dominujące elementy tła? tak/nie — jeśli tak, wymień które",
    "texts": ["PRZEPISZ DOSŁOWNIE każdy tekst znak po znaku — NIE poprawiaj literówek, NIE interpretuj, NIE uzupełniaj. Jeśli widzisz 'Polse' wpisz 'Polse', nie 'Polsce'. Jeśli widzisz 'samochoduw' wpisz 'samochoduw'. Zachowaj dokładną kapitalizację. Uwzględnij każdy napis: nagłówki, body copy, CTA, disclaimery, copyright, adresy."],
    "facets": "opisz czy są facety, ile, jaki kolor, czy są solid wypełnione czy wireframe/outline",
    "photo_type": "naturalne zdjęcie z otoczeniem / render studyjny na gradientowym tle / render na białej cykloramie / render na szarej cykloramie",
    "button_cta": "opisz button jeśli jest: kształt (pill/kwadrat/inny), kolor, tekst",
    "eyecatcher": "opisz eyecatcher trapezowy jeśli jest: tekst, czy jest obok buttona CTA? Jeśli nie masz pewności czy to eyecatcher — napisz 'brak'. Wynik detekcji eyecatchera decyduje o formacie: brak=TOF, obecny+nazwa modelu w nagłówku=MOF, obecny+Let's get [model] w nagłówku=BOF",
    "detected_format": "TOF / MOF / BOF — wpisz wykryty format materiału na podstawie eyecatchera i nagłówka",
    "foreign_brands": "wymień WSZYSTKIE obce marki, logotypy, nazwy firm które widzisz — w tym małe napisy, lub napisz 'brak'",
    "lets_get_skoda_present": "tak/nie — czy na grafice widnieje napis 'Let's get ŠKODA!' lub 'Let's get Skoda!' lub 'Let's get SKODA!' (duży element graficzny z wordmarkiem Škody). UWAGA: brak háčka w tym elemencie jest PRAWIDŁOWY — to specjalny font brandowy.",
    "life_gets_skoda_present": "tak/nie — czy na grafice widnieje napis 'Life gets ŠKODA' lub 'Life gets Skoda'",
    "lets_get_model_present": "tak/nie + jaki model — czy w copy jest nagłówek 'Let's get [nazwa modelu]!' np. 'Let's get Superb!', 'Let's get Fabia!'",
    "slogan_tilted": "tak/nie — informacyjnie tylko, nie wpływa na scoring"
  },
  "score": 0-100,
  "status": "OK|MINOR|MAJOR",
  "violations": [{"is_violation": true, "rule": "...", "observation": "...", "severity": "low|medium|high", "suggestion": "..."}],
WAŻNE: Pole "is_violation" wypełniasz PIERWSZE, przed napisaniem czegokolwiek innego w tym wpisie. Jeśli is_violation=false — ten wpis NIE trafia do violations, idzie do compliant_elements. Model parsujący JSON zignoruje wpisy z is_violation=false w violations i przeniesie je automatycznie.
  "compliant_elements": ["..."],
  "language_errors": [{"text": "błędny tekst który widzisz na grafice", "correction": "poprawna forma", "type": "literówka|ortografia"}],
  "recommendation": "..."
}`,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
              { type: "text", text: "Oceń zgodność z Škoda Brand Guidelines 2024. Odpowiedz wyłącznie JSON." }
            ]
          }]
        }),
      });
      clearInterval(msgInterval.current);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      let raw = data.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = checkSkodaHacek(filterFalseAlarms(JSON.parse(raw)));
      setResults(parsed);
    } catch (err) {
      clearInterval(msgInterval.current);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = results
    ? results.status === "OK" ? "#4BA82E" : results.status === "MINOR" ? "#F78046" : "#FF4444"
    : "#78FAAE";
  const statusLabel = results
    ? results.status === "OK" ? "Zgodny" : results.status === "MINOR" ? "Drobne naruszenia" : "Poważne naruszenia"
    : "";

  const s = (obj) => obj; // passthrough for inline styles

  return (
    <div style={s({ background: "#0a0f0e", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", fontWeight: 300 })}>
      {/* Header */}
      <div style={s({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)" })}>
        <span style={s({ fontSize: 18, fontWeight: 700, color: "#78FAAE", letterSpacing: "0.06em" })}>ŠKODA</span>
        <span style={s({ fontSize: 10, color: "#6F7979", letterSpacing: "0.14em", textTransform: "uppercase", border: "1px solid #394748", padding: "4px 10px", borderRadius: 2 })}>
          Brand Compliance Checker v1.0
        </span>
      </div>

      {/* Main */}
      <div style={s({ maxWidth: 860, margin: "0 auto", padding: "48px 32px" })}>
        <h1 style={s({ fontSize: 36, fontWeight: 300, lineHeight: 1.15, marginBottom: 10, letterSpacing: "-0.01em" })}>
          Brand{" "}
          <span style={s({ color: "#78FAAE", fontWeight: 700 })}>Compliance</span>
          <br />Checker
        </h1>
        <p style={s({ color: "#6F7979", fontSize: 13, marginBottom: 44, letterSpacing: "0.02em" })}>
          Weryfikacja materiałów reklamowych zgodnie z Škoda Brand Guidelines 2024
        </p>

        {/* Upload zone */}
        {!previewUrl && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            style={s({
              border: `1px dashed ${dragOver ? "#78FAAE" : "rgba(120,250,174,0.3)"}`,
              borderRadius: 4, padding: "56px 40px", textAlign: "center", cursor: "pointer",
              background: dragOver ? "rgba(120,250,174,0.04)" : "#111918", marginBottom: 24, transition: "all 0.2s"
            })}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
            <div style={s({ fontSize: 40, marginBottom: 14, opacity: 0.4, color: "#78FAAE" })}>↑</div>
            <div style={s({ fontSize: 14, color: "#CACECF", marginBottom: 6 })}>Wgraj grafikę do weryfikacji</div>
            <div style={s({ fontSize: 11, color: "#6F7979" })}>PNG, JPG, WEBP — do 20MB</div>
          </div>
        )}

        {/* Preview */}
        {previewUrl && (
          <div style={s({ position: "relative", marginBottom: 24 })}>
            <img src={previewUrl} alt="preview" style={s({
              width: "100%", maxHeight: 400, objectFit: "contain",
              background: "#111918", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, display: "block"
            })} />
            <button onClick={reset} style={s({
              position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "5px 12px",
              fontSize: 10, cursor: "pointer", borderRadius: 2, letterSpacing: "0.1em", textTransform: "uppercase"
            })}>
              ✕ Zmień plik
            </button>
          </div>
        )}

        {/* CTA */}
        <button onClick={runCheck} disabled={!imageBase64 || loading} style={s({
          width: "100%",
          background: !imageBase64 || loading ? "#394748" : "#78FAAE",
          color: !imageBase64 || loading ? "#6F7979" : "#0E3A2F",
          border: "none", padding: "17px 32px", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.16em", textTransform: "uppercase",
          cursor: !imageBase64 || loading ? "not-allowed" : "pointer",
          borderRadius: 999, marginBottom: 32, transition: "all 0.2s"
        })}>
          {loading ? loadingMsg : "→ Sprawdź zgodność z brandbook"}
        </button>

        {/* Loading bar */}
        {loading && (
          <div style={s({ width: "100%", height: 2, background: "#182020", borderRadius: 1, marginBottom: 32, overflow: "hidden" })}>
            <style>{`@keyframes scan{0%{transform:translateX(-150%)}100%{transform:translateX(350%)}}`}</style>
            <div style={s({
              height: "100%", background: "linear-gradient(90deg,#78FAAE,#78BFAE)",
              width: "40%", borderRadius: 1, animation: "scan 1.5s ease-in-out infinite"
            })} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={s({ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 4, padding: "18px 22px", color: "#ff9999", fontSize: 13, marginBottom: 24 })}>
            Błąd: {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Score */}
            <div style={s({ display: "flex", alignItems: "center", gap: 28, padding: 28, background: "#111918", borderRadius: 4, marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" })}>
              <div style={s({ width: 88, height: 88, borderRadius: "50%", border: `3px solid ${scoreColor}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, color: scoreColor })}>
                <div style={s({ fontSize: 26, fontWeight: 700, lineHeight: 1 })}>{results.score}</div>
                <div style={s({ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6F7979", marginTop: 2 })}>/ 100</div>
              </div>
              <div>
                <div style={s({ fontSize: 18, fontWeight: 300, marginBottom: 6 })}>{statusLabel}</div>
                <div style={s({ fontSize: 13, color: "#6F7979" })}>
                  {results.violations?.length || 0} naruszenie(ń) · {results.compliant_elements?.length || 0} elementów zgodnych
                </div>
              </div>
            </div>

            {/* Violations */}
            {results.violations?.length > 0 && (
              <>
                <div style={s({ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7979", marginBottom: 10, marginTop: 28 })}>
                  Naruszenia brandbook
                </div>
                {results.violations.map((v, i) => {
                  const sv = SEV[v.severity] || SEV.low;
                  return (
                    <div key={i} style={s({ background: "#111918", borderRadius: 4, padding: "14px 18px", marginBottom: 8, borderLeft: `3px solid ${sv.border}`, display: "flex", gap: 14 })}>
                      <div style={s({ background: sv.bg, color: sv.color, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, flexShrink: 0, alignSelf: "flex-start", marginTop: 2 })}>
                        {sv.label}
                      </div>
                      <div style={s({ flex: 1 })}>
                        <div style={s({ fontSize: 11, color: "#6F7979", marginBottom: 3 })}>{v.rule}</div>
                        <div style={s({ fontSize: 13, color: "#fff", lineHeight: 1.45 })}>{v.observation}</div>
                        {v.suggestion && <div style={s({ fontSize: 11, color: "#78BFAE", marginTop: 6 })}>→ {v.suggestion}</div>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Compliant */}
            {results.compliant_elements?.length > 0 && (
              <>
                <div style={s({ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7979", marginBottom: 10, marginTop: 28 })}>
                  Elementy zgodne
                </div>
                <div style={s({ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 })}>
                  {results.compliant_elements.map((c, i) => (
                    <div key={i} style={s({ background: "rgba(78,200,100,0.1)", border: "1px solid rgba(78,200,100,0.25)", color: "#4BA82E", padding: "5px 12px", borderRadius: 2, fontSize: 12 })}>
                      ✓ {c}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Language errors */}
            {results.language_errors?.length > 0 && (
              <>
                <div style={s({ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7979", marginBottom: 10, marginTop: 28 })}>
                  Błędy językowe
                </div>
                {results.language_errors.map((e, i) => (
                  <div key={i} style={s({ background: "#111918", borderRadius: 4, padding: "14px 18px", marginBottom: 8, borderLeft: "3px solid #F78046", display: "flex", gap: 14, alignItems: "flex-start" })}>
                    <div style={s({ background: "rgba(247,128,70,0.10)", color: "#F78046", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 2, flexShrink: 0, marginTop: 2 })}>
                      {e.type || "literówka"}
                    </div>
                    <div style={s({ flex: 1 })}>
                      <div style={s({ fontSize: 13, color: "#fff", lineHeight: 1.45 })}>
                        <span style={s({ textDecoration: "line-through", color: "#FF6B6B", marginRight: 8 })}>{e.text}</span>
                        <span style={s({ color: "#78FAAE" })}>→ {e.correction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Recommendation */}
            {results.recommendation && (
              <>
                <div style={s({ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7979", marginBottom: 10, marginTop: 28 })}>
                  Rekomendacja
                </div>
                <div style={s({ background: "rgba(120,250,174,0.06)", border: "1px solid rgba(120,250,174,0.15)", borderRadius: 4, padding: "18px 22px" })}>
                  <p style={s({ fontSize: 13, color: "#CACECF", lineHeight: 1.6, fontWeight: 300 })}>{results.recommendation}</p>
                </div>
              </>
            )}

            {/* Analysis — co model zobaczył */}
            {results.analysis && (
              <>
                <div style={s({ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6F7979", marginBottom: 10, marginTop: 28 })}>
                  Co model zobaczył
                </div>
                <div style={s({ background: "#0d1514", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 4, padding: "14px 18px", marginBottom: 8 })}>
                  {Object.entries(results.analysis).map(([key, val]) => (
                    <div key={key} style={s({ display: "flex", gap: 12, marginBottom: 6, fontSize: 12 })}>
                      <div style={s({ color: "#6F7979", minWidth: 140, flexShrink: 0 })}>{key.replace(/_/g, " ")}</div>
                      <div style={s({ color: "#CACECF", lineHeight: 1.4 })}>
                        {Array.isArray(val) ? val.join(" · ") : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
