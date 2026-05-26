import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useT } from "@/lib/i18n";
import { LEGAL } from "@workspace/legal-content";

export default function Privacy() {
  const { locale, lang } = useT();
  const doc = LEGAL[lang].privacy;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-8">{doc.title}</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
          <p className="text-lg">{doc.lastUpdated} {new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          {doc.sections.map((s, i) => (
            <div key={i}>
              <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">{s.heading}</h2>
              {s.body && <p>{s.body}</p>}
              {s.list && (
                <ul className="list-disc pl-6 space-y-2 mt-4">
                  {s.list.map((l, j) => <li key={j}>{l}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
