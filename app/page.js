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
          system: `Jesteś konserwatywnym audytorem materiałów Škoda. Twoja rola to znajdowanie PEWNYCH naruszeń, nie zgadywanie.

ZASADY NADRZĘDNE — przeczytaj je zanim cokolwiek ocenisz:

1. DOMNIEMANIE ZGODNOŚCI: jeśli nie jesteś w 95% pewny że to naruszenie — NIE flaguj. Wątpliwość = zgodność.
2. TYLKO TO CO WIDZISZ: flaguj wyłącznie na podstawie tego co jest wyraźnie widoczne na grafice. Nie zakładaj że coś jest złe jeśli nie możesz tego konkretnie wskazać.
3. KOLORY: Škoda ma DWA dozwolone zielone — Emerald Green (#0E3A2F, ciemny) i Electric Green (#78FAAE, jasny neonowy). OBA są poprawne. Nie flaguj żadnego z nich jako błąd. Flaguj tylko kolory które są wyraźnie spoza palety (np. niebieski, czerwony, żółty użyte jako tło lub główny kolor).
4. FACETY: Zawsze identyfikuj czy facety są obecne i opisz ich kolor w compliant_elements. NIE oceniaj kąta — to niemożliwe bez narzędzi pomiarowych. Flaguj facety tylko jeśli są wyraźnie równoległe do krawędzi (0°/90°), nakładają się na siebie, lub mają cień/przezroczystość. Facety NIE są obowiązkowym elementem każdej grafiki — brak facetu to NIE naruszenie.
5. LOGO: flaguj tylko jeśli logo jest wyraźnie zniekształcone, obrócone, ma złe proporcje lub jest nieczytelne. Nie flaguj rozmiaru jeśli jest czytelne.
6. TYPOGRAFIA: Nazwa marki w copy MUSI być pisana "Škoda" (z háčkiem, wielka S, reszta mała). Flaguj jeśli widzisz "SKODA" (bez háčka, full caps) w treści copy — ale NIE flaguj wordmarku/logotypu. Slogany "Let's get Škoda" i "Life gets Škoda" oraz ich warianty ("Życie nabiera Škody", "Lato nabiera Škody") są DOZWOLONE i prawidłowe. Flaguj tylko jeśli tekst w body copy lub nagłówkach jest napisany FULL CAPSEM i nie jest logotypem ani oficjalną nazwą modelu.
- KLUCZOWE: Jezeli widzisz "SKODA!" lub "SZKODA!" jako element graficzny w ukladzie gdzie obok widnieje tekst "Let\'s get" lub "Life gets" — to jest dozwolony slogan, NIE flaguj. Wielkie litery w tym kontekscie sa czescia zatwierdzonego hasla.
- Warianty z nazwa modelu: "Let\'s get Octavia!", "Let\'s get Enyaq!", "Let\'s get Fabia!" itp. — rowniez dozwolone.
- Jezeli "SKODA!" lub nazwa modelu caps pojawia sie jako duzy element graficzny obok sloganu — traktuj to jako element wizualny sloganu, nie naruszenie.
7. MAXIMUM 3 naruszenia — tylko te których jesteś absolutnie pewny. Lepiej znaleźć 1 prawdziwy błąd niż 5 fałszywych alarmów.

LISTA RZECZY KTÓRYCH ABSOLUTNIE NIE WOLNO CI FLAGOWAĆ:

WORDMARK / LOGO:
- Wordmark "ŠKODA" lub "SKODA" pisany wielkimi literami — to jest prawidłowy logotyp, NIE naruszenie reguły capslock. Reguła capslock dotyczy tylko copy i nagłówków, nie logo.
- Rozmiar wordmarku — brandbook nie określa maksymalnego rozmiaru logo, tylko clear space. Nie flaguj że logo jest "za duże" jeśli clear space jest zachowany.
- Pozycja logo (góra, dół, róg, centrum) — wszystkie pozycje są dozwolone według brandbooka.
- Spacing wordmarku (100%, 130%, 160%) — wszystkie wersje są prawidłowe.
- Logo na zielonym tle (Electric Green lub Emerald Green) — brandbook NAKAZUJE uzywac bialego lub ciemnego logo na zielonym tle. Biale lub ciemne logo na zielonym tle jest PRAWIDLOWE. NIE flaguj kontrastu w takiej sytuacji.
- Jedyne naruszenie kontrastu logo: jasne Electric Green logo na jasnym Electric Green tle (jasne na jasnym) — wyraznie nieczytelne. We wszystkich innych kombinacjach zakladaj prawidlowy kontrast.

NAZWY MODELI:
- Nazwy modeli Škoda często mają niestandarowe zapisy: "iV", "RS", "4x4", "e-TEC" — to są oficjalne nazwy, NIE naruszenia capslock. Nie kwestionuj pisowni nazw modeli.
- "Enyaq", "Octavia", "Karoq", "Kodiaq", "Fabia", "Scala", "Kamiq" — to są prawidłowe mieszane kapitalizacje.

PRICE TAG:
- Price tag w kształcie ukośnika, rombu lub trapeza — prawidłowy "angular label" zgodny z brandbook. NIE flaguj kształtu price tagu.
- Price tag używany razem z innymi elementami — dozwolony w print i digital.

FACETY:
- Kąt facetu który wygląda na około 10-35 stopni — prawidłowy. Nie jesteś w stanie zmierzyć kąta ze zdjęcia.
- Kolor facetu Electric Green lub Emerald Green — oba prawidłowe, pod warunkiem że nie są oba w tym samym layoucie.
- Liczba facetów 1, 2 lub 3 — prawidłowa.
- Brak facetów w grafice — NIE jest naruszeniem. Facety są opcjonalnym elementem identyfikacji wizualnej.

FOTOGRAFIA:
- Jakość zdjęcia, styl fotografii, oświetlenie — nie oceniaj, to poza zakresem brandbooka CI/CD.
- Obecność samochodu, ludzi, przyrody na zdjęciu — nie oceniaj treści fotografii.

CLEAR SPACE:
- NIE szacuj clear space jeśli nie możesz go precyzyjnie zmierzyć. Brak pewności = brak flagi.

CO MOŻESZ FLAGOWAĆ (tylko jeśli jesteś absolutnie pewny):
- Logo Electric Green (#78FAAE) na tle Electric Green — brak kontrastu, nieczytelne
- Logo Electric Green (#78FAAE) na tle Emerald Green (#0E3A2F) — może być za mały kontrast, flaguj tylko jeśli wyraźnie nieczytelne
- Użycie koloru tertiary (czerwony, niebieski, żółty, pomarańczowy) jako dominującego koloru tła lub elementu brandowego
- Tekst body copy lub nagłówek napisany FULL CAPSEM który nie jest logotypem ani nazwą modelu
- Facety wyraźnie równoległe (0° lub 90° do krawędzi)
- Facety nakładające się na siebie
- Użycie zarówno Electric Green jak i Emerald Green na facetach w tym samym layoucie
- Font wyraźnie inny niż sans-serif (np. szeryfowy, handwriting)

WYTYCZNE BRANDBOOK:
${BRANDBOOK_RULES}

ZASADY SCORINGU — stosuj je ściśle:
- 0 naruszeń = score 100, status OK
- 1 naruszenie low = score 90, status MINOR
- 1 naruszenie medium = score 75, status MINOR
- 1 naruszenie high = score 55, status MAJOR
- 2 naruszenia (mix) = score 40-50, status MAJOR
- 3 naruszenia = score 25, status MAJOR
NIE zaniżaj score jeśli nie masz pewnych naruszeń. 0 naruszeń = zawsze 100.

Zwróć TYLKO czysty JSON bez markdown:
{"score":0-100,"status":"OK|MINOR|MAJOR","violations":[{"rule":"...","observation":"opis tego co KONKRETNIE widzisz na grafice, w którym miejscu","severity":"low|medium|high","suggestion":"..."}],"compliant_elements":["..."],"recommendation":"..."}`,
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
          </div>
        )}
      </div>
    </div>
  );
}
