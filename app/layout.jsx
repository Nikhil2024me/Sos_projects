/*
 * Adivasi Suraksha - root layout (Next.js App Router).
 *
 * Keeps the original document language and metadata, and loads the two
 * stylesheets the dashboard expects: the vendored Leaflet CSS first, then the
 * site styles. React 19 hoists these <link> tags into <head>.
 */
export const metadata = {
  title: "Adivasi Suraksha \u2014 disaster warnings for tribal India",
  description:
    "Live satellite fire, flood, heat, storm and earthquake alerts for 30 tribal districts of India, in English, Hindi and 10 regional languages.",
  applicationName: "Adivasi Suraksha",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
  openGraph: {
    title: "Adivasi Suraksha \u2014 a warning for the last village",
    description:
      "Live disaster warnings for 30 tribal districts of India. Fire, flood, heat, storm and earthquakes, in English, Hindi and 10 regional languages.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173f30",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <link rel="stylesheet" href="/vendor/leaflet/leaflet.css" precedence="default" />
        <link rel="stylesheet" href="/styles.css" precedence="default" />
        {children}
      </body>
    </html>
  );
}
