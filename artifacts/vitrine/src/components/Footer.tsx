import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Instagram, Twitter, Linkedin, Mail } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Footer() {
  const { t } = useT();
  return (
    <footer className="bg-secondary text-secondary-foreground border-t border-border pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="font-display font-bold text-2xl tracking-tighter text-primary flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm">ZB</span>
              ZBARBER
            </Link>
            <p className="text-sm text-muted-foreground mb-6">{t.footer.tagline}</p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>

          <div>
            <h3 className="font-display font-semibold text-lg mb-4">{t.footer.product}</h3>
            <ul className="space-y-3">
              <li><a href="#features" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.forClients}</a></li>
              <li><a href="#barbers" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.forBarbers}</a></li>
              <li><a href="#pricing" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.pricing}</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.download}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-lg mb-4">{t.footer.company}</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.about}</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.careers}</a></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.privacy}</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{t.footer.terms}</Link></li>
              <li><Link href="/account-deletion" className="text-muted-foreground hover:text-foreground text-sm transition-colors">{(t.footer as any).accountDeletion ?? "Supprimer mon compte"}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-lg mb-4">{t.footer.stay}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.footer.newsletter}</p>
            <form className="flex space-x-2" onSubmit={(e) => e.preventDefault()}>
              <Input type="email" placeholder={t.footer.emailPh} className="bg-background border-border" />
              <Button type="submit" size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Mail className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Zbarber. {t.footer.copyright}
          </p>
          <p className="text-sm text-muted-foreground mt-2 md:mt-0 flex items-center">
            {t.footer.slogan}
          </p>
        </div>
      </div>
    </footer>
  );
}
