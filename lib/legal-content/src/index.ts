export type LegalLang = "fr" | "en";

export type LegalSection = {
  heading: string;
  body?: string;
  list?: string[];
};

export type LegalDoc = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export type LegalContent = {
  terms: LegalDoc;
  privacy: LegalDoc;
};

export const LEGAL: Record<LegalLang, LegalContent> = {
  fr: {
    terms: {
      title: "Conditions d'utilisation",
      lastUpdated: "Dernière mise à jour :",
      sections: [
        { heading: "1. Acceptation des conditions", body: "En accédant à l'application et au site Global Barber Corp, vous acceptez d'être lié par ces conditions et toutes les lois applicables. Si vous n'acceptez pas, vous ne pouvez pas utiliser la plateforme." },
        { heading: "2. Licence d'utilisation", body: "Permission est accordée de télécharger temporairement une copie des contenus de Global Barber Corp pour un usage personnel et non commercial. Cette licence ne vous permet pas de :", list: [
          "Modifier ou copier les contenus ;",
          "Utiliser les contenus à des fins commerciales ;",
          "Décompiler ou faire de l'ingénierie inverse sur tout logiciel de la plateforme ;",
          "Supprimer toute mention de copyright ;",
          "Transférer ou « mirroirer » les contenus sur un autre serveur.",
        ] },
        { heading: "3. Obligations des barbiers", body: "Les barbiers inscrits acceptent de :", list: [
          "Fournir des informations exactes sur leurs services, prix et disponibilités.",
          "Honorer les réservations ou les annuler avec un préavis suffisant.",
          "Maintenir un standard professionnel et d'hygiène.",
          "Payer les frais d'abonnement et de transaction applicables.",
        ] },
        { heading: "4. Obligations des clients", body: "Les clients acceptent de :", list: [
          "Arriver à l'heure pour les rendez-vous.",
          "Respecter la politique d'annulation du barbier.",
          "Laisser des avis honnêtes et équitables.",
          "Payer pour les services réservés et rendus.",
        ] },
        { heading: "5. Avertissement", body: "Les contenus sont fournis « en l'état ». Global Barber Corp ne donne aucune garantie expresse ou implicite et décline toute garantie de qualité marchande, d'adéquation à un usage particulier ou de non-violation." },
        { heading: "6. Loi applicable", body: "Ces conditions sont régies par les lois de la juridiction dans laquelle Global Barber Corp opère." },
      ],
    },
    privacy: {
      title: "Politique de confidentialité",
      lastUpdated: "Dernière mise à jour :",
      sections: [
        { heading: "1. Informations que nous collectons", body: "Global Barber Corp (« nous », « notre ») collecte les informations que vous nous fournissez directement, notamment :", list: [
          "Informations de compte : nom, email, téléphone et mot de passe.",
          "Informations de profil : photo, préférences et historique de réservations.",
          "Informations barbiers : références professionnelles, adresse du salon, photos de portfolio et coordonnées bancaires.",
          "Données d'utilisation : informations sur votre interaction avec l'application.",
        ] },
        { heading: "2. Comment nous utilisons vos informations", body: "Nous utilisons les informations collectées pour :", list: [
          "Fournir, maintenir et améliorer nos services.",
          "Traiter les transactions et envoyer les informations associées.",
          "Vous envoyer des notifications techniques, mises à jour et messages de support.",
          "Répondre à vos commentaires, questions et demandes de service client.",
          "Communiquer sur nos produits, services, offres et événements.",
        ] },
        { heading: "3. Partage d'informations", body: "Nous pouvons partager vos informations comme suit :", list: [
          "Avec les barbiers ou clients pour faciliter les réservations.",
          "Avec des prestataires qui réalisent des missions pour nous.",
          "En réponse à une demande légale si nous estimons la divulgation conforme à la loi.",
        ] },
        { heading: "4. Sécurité", body: "Nous prenons des mesures raisonnables pour protéger vos informations contre la perte, le vol et l'accès non autorisé. Nous utilisons des protocoles de chiffrement standards." },
        { heading: "5. Nous contacter", body: "Pour toute question sur cette politique, contactez-nous à privacy@globalbarber.com." },
      ],
    },
  },
  en: {
    terms: {
      title: "Terms of Use",
      lastUpdated: "Last updated:",
      sections: [
        { heading: "1. Acceptance of Terms", body: "By accessing or using the Global Barber Corp application and website, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform." },
        { heading: "2. Use License", body: "Permission is granted to temporarily download one copy of the materials on Global Barber Corp's platform for personal, non-commercial transitory viewing only. Under this license you may not:", list: [
          "Modify or copy the materials;",
          "Use the materials for any commercial purpose, or for any public display;",
          "Attempt to decompile or reverse engineer any software contained on the platform;",
          "Remove any copyright or other proprietary notations from the materials;",
          'Transfer the materials to another person or "mirror" the materials on any other server.',
        ] },
        { heading: "3. Barber Obligations", body: "Barbers registered on the platform agree to:", list: [
          "Provide accurate and up-to-date information regarding their services, pricing, and availability.",
          "Honor all bookings or cancel them with sufficient notice.",
          "Maintain a professional standard of service and hygiene.",
          "Pay all applicable subscription fees and processing fees.",
        ] },
        { heading: "4. Client Obligations", body: "Clients using the platform agree to:", list: [
          "Arrive on time for scheduled appointments.",
          "Provide sufficient notice for cancellations.",
          "Provide fair and honest reviews.",
          "Pay for all services booked and received.",
        ] },
        { heading: "5. Disclaimer", body: "The materials on Global Barber Corp's platform are provided on an 'as is' basis. Global Barber Corp makes no warranties, expressed or implied, and disclaims all other warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement." },
        { heading: "6. Governing Law", body: "These terms are governed by the laws of the jurisdiction in which Global Barber Corp operates." },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated:",
      sections: [
        { heading: "1. Information We Collect", body: 'Global Barber Corp ("we", "our") collects information you provide directly to us, including:', list: [
          "Account Information: name, email, phone number, and password.",
          "Profile Information: profile photo, preferences, and booking history.",
          "Barber-Specific Information: professional credentials, salon location, portfolio images, and payout details.",
          "Usage Data: information about how you interact with our application.",
        ] },
        { heading: "2. How We Use Your Information", body: "We use the information we collect to:", list: [
          "Provide, maintain, and improve our services.",
          "Process transactions and send related information.",
          "Send you technical notices, updates, and support messages.",
          "Respond to your comments, questions, and customer service requests.",
          "Communicate with you about products, services, offers, and events.",
        ] },
        { heading: "3. Information Sharing", body: "We may share your information as follows:", list: [
          "With barbers or clients to facilitate bookings and services.",
          "With vendors and service providers acting on our behalf.",
          "In response to a legal request if we believe disclosure is required by law.",
        ] },
        { heading: "4. Security", body: "We take reasonable measures to protect information about you from loss, theft, and unauthorized access. We use industry-standard encryption protocols." },
        { heading: "5. Contact Us", body: "For any question about this policy, contact us at privacy@globalbarber.com." },
      ],
    },
  },
};
