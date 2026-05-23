export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Segoe UI, sans-serif", margin: 0, padding: "1rem" }}>
        <header style={{ marginBottom: "1rem", borderBottom: "1px solid #D5DADF" }}>
          <strong>ERA Auto STO</strong>
        </header>
        {children}
      </body>
    </html>
  );
}
