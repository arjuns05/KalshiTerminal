export const metadata = {
  title: "Kalshi Terminal",
  description: "Terminal-like UI scaffold"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        {children}
      </body>
    </html>
  );
}
