"use client";
import { useState, useRef, useCallback } from "react";

const BRANDBOOK_RULES = `
ŠKODA BRAND GUIDELINES 2024

=== LOGO / WORDMARK ===
- Dozwolone kolory logo: Emerald Green (#0E3A2F), Electric Green (#78FAAE), Biały, Czarny. NIGDY szary.
- Clear space: co najmniej 1 BU (wysokość wordmarku) ze wszystkich stron.
- Logo NIE MOŻE być: przycinane, obracane, zniekształcane, odbijane, rozciągane, z cieniem.
- Logo musi być czytelne — kontrast z tłem obowiązkowy.
- Minimalny rozmiar ekranowy: 15px wysokości.

=== KOLORY PRIMARY ===
- Emerald Green: #0E3A2F
- Electric Green: #78FAAE (cyfrowy akcent neonowy)

=== KOLORY SECONDARY ===
- Black, Dark Grey #394748, Stone Grey #6F7979, Medium Grey #CACECF, White
- Używane tylko jako neutral/supporting

=== KOLORY TERTIARY — TYLKO w infografikach ===
- Red, Blue, Teal, Yellow, Orange
- ZAKAZ w reklamach i digital ads

=== TYPOGRAFIA ===
- Font: Škoda Next (Light i Bold)
- Mixed casing — ZAKAZ CAPSLOCKA dla nagłówków i nazw modeli
- Kolory tekstu: Emerald Green, Electric Green, Black, White
- Tekst NIE MOŻE być nieczytelny — obowiązkowy kontrast

=== FACETY ===
- Kąt: 10° do 35°. ZAKAZ: 0°, 45°, 90°
- Max 3 facety (OOH), 2 (digital), 2 (dealer print)
- Kolory: TYLKO Electric lub Emerald. ZAKAZ mieszania obu w jednym layoucie.
- ZAKAZ cieni i przezroczystości na facetach
- Facety NIE MOGĄ się nakładać ani nakrywać ważnych części fotografii

=== LAYOUT ===
- Zasady: Contrast, Clarity, Dynamic
- Margines: min. 1 BU od krawędzi
- ZAKAZ gradientów na elementach brandowych

=== CTA BUTTON ===
- Tylko w digital media. Kolory: Electric Green, Emerald Green lub Black.
- ZAKAZ łączenia CTA i price tag w tym samym materiale.
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
          system: `Jesteś ekspertem audytorem materiałów marketingowych Škoda. Oceniasz zgodność grafiki z brandbook Škoda 2024.\n\nWYTYCZNE:\n${BRANDBOOK_RULES}\n\nZwróć TYLKO czysty JSON bez markdown:\n{"score":0-100,"status":"OK|MINOR|MAJOR","violations":[{"rule":"...","observation":"...","severity":"low|medium|high","suggestion":"..."}],"compliant_elements":["..."],"recommendation":"..."}`,
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
