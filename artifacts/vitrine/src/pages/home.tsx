import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Scissors, MapPin, CalendarClock, Star, Award, TrendingUp, Users, Smartphone, ShieldCheck, CheckCircle2, Mail } from "lucide-react";
import { useT } from "@/lib/i18n";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
};

export default function Home() {
  const { t } = useT();
  const featureIcons = [<MapPin />, <CalendarClock />, <ShieldCheck />, <Award />, <TrendingUp />, <Users />];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow">
        {/* HERO */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src="/hero-bg.png" alt="Elite African Barbershop" className="w-full h-full object-cover opacity-30 dark:opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background"></div>
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#22c55e]/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-center max-w-4xl mx-auto">
              <motion.div variants={fadeIn}>
                <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 px-4 py-1.5 text-sm uppercase tracking-widest font-semibold hover:bg-primary/30 transition-colors">
                  {t.hero.badge}
                </Badge>
              </motion.div>
              <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-display font-bold text-foreground tracking-tight leading-tight mb-6">
                {t.hero.title1} <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-300">{t.hero.title2}</span>
              </motion.h1>
              <motion.p variants={fadeIn} className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                {t.hero.subtitle}
              </motion.p>
              <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-foreground text-background hover:bg-foreground/90 font-semibold text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  App Store
                </Button>
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Google Play
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ABOUT */}
        <section className="py-24 bg-secondary/30" id="about">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[3/4] border border-white/10">
                  <img src="/barber-work.png" alt="Barber at work" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8">
                    <div className="flex items-center gap-2 mb-2">
                      {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-5 h-5 fill-primary text-primary" />)}
                    </div>
                    <p className="text-white text-lg font-medium">"{t.about.quote}"</p>
                    <p className="text-primary mt-2 font-display font-bold">{t.about.quoteAuthor}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <h2 className="text-sm font-bold tracking-widest text-primary uppercase mb-3">{t.about.eyebrow}</h2>
                <h3 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">{t.about.title}</h3>
                <p className="text-lg text-muted-foreground mb-8">{t.about.lead}</p>

                <div className="space-y-6">
                  <div className="flex gap-4 p-6 bg-background rounded-2xl border border-border shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-xl font-display font-bold text-foreground mb-2">{t.about.forClients}</h4>
                      <p className="text-muted-foreground">{t.about.forClientsDesc}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-6 bg-background rounded-2xl border border-border shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Scissors className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="text-xl font-display font-bold text-foreground mb-2">{t.about.forBarbers}</h4>
                      <p className="text-muted-foreground">{t.about.forBarbersDesc}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-24" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 text-foreground">
                {t.features.title1} <br />{t.features.title2}
              </h2>
              <p className="text-lg text-muted-foreground">{t.features.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {t.features.items.map((feature, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-secondary/40 border border-white/5 p-8 rounded-3xl hover:bg-secondary/60 transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center mb-6 text-primary">
                    {featureIcons[i]}
                  </div>
                  <h3 className="text-xl font-bold font-display text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* SHOWCASE */}
        <section className="py-24 bg-gradient-to-b from-background to-secondary/30 overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-16 text-foreground">{t.showcase.title}</h2>
            <div className="flex justify-center items-center">
              <motion.div initial={{ opacity: 0, y: 100 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, type: "spring" }} className="relative max-w-sm w-full mx-auto">
                <div className="relative rounded-[3rem] border-8 border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19]">
                  <div className="absolute top-0 inset-x-0 h-7 bg-gray-900 z-20 rounded-b-3xl mx-auto w-1/3"></div>
                  <img src="/app-mockup.png" alt="App Interface" className="w-full h-full object-cover" />
                </div>

                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute -right-12 top-32 bg-background border border-border p-4 rounded-2xl shadow-xl z-20 hidden md:block">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">{t.showcase.bookingConfirmed}</p>
                      <p className="text-xs text-muted-foreground">{t.showcase.todayAt}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                  className="absolute -left-16 bottom-32 bg-background border border-border p-4 rounded-2xl shadow-xl z-20 hidden md:block">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">{t.showcase.topBarber}</p>
                      <p className="text-xs text-muted-foreground">{t.showcase.rating}</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="py-24" id="pricing">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-sm font-bold tracking-widest text-primary uppercase mb-3">{t.pricing.eyebrow}</h2>
              <h3 className="text-3xl md:text-5xl font-display font-bold mb-6 text-foreground">{t.pricing.title}</h3>
              <p className="text-lg text-muted-foreground">{t.pricing.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="bg-background border-border/50 shadow-lg relative overflow-hidden">
                <CardHeader className="pb-8">
                  <CardTitle className="text-2xl font-display font-bold">{t.pricing.freeTitle}</CardTitle>
                  <CardDescription className="text-base mt-2">{t.pricing.freeDesc}</CardDescription>
                  <div className="mt-6 flex items-baseline text-5xl font-extrabold text-foreground">
                    {t.pricing.free}
                    <span className="ml-1 text-xl font-medium text-muted-foreground">{t.pricing.forever}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {t.pricing.freeFeatures.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="pt-8">
                  <Button variant="outline" className="w-full h-12 text-base font-semibold border-border hover:bg-secondary">{t.pricing.freeCta}</Button>
                </CardFooter>
              </Card>

              <Card className="bg-secondary border-primary/30 shadow-xl relative overflow-hidden transform md:-translate-y-4">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
                <div className="absolute top-6 right-6">
                  <Badge className="bg-primary text-primary-foreground font-bold px-3 py-1">{t.pricing.mostPopular}</Badge>
                </div>
                <CardHeader className="pb-8 pt-10">
                  <CardTitle className="text-2xl font-display font-bold text-foreground">{t.pricing.premiumTitle}</CardTitle>
                  <CardDescription className="text-base mt-2 text-muted-foreground">{t.pricing.premiumDesc}</CardDescription>
                  <div className="mt-6 flex items-baseline text-5xl font-extrabold text-foreground">
                    $29
                    <span className="ml-1 text-xl font-medium text-muted-foreground">{t.pricing.perMonth}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {t.pricing.premiumFeatures.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground font-medium">{feature}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="pt-8">
                  <Button className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90">{t.pricing.premiumCta}</Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative overflow-hidden" id="barbers">
          <div className="absolute inset-0 bg-primary z-0"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6 text-primary-foreground">{t.ctaBarbers.title}</h2>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10">{t.ctaBarbers.desc}</p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 bg-background text-foreground hover:bg-background/90 font-bold text-lg">
                {t.ctaBarbers.become}
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 font-bold text-lg">
                {t.ctaBarbers.benefits}
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-background" id="faq">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-foreground">{t.faq.title}</h2>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
              {t.faq.items.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border border-border bg-secondary/20 rounded-xl px-6 py-2">
                  <AccordionTrigger className="text-left font-bold text-lg hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CONTACT */}
        <section className="py-24 border-t border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold mb-6 text-foreground">{t.contact.title}</h2>
                <p className="text-lg text-muted-foreground mb-8">{t.contact.lead}</p>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 text-foreground">
                    <Mail className="w-6 h-6 text-primary" />
                    <span className="text-lg font-medium">contact@globalbarber.com</span>
                  </div>
                  <div className="flex items-center gap-4 text-foreground">
                    <MapPin className="w-6 h-6 text-primary" />
                    <span className="text-lg font-medium">{t.contact.address}</span>
                  </div>
                </div>
              </div>

              <Card className="bg-background border-border">
                <CardContent className="p-8">
                  <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t.contact.name}</label>
                        <Input placeholder={t.contact.namePh} className="bg-secondary/50 border-border" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t.contact.email}</label>
                        <Input type="email" placeholder={t.contact.emailPh} className="bg-secondary/50 border-border" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{t.contact.message}</label>
                      <Textarea rows={5} placeholder={t.contact.messagePh} className="bg-secondary/50 border-border" />
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
                      {t.contact.send}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
