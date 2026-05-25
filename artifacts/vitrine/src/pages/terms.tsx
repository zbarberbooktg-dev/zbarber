import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-8">Terms of Use</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
          <p className="text-lg">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          
          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing or using the Global Barber Corp application and website, you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.</p>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">2. Use License</h2>
          <p>Permission is granted to temporarily download one copy of the materials (information or software) on Global Barber Corp's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Modify or copy the materials;</li>
            <li>Use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
            <li>Attempt to decompile or reverse engineer any software contained on Global Barber Corp's platform;</li>
            <li>Remove any copyright or other proprietary notations from the materials; or</li>
            <li>Transfer the materials to another person or "mirror" the materials on any other server.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">3. Barber Obligations</h2>
          <p>Barbers registered on the platform agree to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Provide accurate and up-to-date information regarding their services, pricing, and availability.</li>
            <li>Honor all bookings made through the platform or cancel them with sufficient notice as defined in our cancellation policy.</li>
            <li>Maintain a professional standard of service and hygiene.</li>
            <li>Pay all applicable subscription fees and processing fees associated with transactions made through the platform.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">4. Client Obligations</h2>
          <p>Clients using the platform agree to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Arrive on time for scheduled appointments.</li>
            <li>Provide sufficient notice for cancellations in accordance with the specific barber's cancellation policy.</li>
            <li>Provide fair and honest reviews of services received.</li>
            <li>Pay for all services booked and received.</li>
          </ul>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">5. Disclaimer</h2>
          <p>The materials on Global Barber Corp's platform are provided on an 'as is' basis. Global Barber Corp makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

          <h2 className="text-2xl font-display font-semibold text-foreground mt-12 mb-4">6. Governing Law</h2>
          <p>These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Global Barber Corp operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}