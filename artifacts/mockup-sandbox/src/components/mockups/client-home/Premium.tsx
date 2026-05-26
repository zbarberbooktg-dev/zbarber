import React from "react";
import {
  Bell,
  Search,
  MapPin,
  Star,
  ChevronRight,
  Heart,
  Home,
  Compass,
  Calendar,
  User,
  Scissors
} from "lucide-react";

export function Premium() {
  return (
    <div className="mx-auto w-[390px] min-h-screen bg-[#0A0A0A] text-[#F3F0E9] font-sans pb-24 overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap');
        
        .font-serif {
          font-family: 'Playfair Display', serif;
        }

        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      {/* Top Bar */}
      <header className="px-5 pt-12 pb-4 flex justify-between items-center sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] overflow-hidden flex-shrink-0">
            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#A09D94] uppercase tracking-widest">Lieu actuel</span>
            <button className="flex items-center gap-1 text-sm font-medium">
              Casablanca
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center relative">
          <Bell size={18} className="text-[#D4AF37]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#D4AF37] rounded-full border border-[#0A0A0A]"></span>
        </button>
      </header>

      <main>
        {/* Hero & Search */}
        <section className="px-5 mt-4 mb-8">
          <h1 className="font-serif text-4xl mb-1 text-white">Salut, Amine</h1>
          <p className="text-[#A09D94] mb-6 text-sm">Découvrez l'art du grooming d'exception.</p>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-[#D4AF37]" />
            </div>
            <input 
              type="text" 
              placeholder="Rechercher un salon, un style..." 
              className="w-full bg-[#141414] border border-[#2A2A2A] text-white rounded-none py-4 pl-12 pr-4 focus:outline-none focus:border-[#D4AF37] transition-colors placeholder:text-[#5A5A5A] text-sm"
            />
          </div>
        </section>

        {/* Hero Image */}
        <section className="px-5 mb-10">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img 
              src="/__mockup/images/client-home-premium/hero.png" 
              alt="Luxury barber interior" 
              className="w-full h-full object-cover grayscale-[0.2] brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>
            <div className="absolute bottom-4 left-4">
              <span className="px-3 py-1 bg-[#D4AF37] text-black text-xs font-semibold uppercase tracking-wider mb-2 inline-block">L'Édito</span>
              <h2 className="font-serif text-2xl text-white">La Renaissance du Rasage</h2>
            </div>
          </div>
        </section>

        {/* Salons en vedette */}
        <section className="mb-10">
          <div className="flex justify-between items-end px-5 mb-5">
            <h2 className="font-serif text-2xl">Salons en Vedette</h2>
            <button className="text-xs text-[#D4AF37] uppercase tracking-wider font-semibold">Tout voir</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto hide-scrollbar px-5 pb-4">
            {/* Card 1 */}
            <div className="w-[280px] flex-shrink-0 group">
              <div className="aspect-[3/4] overflow-hidden relative mb-4 border border-[#2A2A2A]">
                <img src="/__mockup/images/client-home-premium/salon1.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Le Barbier de Marrakech" />
                <button className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                  <Heart size={16} className="text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="flex items-center gap-1 text-[#D4AF37] mb-1">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold text-white">4.9</span>
                    <span className="text-xs text-white/60">(128)</span>
                  </div>
                </div>
              </div>
              <h3 className="font-serif text-xl mb-1 text-white">Maison Hassan</h3>
              <div className="flex items-center text-xs text-[#A09D94]">
                <MapPin size={12} className="mr-1" />
                <span>Gauthier • 1.2 km</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="w-[280px] flex-shrink-0 group">
              <div className="aspect-[3/4] overflow-hidden relative mb-4 border border-[#2A2A2A]">
                <img src="/__mockup/images/client-home-premium/salon2.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="L'Atelier du Barbier" />
                <button className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                  <Heart size={16} className="text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="flex items-center gap-1 text-[#D4AF37] mb-1">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold text-white">4.8</span>
                    <span className="text-xs text-white/60">(84)</span>
                  </div>
                </div>
              </div>
              <h3 className="font-serif text-xl mb-1 text-white">L'Atelier d'Anfa</h3>
              <div className="flex items-center text-xs text-[#A09D94]">
                <MapPin size={12} className="mr-1" />
                <span>Anfa • 2.5 km</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tendances Coupes */}
        <section className="mb-10 px-5">
          <div className="flex justify-between items-end mb-6">
            <h2 className="font-serif text-2xl">L'Inspiration</h2>
            <button className="text-xs text-[#D4AF37] uppercase tracking-wider font-semibold">Galerie</button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="relative aspect-square overflow-hidden border border-[#2A2A2A] group">
              <img src="/__mockup/images/client-home-premium/style1.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Fade" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
              <span className="absolute bottom-3 left-3 text-xs font-serif italic text-white">Le Dégradé</span>
            </div>
            <div className="relative aspect-square overflow-hidden border border-[#2A2A2A] group">
              <img src="/__mockup/images/client-home-premium/style2.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Barbe" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
              <span className="absolute bottom-3 left-3 text-xs font-serif italic text-white">La Barbe</span>
            </div>
            <div className="relative aspect-square overflow-hidden border border-[#2A2A2A] group">
              <img src="/__mockup/images/client-home-premium/style3.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Taper" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
              <span className="absolute bottom-3 left-3 text-xs font-serif italic text-white">Le Taper</span>
            </div>
            <div className="relative aspect-square overflow-hidden border border-[#2A2A2A] group">
              <img src="/__mockup/images/client-home-premium/style4.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Slick Back" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
              <span className="absolute bottom-3 left-3 text-xs font-serif italic text-white">Classique</span>
            </div>
          </div>
        </section>

        {/* Programme fidélité */}
        <section className="px-5 mb-10">
          <div className="bg-[#141414] border border-[#D4AF37]/30 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-serif text-xl text-white mb-1">Le Cercle</h3>
                  <p className="text-xs text-[#A09D94]">Membre Privilège</p>
                </div>
                <Scissors size={24} className="text-[#D4AF37]" strokeWidth={1} />
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs uppercase tracking-widest text-[#D4AF37]">Progression</span>
                <span className="text-sm font-serif">3 / 5</span>
              </div>
              
              <div className="flex gap-2 w-full">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className={`h-1 flex-1 ${step <= 3 ? 'bg-[#D4AF37]' : 'bg-[#2A2A2A]'}`}></div>
                ))}
              </div>
              
              <p className="text-xs text-[#A09D94] mt-4 text-center italic">Encore 2 prestations pour un soin offert.</p>
            </div>
          </div>
        </section>

        {/* Près de chez vous */}
        <section className="px-5 mb-6">
          <h2 className="font-serif text-2xl mb-6">Près de chez vous</h2>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 p-4 bg-[#141414] border border-[#2A2A2A] items-center">
              <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                <img src="/__mockup/images/client-home-premium/salon3.png" alt="Le Club" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-white mb-1">Le Club</h3>
                <div className="flex items-center text-xs text-[#A09D94] mb-2">
                  <MapPin size={10} className="mr-1" />
                  <span>Maarif • 0.4 km</span>
                </div>
                <div className="flex items-center gap-1 text-[#D4AF37]">
                  <Star size={10} fill="currentColor" />
                  <span className="text-xs text-white">4.7</span>
                </div>
              </div>
              <button className="w-10 h-10 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex gap-4 p-4 bg-[#141414] border border-[#2A2A2A] items-center">
              <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                <img src="/__mockup/images/client-home-premium/salon1.png" alt="Bourgogne Gentlemen" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-white mb-1">Bourgogne Gentlemen</h3>
                <div className="flex items-center text-xs text-[#A09D94] mb-2">
                  <MapPin size={10} className="mr-1" />
                  <span>Bourgogne • 0.8 km</span>
                </div>
                <div className="flex items-center gap-1 text-[#D4AF37]">
                  <Star size={10} fill="currentColor" />
                  <span className="text-xs text-white">4.9</span>
                </div>
              </div>
              <button className="w-10 h-10 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-[390px] bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#2A2A2A] pb-safe">
        <div className="flex justify-around items-center h-20 px-2">
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-[#D4AF37]">
            <Home size={22} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Découvrir</span>
          </button>
          
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-[#5A5A5A] hover:text-[#A09D94] transition-colors">
            <Compass size={22} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-wider">Explorer</span>
          </button>
          
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-[#5A5A5A] hover:text-[#A09D94] transition-colors">
            <Calendar size={22} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-wider">Mes RDV</span>
          </button>
          
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-[#5A5A5A] hover:text-[#A09D94] transition-colors">
            <Heart size={22} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-wider">Favoris</span>
          </button>
          
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-[#5A5A5A] hover:text-[#A09D94] transition-colors">
            <User size={22} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-wider">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
