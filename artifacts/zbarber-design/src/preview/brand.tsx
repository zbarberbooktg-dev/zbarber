import { Guidelines } from './parts';

export function BrandPage() {
  return (
    <section className="space-y-6 rounded-xl border bg-card p-6">
      <img src={`${import.meta.env.BASE_URL}zbarber-icon.png`} alt="Icône Zbarber existante"
        className="size-24 rounded-xl" />
      <h2 className="font-serif text-3xl">Zbarber · Noir & Champagne</h2>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        Le logo existant est conservé. La palette est modernisée pour un accueil
        plus compact et plus lisible, sans modifier l’identité du service.
      </p>
      <Guidelines items={[
        { kind: 'do', text: 'Conserver le logo Zbarber et réserver l’or aux accents essentiels.' },
        { kind: 'dont', text: 'Ajouter des décorations, dégradés agressifs ou bordures dorées excessives.' },
      ]} />
    </section>
  );
}
