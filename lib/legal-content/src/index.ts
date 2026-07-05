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
        { heading: "1. Acceptation des conditions", body: "En accédant à l'application ou au site Zbarber, vous acceptez d'être lié par ces conditions et toutes les lois applicables. Si vous n'acceptez pas, vous ne pouvez pas utiliser la plateforme." },
        { heading: "2. Création de compte", body: "Pour réserver ou proposer vos services, vous créez un compte avec votre nom, votre email (vérifié par code) et votre téléphone. Chaque compte est client par défaut ; le statut de barbier n'est activé qu'après validation de votre salon par notre équipe. Vous êtes responsable de la confidentialité de vos identifiants et de l'exactitude des informations fournies (pays, ville, quartier).", list: [
          "Un compte = une personne. Ne partagez pas vos identifiants.",
          "Vous devez avoir l'âge légal requis pour contracter dans votre pays de résidence.",
        ] },
        { heading: "3. Réservations et calendrier", body: "Les rendez-vous se prennent via le calendrier de l'application, qui n'affiche que les créneaux réellement disponibles selon les horaires du salon, ses jours de fermeture ou de congé, et les réservations déjà confirmées. En réservant, vous acceptez que :", list: [
          "La confirmation et un rappel automatique (par email) vous soient envoyés avant le rendez-vous.",
          "Les clients ne peuvent qu'annuler leur propre réservation ; toute autre modification de statut est réservée au barbier ou à l'administration.",
          "Un historique d'annulations ou d'absences répétées peut entraîner une restriction de compte.",
          "Le paiement des prestations se règle directement avec le salon, sauf mention contraire affichée dans l'application.",
        ] },
        { heading: "4. Obligations des barbiers", body: "Les barbiers inscrits acceptent de :", list: [
          "Fournir des informations exactes sur leur salon, leurs services, prix, horaires et localisation.",
          "Maintenir à jour leur agenda (horaires, jours de congé) pour que le calendrier de réservation reste fiable.",
          "Honorer les réservations confirmées ou les annuler avec un préavis suffisant.",
          "Ne publier que des photos de galerie et un logo dont ils détiennent les droits.",
          "Maintenir un standard professionnel et d'hygiène.",
          "Payer les éventuels frais d'abonnement et de transaction applicables à leur compte professionnel.",
          "Fournir les documents demandés lors du processus de vérification de salon lorsque cela est requis.",
        ] },
        { heading: "5. Obligations des clients", body: "Les clients acceptent de :", list: [
          "Arriver à l'heure pour les rendez-vous réservés via le calendrier.",
          "Annuler suffisamment à l'avance s'ils ne peuvent honorer un rendez-vous.",
          "Laisser des avis honnêtes, respectueux et fondés sur une expérience réelle.",
          "Payer pour les services réservés et rendus.",
        ] },
        { heading: "6. Avis, favoris et programme de fidélité", body: "Les avis publiés sont visibles publiquement et engagent leur auteur ; tout contenu injurieux, diffamatoire ou manifestement faux peut être supprimé. La carte de fidélité et les autres avantages proposés dans l'application peuvent évoluer ou être suspendus à tout moment, sans que cela constitue un droit acquis." },
        { heading: "7. Notifications", body: "En activant les notifications (rappels de rendez-vous, confirmations, mises à jour de compte), vous acceptez de les recevoir sur votre appareil. Vous pouvez les désactiver à tout moment depuis les réglages de votre téléphone." },
        { heading: "8. Propriété intellectuelle", body: "Permission est accordée de consulter les contenus de Zbarber pour un usage personnel et non commercial. Cette permission ne vous autorise pas à :", list: [
          "Copier ou redistribuer les contenus de la plateforme ;",
          "Utiliser les contenus à des fins commerciales ;",
          "Décompiler ou faire de l'ingénierie inverse sur tout logiciel de la plateforme ;",
          "Supprimer toute mention de copyright ;",
          "Transférer ou « mirroirer » les contenus sur un autre serveur.",
        ] },
        { heading: "9. Avertissement", body: "Les contenus sont fournis « en l'état ». Zbarber ne donne aucune garantie expresse ou implicite et décline toute garantie de qualité marchande, d'adéquation à un usage particulier ou de non-violation. Zbarber met en relation clients et barbiers indépendants ; la qualité des prestations relève de la responsabilité du salon." },
        { heading: "10. Loi applicable", body: "Ces conditions sont régies par les lois togolaises et de la juridiction dans laquelle Zbarber opère." },
      ],
    },
    privacy: {
      title: "Politique de confidentialité",
      lastUpdated: "Dernière mise à jour :",
      sections: [
        { heading: "1. Informations que nous collectons", body: "Zbarber (« nous », « notre ») collecte les informations que vous nous fournissez directement ou générées par l'usage de l'application, notamment :", list: [
          "Informations de compte : nom, email, téléphone et mot de passe.",
          "Informations de profil : photo, langue et thème préférés, localisation (pays, ville, quartier), préférences et historique de réservations.",
          "Informations barbiers : nom et localisation du salon, horaires, jours de congé, services et tarifs, photos de galerie et logo, documents de vérification, coordonnées de contact (téléphone, WhatsApp).",
          "Avis et favoris : les avis que vous publiez et les salons que vous enregistrez en favoris.",
          "Jeton de notification push : identifiant technique de votre appareil, utilisé uniquement pour vous envoyer les rappels et confirmations liés à vos réservations.",
          "Données d'utilisation : informations techniques sur votre interaction avec l'application (type d'appareil, langue système).",
        ] },
        { heading: "2. Comment nous utilisons vos informations", body: "Nous utilisons les informations collectées pour :", list: [
          "Fournir, maintenir et améliorer nos services, y compris le calendrier de réservation et le calcul des salons proches de vous.",
          "Traiter les réservations et envoyer les confirmations, rappels et notifications associées.",
          "Vérifier les comptes barbiers avant publication de leur salon.",
          "Vous envoyer des notifications techniques, mises à jour et messages de support.",
          "Répondre à vos commentaires, questions et demandes de service client.",
          "Communiquer, avec votre accord, sur nos produits, services, offres et événements.",
        ] },
        { heading: "3. Partage d'informations", body: "Nous pouvons partager vos informations comme suit :", list: [
          "Avec les barbiers ou clients concernés, dans la limite nécessaire pour faciliter une réservation (nom, téléphone, créneau).",
          "Avec des prestataires techniques qui réalisent des missions pour notre compte (hébergement, envoi d'emails et de notifications).",
          "En réponse à une demande légale si nous estimons la divulgation conforme à la loi.",
        ] },
        { heading: "4. Conservation et sécurité", body: "Vos préférences (langue, thème, statut d'introduction) sont stockées localement sur votre appareil. Les autres données sont conservées sur nos serveurs tant que votre compte est actif, avec des mesures raisonnables de protection contre la perte, le vol et l'accès non autorisé, incluant des protocoles de chiffrement standards. Lorsque votre historique de réservations ou d'avis empêche une suppression complète, la suppression de compte anonymise vos informations personnelles plutôt que de les effacer entièrement." },
        { heading: "5. Vos droits", body: "Vous pouvez à tout moment :", list: [
          "Consulter et modifier vos informations depuis votre profil dans l'application.",
          "Désactiver les notifications depuis les réglages de votre appareil.",
          "Demander la suppression de votre compte depuis l'application ou via le formulaire disponible sur notre site.",
        ] },
        { heading: "6. Nous contacter", body: "Pour toute question sur cette politique, contactez-nous à zbarberbook@gmail.com." },
      ],
    },
  },
  en: {
    terms: {
      title: "Terms of Use",
      lastUpdated: "Last updated:",
      sections: [
        { heading: "1. Acceptance of Terms", body: "By accessing or using the Zbarber application or website, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform." },
        { heading: "2. Creating an Account", body: "To book or offer services, you create an account with your name, email (verified by code), and phone number. Every account is a client account by default; barber status is only activated once our team approves your salon. You are responsible for keeping your credentials confidential and for the accuracy of the information you provide (country, city, neighborhood).", list: [
          "One account per person. Do not share your login credentials.",
          "You must be of legal age to contract in your country of residence.",
        ] },
        { heading: "3. Bookings and Calendar", body: "Appointments are booked through the app's calendar, which only shows slots that are actually available based on the salon's working hours, closed/holiday days, and existing confirmed reservations. By booking, you agree that:", list: [
          "A confirmation and an automatic reminder (by email) will be sent before your appointment.",
          "Clients may only cancel their own reservation; any other status change is reserved to the barber or an administrator.",
          "A history of repeated cancellations or no-shows may lead to account restrictions.",
          "Payment for services is settled directly with the salon unless stated otherwise in the app.",
        ] },
        { heading: "4. Barber Obligations", body: "Barbers registered on the platform agree to:", list: [
          "Provide accurate and up-to-date information about their salon, services, pricing, hours, and location.",
          "Keep their schedule (working hours, days off) up to date so the booking calendar stays reliable.",
          "Honor confirmed bookings or cancel them with sufficient notice.",
          "Only publish gallery photos and a logo they own the rights to.",
          "Maintain a professional standard of service and hygiene.",
          "Pay any applicable subscription fees and processing fees for their professional account.",
          "Provide the documents requested during the salon verification process when required.",
        ] },
        { heading: "5. Client Obligations", body: "Clients using the platform agree to:", list: [
          "Arrive on time for appointments booked through the calendar.",
          "Cancel with sufficient notice if they cannot make an appointment.",
          "Provide fair, honest, and respectful reviews based on a real experience.",
          "Pay for all services booked and received.",
        ] },
        { heading: "6. Reviews, Favorites and Loyalty Program", body: "Published reviews are publicly visible and are the responsibility of their author; abusive, defamatory, or clearly false content may be removed. The loyalty card and any other in-app benefits may change or be suspended at any time and do not constitute an acquired right." },
        { heading: "7. Notifications", body: "By enabling notifications (appointment reminders, confirmations, account updates), you agree to receive them on your device. You can disable them at any time from your device settings." },
        { heading: "8. Intellectual Property", body: "Permission is granted to view the materials on Zbarber's platform for personal, non-commercial use only. This permission does not allow you to:", list: [
          "Copy or redistribute the platform's content;",
          "Use the materials for any commercial purpose;",
          "Attempt to decompile or reverse engineer any software contained on the platform;",
          "Remove any copyright or other proprietary notations from the materials;",
          'Transfer the materials to another person or "mirror" them on any other server.',
        ] },
        { heading: "9. Disclaimer", body: "The materials on Zbarber's platform are provided on an 'as is' basis. Zbarber makes no warranties, expressed or implied, and disclaims all other warranties including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement. Zbarber connects clients with independent barbers; the quality of services provided is the salon's responsibility." },
        { heading: "10. Governing Law", body: "These terms are governed by the laws of Togo and of the jurisdiction in which Zbarber operates." },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated:",
      sections: [
        { heading: "1. Information We Collect", body: 'Zbarber ("we", "our") collects information you provide directly to us or that is generated through your use of the app, including:', list: [
          "Account Information: name, email, phone number, and password.",
          "Profile Information: profile photo, preferred language and theme, location (country, city, neighborhood), preferences, and booking history.",
          "Barber-Specific Information: salon name and location, working hours, days off, services and pricing, gallery photos and logo, verification documents, and contact details (phone, WhatsApp).",
          "Reviews and Favorites: the reviews you publish and the salons you save as favorites.",
          "Push Notification Token: a technical device identifier used only to send you booking reminders and confirmations.",
          "Usage Data: technical information about how you interact with our application (device type, system language).",
        ] },
        { heading: "2. How We Use Your Information", body: "We use the information we collect to:", list: [
          "Provide, maintain, and improve our services, including the booking calendar and finding salons near you.",
          "Process bookings and send related confirmations, reminders, and notifications.",
          "Verify barber accounts before their salon is published.",
          "Send you technical notices, updates, and support messages.",
          "Respond to your comments, questions, and customer service requests.",
          "Communicate with you, with your consent, about products, services, offers, and events.",
        ] },
        { heading: "3. Information Sharing", body: "We may share your information as follows:", list: [
          "With the barber or client involved, to the extent necessary to facilitate a booking (name, phone number, time slot).",
          "With technical service providers acting on our behalf (hosting, sending emails and notifications).",
          "In response to a legal request if we believe disclosure is required by law.",
        ] },
        { heading: "4. Retention and Security", body: "Your preferences (language, theme, onboarding status) are stored locally on your device. Other data is kept on our servers for as long as your account is active, with reasonable measures to protect it from loss, theft, and unauthorized access, including industry-standard encryption protocols. Where your booking or review history prevents full deletion, account deletion anonymizes your personal information instead of erasing it entirely." },
        { heading: "5. Your Rights", body: "You may at any time:", list: [
          "View and update your information from your profile in the app.",
          "Disable notifications from your device settings.",
          "Request deletion of your account from within the app or via the form available on our website.",
        ] },
        { heading: "6. Contact Us", body: "For any question about this policy, contact us at zbarberbook@gmail.com." },
      ],
    },
  },
};
