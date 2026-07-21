import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "FIN//SIGHT | Fin-height inspection twin",
  description: "An interactive digital twin for laser and rolling-LVDT radiator fin-height inspection.",
  openGraph: {
    title: "FIN//SIGHT | Fin-height inspection twin",
    description: "Two practical measurement paths. One traceable inspection decision.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
