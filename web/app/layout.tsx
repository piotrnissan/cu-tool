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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
