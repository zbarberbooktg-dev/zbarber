import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { useState } from 'react';
import { ArrowRight, Heart, MapPin, Search, Scissors, Volume2, VolumeX } from 'lucide-react';
import { Guidelines } from './parts';

const CORE_SWATCHES = [
  { name: 'Primary', className: 'bg-primary' },
  { name: 'Secondary', className: 'bg-secondary' },
  { name: 'Accent', className: 'bg-accent' },
] as const;

const SUPPORTING_SWATCHES = [
  { name: 'Background', className: 'border bg-background' },
  { name: 'Foreground', className: 'bg-foreground' },
  { name: 'Muted', className: 'bg-muted' },
  { name: 'Destructive', className: 'bg-destructive' },
  { name: 'Border', className: 'bg-border' },
] as const;

const TYPE_SCALE = [
  { label: 'Display', className: 'text-4xl font-bold' },
  { label: 'Heading', className: 'text-2xl font-semibold' },
  { label: 'Body', className: 'text-base' },
  { label: 'Label', className: 'text-sm font-medium' },
  { label: 'Caption', className: 'text-sm text-muted-foreground' },
] as const;

const SPACING_SCALE = [
  { label: '4', className: 'w-4' },
  { label: '8', className: 'w-8' },
  { label: '12', className: 'w-12' },
  { label: '16', className: 'w-16' },
  { label: '24', className: 'w-24' },
] as const;

function Swatch({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`h-16 rounded-lg ${className}`} />
      <p className="text-sm font-medium">{name}</p>
    </div>
  );
}

export function OverviewPage() {
  const [favorite, setFavorite] = useState(false);
  const [muted, setMuted] = useState(true);
  const [action, setAction] = useState('');
  return (
    <div className="space-y-4">
      <section className="grid gap-6 rounded-xl bg-card p-6 text-card-foreground lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Zbarber · Première direction visuelle</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight">Le style commence<br />par la simplicité.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Noir profond, or champagne et surfaces sobres. Une recherche claire, des images mieux cadrées
            et des actions faciles à reconnaître.
          </p>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Aperçu des composants, pas encore l’accueil intégré. Aucun salon, avis ou distance fictif.
          </p>
        </div>
        <div className="rounded-xl border bg-background p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Zbarber</span>
            <span className="text-xs text-muted-foreground">Aperçu des commandes</span>
          </div>
          <label className="relative mt-5 block">
            <Search aria-hidden className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input aria-label="Exemple de recherche" placeholder="Salon, ville, quartier…" className="min-h-11 border-transparent bg-card pl-10" />
          </label>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Favoris et audio</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="icon" className="size-11"
                aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={favorite}
                onClick={() => setFavorite((value) => !value)}>
                <Heart className={favorite ? 'fill-primary text-primary' : ''} />
              </Button>
              <Button variant="secondary" size="icon" className="size-11"
                aria-label={muted ? 'Activer le son' : 'Couper le son'} aria-pressed={!muted}
                onClick={() => setMuted((value) => !value)}>
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
            </div>
          </div>
          <Button className="mt-5 min-h-11 w-full" onClick={() => setAction('Bouton principal testé. Dans l’application, il ouvrira le catalogue existant.')}>
            Découvrir les salons <ArrowRight />
          </Button>
          <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">{action}</p>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5 text-card-foreground">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Palette principale
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Typographie
          </h2>
          <div className="mt-4 space-y-3">
            <p className="font-serif text-3xl">À découvrir</p>
            <p className="font-serif text-xl">Journal Zbarber</p>
            <p className="text-sm">Un salon, un style, votre prochain rendez-vous.</p>
            <p className="text-xs text-muted-foreground">Inter pour les informations · Playfair Display pour les titres</p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Carte sans photo · Gabarit
          </h2>
          <Card className="mt-4">
            <div className="relative m-4 mb-0 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-secondary">
              <span aria-hidden className="font-serif text-8xl text-foreground/10">Z</span>
              <Scissors aria-hidden className="absolute size-8 text-muted-foreground" />
            </div>
            <CardHeader>
              <CardTitle className="font-serif font-medium">Nom du salon</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-3" /> Localisation réelle, si disponible</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs leading-5 text-muted-foreground">Gabarit de composant sans données métier. Aucune note ni distance n’est affichée si elle n’existe pas.</p>
              <div className="flex items-center gap-2">
                <Switch id="overview-notify" />
                <Label htmlFor="overview-notify">Exemple d’interrupteur</Label>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Components
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Badge>Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
        <h2 className="font-serif text-xl">Les règles de cette direction</h2>
        <Guidelines items={[
          { kind: 'do', text: 'Réserver l’or champagne aux actions importantes et aux accents discrets.' },
          { kind: 'do', text: 'Garder les couvertures en 4:3, arrondies et non déformées, avec le texte en dessous.' },
          { kind: 'do', text: 'Préserver toutes les informations réelles et masquer celles qui ne sont pas disponibles.' },
          { kind: 'dont', text: 'Ajouter des bordures dorées partout, des ombres lourdes ou des données fictives.' },
        ]} />
        <p className="text-xs text-muted-foreground">Le thème clair est une déclinaison proposée de la direction sombre fournie.</p>
      </section>
    </div>
  );
}

export function ColorsPage() {
  return (
    <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Brand colors</h2>
          <p className="text-sm text-muted-foreground">
            The core roles used for emphasis, supporting actions, and accents.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Semantic and surface colors</h2>
          <p className="text-sm text-muted-foreground">
            Roles for text, backgrounds, borders, muted content, and danger.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SUPPORTING_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function FontsPage() {
  return (
    <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Font family
        </h2>
        <p className="mt-4 text-4xl font-bold">The quick brown fox</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The token font family is applied across this entire preview.
        </p>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Type scale
        </h2>
        {TYPE_SCALE.map((entry) => (
          <div key={entry.label} className="grid gap-2 sm:grid-cols-[88px_1fr]">
            <span className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </span>
            <p className={entry.className}>Build products people understand.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LayoutPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Spacing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The spacing scale, derived from the base spacing token.
        </p>
        <div className="mt-6 space-y-4">
          {SPACING_SCALE.map((space) => (
            <div key={space.label} className="flex items-center gap-4">
              <span className="w-8 text-xs text-muted-foreground">
                {space.label}
              </span>
              <div className={`h-3 rounded-full bg-primary ${space.className}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Radius</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Corner treatments derive from the base radius token.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Small', className: 'rounded-sm' },
            { label: 'Medium', className: 'rounded-md' },
            { label: 'Large', className: 'rounded-lg' },
            { label: 'Extra large', className: 'rounded-xl' },
          ].map((radius) => (
            <div
              key={radius.label}
              className={`flex h-24 items-end border bg-muted p-3 ${radius.className}`}
            >
              <span className="text-xs font-medium">{radius.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
