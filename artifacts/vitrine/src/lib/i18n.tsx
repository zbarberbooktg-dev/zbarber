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
        "Global Barber Corp connecte le talent exceptionnel des barbiers africains aux clients en quête d'un grooming premium. Nous gérons la friction, vous vous concentrez sur l'art.",
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
      desc: "Rejoignez des centaines de barbiers africains de premier plan qui développent leur clientèle avec Global Barber Corp.",
      become: "Devenir partenaire",
      benefits: "Voir les avantages partenaires",
    },
    faq: {
      title: "Questions fréquentes",
      items: [
        { q: "Comment réserver un rendez-vous ?", a: "Téléchargez l'app, créez un compte et autorisez la géolocalisation pour trouver des barbiers à proximité. Choisissez un barbier, un service, un créneau et confirmez." },
        { q: "Puis-je payer via l'app ?", a: "Oui. Global Barber Corp propose des paiements sécurisés intégrés. Carte bancaire ou mobile money local — vous payez avant même de quitter le fauteuil." },
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
    privacy: {
      title: "Politique de confidentialité",
      lastUpdated: "Dernière mise à jour :",
      s1: "1. Informations que nous collectons",
      s1p: 'Global Barber Corp (« nous », « notre ») collecte les informations que vous nous fournissez directement, notamment :',
      s1l: [
        "Informations de compte : nom, email, téléphone et mot de passe.",
        "Informations de profil : photo, préférences et historique de réservations.",
        "Informations barbiers : références professionnelles, adresse du salon, photos de portfolio et coordonnées bancaires.",
        "Données d'utilisation : informations sur votre interaction avec l'application.",
      ],
      s2: "2. Comment nous utilisons vos informations",
      s2p: "Nous utilisons les informations collectées pour :",
      s2l: [
        "Fournir, maintenir et améliorer nos services.",
        "Traiter les transactions et envoyer les informations associées.",
        "Vous envoyer des notifications techniques, mises à jour et messages de support.",
        "Répondre à vos commentaires, questions et demandes de service client.",
        "Communiquer sur nos produits, services, offres et événements.",
      ],
      s3: "3. Partage d'informations",
      s3p: "Nous pouvons partager vos informations comme suit :",
      s3l: [
        "Avec les barbiers ou clients pour faciliter les réservations.",
        "Avec des prestataires qui réalisent des missions pour nous.",
        "En réponse à une demande légale si nous estimons la divulgation conforme à la loi.",
      ],
      s4: "4. Sécurité",
      s4p: "Nous prenons des mesures raisonnables pour protéger vos informations contre la perte, le vol et l'accès non autorisé. Nous utilisons des protocoles de chiffrement standards.",
      s5: "5. Nous contacter",
      s5p: "Pour toute question sur cette politique, contactez-nous à :",
    },
    terms: {
      title: "Conditions d'utilisation",
      lastUpdated: "Dernière mise à jour :",
      s1: "1. Acceptation des conditions",
      s1p: "En accédant à l'application et au site Global Barber Corp, vous acceptez d'être lié par ces conditions et toutes les lois applicables. Si vous n'acceptez pas, vous ne pouvez pas utiliser la plateforme.",
      s2: "2. Licence d'utilisation",
      s2p: "Permission est accordée de télécharger temporairement une copie des contenus de Global Barber Corp pour un usage personnel et non commercial. Cette licence ne vous permet pas de :",
      s2l: [
        "Modifier ou copier les contenus ;",
        "Utiliser les contenus à des fins commerciales ;",
        "Décompiler ou faire de l'ingénierie inverse sur tout logiciel de la plateforme ;",
        "Supprimer toute mention de copyright ;",
        "Transférer ou « mirroirer » les contenus sur un autre serveur.",
      ],
      s3: "3. Obligations des barbiers",
      s3p: "Les barbiers inscrits acceptent de :",
      s3l: [
        "Fournir des informations exactes sur leurs services, prix et disponibilités.",
        "Honorer les réservations ou les annuler avec un préavis suffisant.",
        "Maintenir un standard professionnel et d'hygiène.",
        "Payer les frais d'abonnement et de transaction applicables.",
      ],
      s4: "4. Obligations des clients",
      s4p: "Les clients acceptent de :",
      s4l: [
        "Arriver à l'heure pour les rendez-vous.",
        "Respecter la politique d'annulation du barbier.",
        "Laisser des avis honnêtes et équitables.",
        "Payer pour les services réservés et rendus.",
      ],
      s5: "5. Avertissement",
      s5p: "Les contenus sont fournis « en l'état ». Global Barber Corp ne donne aucune garantie expresse ou implicite et décline toute garantie de qualité marchande, d'adéquation à un usage particulier ou de non-violation.",
      s6: "6. Loi applicable",
      s6p: "Ces conditions sont régies par les lois de la juridiction dans laquelle Global Barber Corp opère.",
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
        "Global Barber Corp bridges the gap between exceptional African barbering talent and clients seeking premium grooming. We handle the friction so you can focus on the craft.",
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
      desc: "Join hundreds of top African barbers who are growing their client base and managing their business with Global Barber Corp.",
      become: "Become a Partner",
      benefits: "View Partner Benefits",
    },
    faq: {
      title: "Frequently Asked Questions",
      items: [
        { q: "How do I book an appointment?", a: "Simply download the app, create an account, and allow location services to find barbers near you. Select a barber, choose your service, pick an available time slot, and confirm." },
        { q: "Can I pay through the app?", a: "Yes. Global Barber Corp offers secure, seamless in-app payments. You can add a credit/debit card or use supported local mobile money services to pay for your cut before you even leave the chair." },
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
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated:",
      s1: "1. Information We Collect",
      s1p: 'Global Barber Corp ("we", "our", or "us") collects information you provide directly to us when you use our platform, including:',
      s1l: [
        "Account Information: Name, email address, phone number, and password.",
        "Profile Information: Profile photo, preferences, and booking history.",
        "Barber Specific Information: Professional credentials, salon location, portfolio images, and banking details for payouts.",
        "Usage Data: Information about how you interact with our application.",
      ],
      s2: "2. How We Use Your Information",
      s2p: "We use the information we collect to:",
      s2l: [
        "Provide, maintain, and improve our services.",
        "Process transactions and send related information.",
        "Send you technical notices, updates, security alerts, and support messages.",
        "Respond to your comments, questions, and customer service requests.",
        "Communicate with you about products, services, offers, and events offered by Global Barber Corp.",
      ],
      s3: "3. Information Sharing",
      s3p: "We may share your information as follows:",
      s3l: [
        "With barbers or clients to facilitate bookings and services.",
        "With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf.",
        "In response to a request for information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.",
      ],
      s4: "4. Security",
      s4p: "We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction. We use industry-standard encryption protocols to protect your personal and financial data.",
      s5: "5. Contact Us",
      s5p: "If you have any questions about this Privacy Policy, please contact us at:",
    },
    terms: {
      title: "Terms of Use",
      lastUpdated: "Last updated:",
      s1: "1. Acceptance of Terms",
      s1p: "By accessing or using the Global Barber Corp application and website, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.",
      s2: "2. Use License",
      s2p: "Permission is granted to temporarily download one copy of the materials (information or software) on Global Barber Corp's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:",
      s2l: [
        "Modify or copy the materials;",
        "Use the materials for any commercial purpose, or for any public display (commercial or non-commercial);",
        "Attempt to decompile or reverse engineer any software contained on Global Barber Corp's platform;",
        "Remove any copyright or other proprietary notations from the materials; or",
        'Transfer the materials to another person or "mirror" the materials on any other server.',
      ],
      s3: "3. Barber Obligations",
      s3p: "Barbers registered on the platform agree to:",
      s3l: [
        "Provide accurate and up-to-date information regarding their services, pricing, and availability.",
        "Honor all bookings made through the platform or cancel them with sufficient notice as defined in our cancellation policy.",
        "Maintain a professional standard of service and hygiene.",
        "Pay all applicable subscription fees and processing fees associated with transactions made through the platform.",
      ],
      s4: "4. Client Obligations",
      s4p: "Clients using the platform agree to:",
      s4l: [
        "Arrive on time for scheduled appointments.",
        "Provide sufficient notice for cancellations in accordance with the specific barber's cancellation policy.",
        "Provide fair and honest reviews of services received.",
        "Pay for all services booked and received.",
      ],
      s5: "5. Disclaimer",
      s5p: "The materials on Global Barber Corp's platform are provided on an 'as is' basis. Global Barber Corp makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.",
      s6: "6. Governing Law",
      s6p: "These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Global Barber Corp operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.",
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
