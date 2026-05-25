import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-8">Privacy Policy</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
          <p className="text-lg">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          
          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">1. Information We Collect</h2>
          <p>Global Barber Corp ("we", "our", or "us") collects information you provide directly to us when you use our platform, including:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Account Information: Name, email address, phone number, and password.</li>
            <li>Profile Information: Profile photo, preferences, and booking history.</li>
            <li>Barber Specific Information: Professional credentials, salon location, portfolio images, and banking details for payouts.</li>
            <li>Usage Data: Information about how you interact with our application.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Provide, maintain, and improve our services.</li>
            <li>Process transactions and send related information.</li>
            <li>Send you technical notices, updates, security alerts, and support messages.</li>
            <li>Respond to your comments, questions, and customer service requests.</li>
            <li>Communicate with you about products, services, offers, and events offered by Global Barber Corp.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">3. Information Sharing</h2>
          <p>We may share your information as follows:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>With barbers or clients to facilitate bookings and services.</li>
            <li>With vendors, consultants, and other service providers who need access to such information to carry out work on our behalf.</li>
            <li>In response to a request for information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">4. Security</h2>
          <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction. We use industry-standard encryption protocols to protect your personal and financial data.</p>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">5. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p className="mt-4 font-medium">privacy@globalbarber.com</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}