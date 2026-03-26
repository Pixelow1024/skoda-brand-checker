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
          max_tokens: 1500,
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
1. DOMNIEMANIE ZGODNOŚCI: jeśli nie jesteś w 95% pewny że to naruszenie — NIE flaguj.
2. TYLKO TO CO WIDZISZ: flaguj wyłącznie to co konkretnie widzisz. Nie zakładaj błędów których nie możesz wskazać.
3. MAXIMUM 3 naruszenia — tylko te których jesteś absolutnie pewny.
4. MATERIAŁY POLSKIE: oceniamy polskie materiały. Tekst po angielsku w sloganach (Let\'s get, Life gets) jest dozwolony.

KOLORY:
- Dozwolone dominujące: Emerald Green (#0E3A2F), Electric Green (#78FAAE), czerń, biel, fotografia.
- Kolory tertiary (czerwony, niebieski, żółty, pomarańczowy) jako dominujące tło lub główny element brandowy — naruszenie HIGH.
- Kolor samochodu na zdjęciu NIE jest kolorem brandowym — nie oceniaj koloru auta.

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

REGUŁA GŁÓWNA — HIGH (-45 pkt):
Logo Škoda MUSI zawsze towarzyszyć jednemu z dwóch sloganów:
- "Let's get ŠKODA!" (duży element graficzny z wordmarkiem)
- "Life gets ŠKODA" (duży element graficzny z wordmarkiem)
Jeśli logo Škoda jest obecne BEZ żadnego z tych sloganów = naruszenie HIGH.

REGUŁA DODATKOWA — LOW (-10 pkt):
Jeśli jest "Let's get ŠKODA!" ale NIE MA wcześniej w copy nagłówka "Let's get [nazwa modelu]!" = naruszenie LOW.

POCHYLENIE SLOGANU — LOW (-10 pkt):
Slogan "Let's get ŠKODA!" lub "Life gets ŠKODA" powinien być pochylony/pod kątem. Jeśli poziomy = naruszenie LOW.

DOZWOLONE:
- "Let's get ŠKODA!" + "Let's get [model]!" = pełny prawidłowy format
- "Life gets ŠKODA" + copy o życiu/odkrywaniu = prawidłowy format
- Warianty w copy: "Życie nabiera Škody", "Lato nabiera Škody" = dozwolone jako copy ale NIE zastępują sloganu graficznego
- "ŠKODA!" jako część sloganu graficznego = element wizualny, NIE flaguj jako capslock
- "SKODA" bez háčka w elemencie graficznym sloganu "Let's get" lub "Life gets" = PRAWIDŁOWE. To jest specjalny font brandowy gdzie háček jest wbudowany w kształt litery S. NIGDY nie flaguj braku háčka w tym elemencie.
- Slogan graficzny "Let's get ŠKODA!" lub "Life gets ŠKODA" nie podlega zasadzie háčka w copy — to jest logotyp, nie tekst.

TYPOGRAFIA:
- Nazwa marki w copy: zawsze "Škoda" (z háčkiem). "SKODA" bez háčka w body copy — naruszenie MEDIUM.
- WYJĄTEK KRYTYCZNY: Element graficzny sloganu "Let's get ŠKODA!" lub "Life gets ŠKODA" używa specjalnego fontu brandowego gdzie háček jest wbudowany w kształt litery S. NIE flaguj braku háčka w tym elemencie — to jest prawidłowy logotyp graficzny. Zasada háčka dotyczy TYLKO zwykłego tekstu copy, nie elementu sloganu graficznego.
- Full caps w nagłówkach i body copy — naruszenie MEDIUM. Wyjątki: logotyp, nazwy modeli (iV, RS, 4x4).
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
- Button CTA: zaokrąglony (pill), Electric Green, tekst call-to-action (Sprawdź, Odkryj, itp.).
- Eyecatcher: trapezowy element (ścięty z jednej strony), komunikat ofertowy (cena, benefit).
- ZAKAZ łączenia: button CTA i eyecatcher trapezowy w tym samym materiale — naruszenie HIGH.

CO-BRANDING I OBCE MARKI:
- Obca marka dominująca (logo lub nazwa ≥ wordmark Škody) — BLOCKER, score 0.
- Obca marka obecna ale marginalna (małe logo dealera, drobny co-branding) — naruszenie HIGH (-45 pkt).
- Drobne disclaimery prawne w małym druku — dozwolone, nie flaguj.

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
- Logo Škoda BEZ towarzyszącego sloganu "Let's get ŠKODA!" lub "Life gets ŠKODA" — obowiązkowe
- Kolory tertiary (czerwony, niebieski, żółty) jako dominujące tło lub element brandowy

LOW (-10 pkt, status MINOR):
- Logo nie po prawej stronie
- "Let's get ŠKODA!" BEZ nagłówka "Let's get [model]!" w copy
- Slogan "Let's get" lub "Life gets" napisany poziomo zamiast pochylony

MEDIUM (-25 pkt, status MINOR):
- Full caps w nagłówkach lub body copy (nie dotyczy logotypu i nazw modeli)
- "SKODA" bez háčka w treści copy
- Logo w złym kolorze (nie Electric Green #78FAAE ani biały)
- Drop shadow pod tekstem — SILNA REKOMENDACJA ZMIANY, bardzo częsty błąd obniżający jakość



INFO (0 pkt odejmowania — tylko rekomendacja w polu recommendation):
- Render studyjny/cyklorama zamiast naturalnego zdjęcia — zaznacz w rekomendacji że preferowane jest naturalne zdjęcie z otoczeniem

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
    "logo_color": "opisz dokładnie kolor logo który widzisz",
    "format_orientation": "poziomy (landscape, szerokość > wysokość) / pionowy (portrait, wysokość > szerokość) / kwadratowy",
    "logo_position": "wybierz DOKŁADNIE jeden z: [lewy górny róg] / [centrum góry] / [prawy górny róg] / [lewy dolny róg] / [centrum dołu] / [prawy dolny róg] / [centrum]. Dla formatu poziomego: prawy dolny róg i prawa strona to jedyne prawidłowe pozycje. Dla formatu pionowego: centrum dołu jest dozwolone jeśli slogan/logo zajmuje całą szerokość.",
    "logo_position_valid": true/false,
    "background_colors": "wymień WSZYSTKIE kolory tła które widzisz — w tym smugi, gradienty, kolory dymu, kolory świateł",
    "tertiary_colors_present": "czy widzisz czerwony/niebieski/żółty/różowy/fioletowy jako dominujące elementy tła? tak/nie — jeśli tak, wymień które",
    "texts": ["wypisz KAŻDY tekst który widzisz z dokładną kapitalizacją — w tym disclaimer, copyright, adresy"],
    "facets": "opisz czy są facety, ile, jaki kolor, czy są solid wypełnione czy wireframe/outline",
    "photo_type": "naturalne zdjęcie z otoczeniem / render studyjny na gradientowym tle / render na białej cykloramie / render na szarej cykloramie",
    "button_cta": "opisz button jeśli jest: kształt (pill/kwadrat/inny), kolor, tekst",
    "eyecatcher": "opisz eyecatcher trapezowy jeśli jest: tekst, czy jest obok buttona CTA?",
    "foreign_brands": "wymień WSZYSTKIE obce marki, logotypy, nazwy firm które widzisz — w tym małe napisy, lub napisz 'brak'",
    "lets_get_skoda_present": "tak/nie — czy na grafice widnieje napis 'Let's get ŠKODA!' lub 'Let's get Skoda!' lub 'Let's get SKODA!' (duży element graficzny z wordmarkiem Škody). UWAGA: brak háčka w tym elemencie jest PRAWIDŁOWY — to specjalny font brandowy.",
    "life_gets_skoda_present": "tak/nie — czy na grafice widnieje napis 'Life gets ŠKODA' lub 'Life gets Skoda'",
    "lets_get_model_present": "tak/nie + jaki model — czy w copy jest nagłówek 'Let's get [nazwa modelu]!' np. 'Let's get Superb!', 'Let's get Fabia!'",
    "slogan_tilted": "tak/nie — czy slogan Let's get lub Life gets jest pochylony/pod kątem, czy napisany poziomo"
  },
  "score": 0-100,
  "status": "OK|MINOR|MAJOR",
  "violations": [{"rule": "...", "observation": "opis oparty na tym co napisałeś w analysis", "severity": "low|medium|high", "suggestion": "..."}],
  "compliant_elements": ["..."],
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
      setResults(JSON.parse(raw));
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
