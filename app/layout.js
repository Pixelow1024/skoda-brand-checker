export const metadata = {
  title: "Škoda Brand Compliance Checker",
  description: "Weryfikacja materiałów reklamowych zgodnie z Škoda Brand Guidelines 2024",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
