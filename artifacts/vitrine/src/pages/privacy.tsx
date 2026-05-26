import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useT } from "@/lib/i18n";

export default function Privacy() {
  const { t, locale } = useT();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-8">{t.privacy.title}</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
          <p className="text-lg">{t.privacy.lastUpdated} {new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{t.privacy.s1}</h2>
          <p>{t.privacy.s1p}</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">{t.privacy.s1l.map((l, i) => <li key={i}>{l}</li>)}</ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{t.privacy.s2}</h2>
          <p>{t.privacy.s2p}</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">{t.privacy.s2l.map((l, i) => <li key={i}>{l}</li>)}</ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{t.privacy.s3}</h2>
          <p>{t.privacy.s3p}</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">{t.privacy.s3l.map((l, i) => <li key={i}>{l}</li>)}</ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{t.privacy.s4}</h2>
          <p>{t.privacy.s4p}</p>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{t.privacy.s5}</h2>
          <p>{t.privacy.s5p}</p>
          <p className="mt-4 font-medium">privacy@globalbarber.com</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
