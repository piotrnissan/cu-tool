import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Component Usage Tool",
  description: "Cross-market automotive website component usage analyzer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <head>
        <style>{`
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
            font-family: system-ui, -apple-system, sans-serif;
          }

          @media (prefers-color-scheme: dark) {
            body {
              background: #0b0b0f;
              color: #f5f5f5;
            }

            input, select, textarea {
              background: #1a1a1f;
              color: #f5f5f5;
              border-color: #444;
            }

            a {
              color: #88c0ff;
            }

            a:visited {
              color: #bb88ff;
            }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
