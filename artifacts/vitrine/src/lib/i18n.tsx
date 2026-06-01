import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

export const translations = {
  fr: {
    nav: {
      features: "Fonctionnalités",
      forBarbers: "Pour les barbiers",
      pricing: "Tarifs",
      faq: "FAQ",
      download: "Télécharger l'app",
      toggleTheme: "Changer de thème",
    },
    hero: {
      badge: "Le réseau premium du grooming",
      title1: "Le savoir-faire africain",
      title2: "rencontre la technologie",
      subtitle:
        "Découvrez des barbiers d'élite, réservez instantanément et élevez votre expérience grooming. Conçu pour les clients exigeants et les barbiers d'exception.",
    },
    about: {
      eyebrow: "Deux faces, un même écosystème",
      title: "Plus qu'une app. Une communauté.",
      lead:
        "Zbarber connecte le talent exceptionnel des barbiers africains aux clients en quête d'un grooming premium. Nous gérons la friction, vous vous concentrez sur l'art.",
      forClients: "Pour les clients",
      forClientsDesc:
        "Trouvez les meilleurs barbiers à proximité, réservez instantanément sans téléphoner et payez sans friction. Votre standard, sublimé.",
      forBarbers: "Pour les barbiers",
      forBarbersDesc:
        "Gérez votre agenda, créez un portfolio digital, acceptez les paiements et accédez à du financement pour développer votre activité.",
      quote: "Cette plateforme a changé ma façon de gérer mon salon. Plus de clients, moins de paperasse.",
      quoteAuthor: "— Diallo, Maître barbier",
    },
    features: {
      title1: "Tout ce qu'il vous faut.",
      title2: "Rien de superflu.",
      subtitle:
        "Des outils puissants conçus pour le workflow unique des salons de barbiers africains premium.",
      items: [
        { title: "Recherche de proximité", desc: "Découvrez les barbiers d'élite de votre quartier avec disponibilité en temps réel." },
        { title: "Réservation intelligente", desc: "Réservations en libre-service 24/7. Plus d'appels manqués ni de double-booking." },
        { title: "Avis vérifiés", desc: "Retours authentiques de vrais clients. Une réputation bâtie sur le mérite." },
        { title: "Portfolio digital", desc: "Mettez en valeur vos plus belles coupes. Laissez votre art parler pour vous." },
        { title: "Statistiques business", desc: "Suivez les revenus, la fidélité et les heures de pointe pour optimiser le salon." },
        { title: "Communauté barbiers", desc: "Connectez-vous à d'autres pros, partagez vos techniques, trouvez des talents." },
      ],
    },
    showcase: {
      title: "Élégant. Rapide. Pro.",
      bookingConfirmed: "Réservation confirmée",
      todayAt: "Aujourd'hui à 14h00",
      topBarber: "Barbier le mieux noté",
      rating: "5,0 ★ (120 avis)",
    },
    pricing: {
      eyebrow: "Pour barbiers & salons",
      title: "Investissez dans votre art.",
      subtitle: "Tarification transparente pour développer votre activité à votre rythme.",
      freeTitle: "Profil Standard",
      freeDesc: "Parfait pour les barbiers indépendants qui démarrent leur présence digitale.",
      free: "Gratuit",
      forever: "/toujours",
      freeFeatures: [
        "Profil professionnel basique",
        "Recevez des réservations via la plateforme",
        "Visibilité standard dans la recherche",
        "Portfolio basique (jusqu'à 10 photos)",
        "Commission de 15 % sur les réservations",
      ],
      freeCta: "Commencer gratuitement",
      premiumTitle: "Global Premium",
      premiumDesc: "Pour les salons établis et les barbiers à fort volume.",
      perMonth: "/mois",
      mostPopular: "Le plus populaire",
      premiumFeatures: [
        "Profil premium avec bannière vidéo",
        "Classement prioritaire dans les recherches locales",
        "Photos de portfolio illimitées",
        "0 % de commission sur les réservations",
        "Statistiques business avancées",
        "Accès au programme de financement matériel",
        "Marketing automatisé vers vos anciens clients",
      ],
      premiumCta: "Passer à Premium",
    },
    ctaBarbers: {
      title: "Prêt à faire passer votre salon au niveau supérieur ?",
      desc: "Rejoignez des centaines de barbiers africains de premier plan qui développent leur clientèle avec Zbarber.",
      become: "Devenir partenaire",
      benefits: "Voir les avantages partenaires",
    },
    faq: {
      title: "Questions fréquentes",
      items: [
        { q: "Comment réserver un rendez-vous ?", a: "Téléchargez l'app, créez un compte et autorisez la géolocalisation pour trouver des barbiers à proximité. Choisissez un barbier, un service, un créneau et confirmez." },
        { q: "Puis-je payer via l'app ?", a: "Oui. Zbarber propose des paiements sécurisés intégrés. Carte bancaire ou mobile money local — vous payez avant même de quitter le fauteuil." },
        { q: "Comment devenir barbier partenaire ?", a: "Cliquez sur « Devenir partenaire » pour envoyer votre candidature. Notre équipe étudie votre portfolio et vos références. Une fois approuvé, vous configurez votre profil et acceptez les réservations." },
        { q: "Qu'est-ce que le programme de financement matériel ?", a: "Les partenaires Premium avec un historique régulier peuvent demander un micro-financement pour renouveler leurs outils, acheter de nouveaux fauteuils ou rénover leur espace." },
        { q: "Que se passe-t-il si je dois annuler ?", a: "Vous pouvez annuler depuis l'app jusqu'à 24 h avant le rendez-vous sans pénalité. Les annulations tardives peuvent être facturées selon la politique du barbier." },
        { q: "L'app est-elle disponible dans ma ville ?", a: "Nous opérons à Abidjan, Dakar et Nairobi, avec une expansion rapide en Afrique de l'Ouest et de l'Est. Téléchargez l'app pour vérifier la disponibilité dans votre quartier." },
      ],
    },
    contact: {
      title: "Contactez-nous",
      lead:
        "Une question sur la plateforme ? Envie de devenir partenaire ? Notre équipe est là pour vous aider.",
      address: "Abidjan, Côte d'Ivoire",
      name: "Nom",
      namePh: "Votre nom",
      email: "Email",
      emailPh: "Votre email",
      message: "Message",
      messagePh: "Comment pouvons-nous vous aider ?",
      send: "Envoyer le message",
    },
    footer: {
      tagline:
        "L'artisanat africain rencontre la technologie moderne. La plateforme de référence pour le grooming d'élite et la gestion de salon.",
      product: "Produit",
      forClients: "Pour les clients",
      forBarbers: "Pour les barbiers",
      pricing: "Tarifs",
      download: "Télécharger l'app",
      company: "Entreprise",
      about: "À propos",
      careers: "Carrières",
      privacy: "Politique de confidentialité",
      terms: "Conditions d'utilisation",
      accountDeletion: "Supprimer mon compte",
      stay: "Restez informé",
      newsletter: "Abonnez-vous à notre newsletter pour des conseils grooming et les actualités de la plateforme.",
      emailPh: "Adresse email",
      copyright: "Tous droits réservés.",
      slogan: "L'excellence africaine, exprimée digitalement.",
    },
    notFound: {
      title: "404 — Page introuvable",
      desc: "La page que vous cherchez n'existe pas.",
    },
    language: "Langue",
  },
  en: {
    nav: {
      features: "Features",
      forBarbers: "For Barbers",
      pricing: "Pricing",
      faq: "FAQ",
      download: "Download App",
      toggleTheme: "Toggle theme",
    },
    hero: {
      badge: "The Premium Grooming Network",
      title1: "African Craftsmanship",
      title2: "Meets Modern Tech",
      subtitle:
        "Discover elite barbers, book instantly, and elevate your grooming experience. Built for clients who demand excellence and barbers who deliver it.",
    },
    about: {
      eyebrow: "Two Sides, One Ecosystem",
      title: "More than an app. It's a community.",
      lead:
        "Zbarber bridges the gap between exceptional African barbering talent and clients seeking premium grooming. We handle the friction so you can focus on the craft.",
      forClients: "For Clients",
      forClientsDesc:
        "Find top-rated barbers nearby, book instantly without calling, and pay seamlessly. Your grooming standard, elevated.",
      forBarbers: "For Barbers",
      forBarbersDesc:
        "Manage your schedule, build a digital portfolio, accept payments, and access financing to grow your business.",
      quote: "This platform changed how I run my shop. More clients, less administrative headache.",
      quoteAuthor: "— Diallo, Master Barber",
    },
    features: {
      title1: "Everything you need.",
      title2: "Nothing you don't.",
      subtitle:
        "Powerful tools designed specifically for the unique workflow of premium African barbershops.",
      items: [
        { title: "Proximity Search", desc: "Discover elite barbers in your neighborhood with real-time availability." },
        { title: "Smart Booking", desc: "24/7 self-service reservations. No more phone tag or double bookings." },
        { title: "Verified Reviews", desc: "Authentic feedback from real clients. Reputation built on merit." },
        { title: "Digital Portfolio", desc: "Showcase your best cuts. Let your craftsmanship speak for itself." },
        { title: "Business Analytics", desc: "Track earnings, client retention, and peak hours to optimize your shop." },
        { title: "Barber Community", desc: "Connect with other professionals, share techniques, and source talent." },
      ],
    },
    showcase: {
      title: "Sleek. Fast. Professional.",
      bookingConfirmed: "Booking Confirmed",
      todayAt: "Today at 2:00 PM",
      topBarber: "Top Rated Barber",
      rating: "5.0 ★ (120 reviews)",
    },
    pricing: {
      eyebrow: "For Barbers & Salons",
      title: "Invest in your craft.",
      subtitle: "Transparent pricing to help you scale your business on your terms.",
      freeTitle: "Standard Profile",
      freeDesc: "Perfect for independent barbers starting to build their digital presence.",
      free: "Free",
      forever: "/forever",
      freeFeatures: [
        "Basic professional profile",
        "Receive bookings via platform",
        "Standard visibility in search",
        "Basic portfolio (up to 10 photos)",
        "15% commission on bookings",
      ],
      freeCta: "Get Started Free",
      premiumTitle: "Global Premium",
      premiumDesc: "For established shops and high-volume barbers demanding the best.",
      perMonth: "/month",
      mostPopular: "Most Popular",
      premiumFeatures: [
        "Premium profile with video banner",
        "Priority ranking in local searches",
        "Unlimited portfolio photos",
        "0% commission on bookings",
        "Advanced business analytics",
        "Access to equipment financing program",
        "Automated marketing to past clients",
      ],
      premiumCta: "Upgrade to Premium",
    },
    ctaBarbers: {
      title: "Ready to elevate your shop?",
      desc: "Join hundreds of top African barbers who are growing their client base and managing their business with Zbarber.",
      become: "Become a Partner",
      benefits: "View Partner Benefits",
    },
    faq: {
      title: "Frequently Asked Questions",
      items: [
        { q: "How do I book an appointment?", a: "Simply download the app, create an account, and allow location services to find barbers near you. Select a barber, choose your service, pick an available time slot, and confirm." },
        { q: "Can I pay through the app?", a: "Yes. Zbarber offers secure, seamless in-app payments. You can add a credit/debit card or use supported local mobile money services to pay for your cut before you even leave the chair." },
        { q: "How do I become a barber partner?", a: "Click 'Become a Partner' to submit your application. Our team will review your portfolio and credentials. Once approved, you can set up your profile and start accepting bookings." },
        { q: "What is the equipment financing program?", a: "Premium partners with consistent booking history on our platform can apply for micro-financing to upgrade their tools, buy new chairs, or renovate their space." },
        { q: "What happens if I need to cancel my appointment?", a: "You can cancel through the app up to 24 hours before your appointment without penalty. Late cancellations may be subject to a fee depending on the specific barber's stated policy." },
        { q: "Is the app available in my city?", a: "We are currently operating in Abidjan, Dakar, and Nairobi, with rapid expansion planned across West and East Africa. Download the app to check availability in your specific neighborhood." },
      ],
    },
    contact: {
      title: "Get in touch",
      lead: "Have a question about the platform? Interested in partnering? Our team is ready to help you.",
      address: "Abidjan, Côte d'Ivoire",
      name: "Name",
      namePh: "Your name",
      email: "Email",
      emailPh: "Your email",
      message: "Message",
      messagePh: "How can we help you?",
      send: "Send message",
    },
    footer: {
      tagline:
        "Where African craftsmanship meets modern technology. The premier platform for elite grooming and barber business management.",
      product: "Product",
      forClients: "For Clients",
      forBarbers: "For Barbers",
      pricing: "Pricing",
      download: "Download App",
      company: "Company",
      about: "About Us",
      careers: "Careers",
      privacy: "Privacy Policy",
      terms: "Terms of Use",
      accountDeletion: "Delete my account",
      stay: "Stay Updated",
      newsletter: "Subscribe to our newsletter for the latest grooming tips and platform updates.",
      emailPh: "Email address",
      copyright: "All rights reserved.",
      slogan: "African Excellence. Digitally Expressed.",
    },
    notFound: {
      title: "404 — Page Not Found",
      desc: "The page you're looking for doesn't exist.",
    },
    language: "Language",
  },
} as const;

const STORAGE_KEY = "gbc-lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (typeof translations)[Lang]; locale: string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };
  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: translations[lang], locale: lang === "fr" ? "fr-FR" : "en-US" }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card/60 p-0.5 ${className ?? ""}`}>
      {(["fr", "en"] as const).map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
