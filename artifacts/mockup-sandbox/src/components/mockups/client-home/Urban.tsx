import React from "react";
import { Search, Bell, MapPin, Star, Heart, Calendar, User, Home, Compass, ChevronRight, Map } from "lucide-react";

export function Urban() {
  return (
    <div className="mx-auto w-[390px] min-h-screen bg-zinc-950 text-white pb-20 relative overflow-hidden font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap');
        .font-anton { font-family: 'Anton', sans-serif; letter-spacing: 0.02em; }
        .bg-grid {
          background-size: 20px 20px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        }
        .text-stroke {
          -webkit-text-stroke: 1px rgba(255,255,255,0.2);
          color: transparent;
        }
      `}</style>

      {/* Noise overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] z-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

      <div className="bg-grid absolute inset-0 opacity-50 z-0"></div>

      <div className="relative z-10">
        {/* Header */}
        <header className="px-5 pt-12 pb-4 flex justify-between items-center bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 border-b-2 border-red-600">
          <div className="flex items-center gap-2 cursor-pointer group">
            <MapPin size={18} className="text-red-500" strokeWidth={2.5} />
            <span className="font-anton text-xl uppercase tracking-wide mt-1">Casablanca</span>
            <ChevronRight size={16} className="text-zinc-500 rotate-90" strokeWidth={3} />
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell size={22} className="text-white" strokeWidth={2} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-zinc-950"></span>
            </div>
            <div className="w-9 h-9 rounded-none border-2 border-white bg-zinc-800 overflow-hidden transform -rotate-3 hover:rotate-0 transition-transform">
              <img src="/__mockup/images/client-home-urban/style-1.png" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="px-5 pt-8 pb-6">
          <h2 className="text-zinc-400 font-bold tracking-widest text-sm mb-1 uppercase">Salut, Karim</h2>
          <h1 className="font-anton text-6xl uppercase leading-[0.85] mb-6 text-white">
            Trouve ton <br />
            <span className="text-red-600">vrai style</span>
          </h1>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-red-600 translate-x-1 translate-y-1 z-0"></div>
            <div className="relative z-10 flex items-center bg-zinc-900 border-2 border-white p-3">
              <Search size={20} className="text-zinc-400 mr-3" strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="RECHERCHER UN SALON, UN STYLE..." 
                className="bg-transparent border-none outline-none w-full text-white placeholder:text-zinc-500 font-bold text-sm tracking-wide"
              />
            </div>
          </div>
        </section>

        {/* Banner */}
        <section className="px-5 mb-10">
          <div className="relative h-40 w-full border-2 border-zinc-800 overflow-hidden group">
            <img src="/__mockup/images/client-home-urban/hero.png" alt="Hero banner" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent"></div>
            <div className="absolute bottom-4 left-4">
              <div className="bg-red-600 text-white font-anton px-3 py-1 text-xl uppercase inline-block mb-1 transform -skew-x-6">Offre de la rue</div>
              <p className="font-bold text-sm tracking-wide">-20% SUR TON PREMIER DÉGRADÉ</p>
            </div>
          </div>
        </section>

        {/* Ticker */}
        <div className="bg-red-600 w-full py-2 flex overflow-hidden mb-10 border-y-2 border-white -rotate-1 origin-left transform scale-105">
          <div className="whitespace-nowrap font-anton uppercase text-black text-xl tracking-widest flex items-center">
            <span className="mx-4">• FRESH FADE •</span>
            <span className="mx-4 text-white text-stroke">STAY SHARP</span>
            <span className="mx-4">• FRESH FADE •</span>
            <span className="mx-4 text-white text-stroke">STAY SHARP</span>
            <span className="mx-4">• FRESH FADE •</span>
            <span className="mx-4 text-white text-stroke">STAY SHARP</span>
          </div>
        </div>

        {/* Salons en vedette */}
        <section className="mb-10 pl-5 overflow-hidden">
          <div className="flex justify-between items-end pr-5 mb-5">
            <h2 className="font-anton text-3xl uppercase tracking-wide">La crème de<br/>la rue</h2>
            <a href="#" className="text-red-500 font-bold text-xs uppercase tracking-widest flex items-center hover:text-red-400">
              Voir tout <ChevronRight size={14} />
            </a>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 pr-5 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {[
              { name: "LE BARBIER DE MARRAKECH", area: "Maarif", distance: "1.2 km", rating: "4.9", img: "salon-1.png" },
              { name: "MAISON HASSAN", area: "Gauthier", distance: "2.4 km", rating: "4.8", img: "salon-2.png" },
              { name: "URBAN CUTS", area: "Anfa", distance: "3.1 km", rating: "4.7", img: "salon-3.png" }
            ].map((salon, i) => (
              <div key={i} className="min-w-[240px] snap-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-600 translate-x-1.5 translate-y-1.5 z-0"></div>
                  <div className="border-2 border-zinc-800 bg-zinc-950 relative z-10 hover:border-white transition-colors cursor-pointer">
                    <div className="h-32 w-full relative border-b-2 border-zinc-800 overflow-hidden">
                      <img src={`/__mockup/images/client-home-urban/${salon.img}`} className="w-full h-full object-cover grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300" alt={salon.name} />
                      <div className="absolute top-2 right-2 bg-black/80 font-bold px-2 py-1 text-xs border border-zinc-700 flex items-center gap-1 backdrop-blur-sm">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" /> {salon.rating}
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-anton text-xl truncate uppercase">{salon.name}</h3>
                      <div className="flex items-center justify-between mt-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><MapPin size={12} className="text-red-500"/> {salon.area}</span>
                        <span>{salon.distance}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Programme Fidélité */}
        <section className="px-5 mb-10">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-yellow-500 translate-x-1.5 translate-y-1.5 z-0"></div>
            <div className="border-2 border-white bg-zinc-900 p-5 relative z-10 flex items-center justify-between">
              <div>
                <h3 className="font-anton text-2xl uppercase mb-1 text-yellow-500">RESPECT & LOYAUTÉ</h3>
                <p className="text-xs font-bold text-zinc-300 tracking-wider">3 COUPES / 5 POUR UN SOIN OFFERT</p>
                
                <div className="flex gap-2 mt-4">
                  {[1, 2, 3, 4, 5].map(step => (
                    <div key={step} className={`w-8 h-8 flex items-center justify-center font-anton text-xl border-2 ${step <= 3 ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-700'}`}>
                      {step <= 3 ? 'X' : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-12 h-12 bg-white flex items-center justify-center border-2 border-black transform rotate-12 group-hover:rotate-0 transition-transform">
                <Star size={24} className="text-black fill-black" />
              </div>
            </div>
          </div>
        </section>

        {/* Tendances coupes */}
        <section className="px-5 mb-10">
          <div className="flex justify-between items-end mb-5">
            <h2 className="font-anton text-3xl uppercase tracking-wide">Tendances<br/>du moment</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { tag: "FADE", img: "style-1.png", color: "bg-red-600" },
              { tag: "TAPER", img: "style-2.png", color: "bg-yellow-500 text-black" },
              { tag: "BARBE", img: "style-3.png", color: "bg-white text-black" },
              { tag: "DÉGRADÉ", img: "style-4.png", color: "bg-zinc-800" }
            ].map((style, i) => (
              <div key={i} className="relative aspect-[3/4] border-2 border-zinc-800 overflow-hidden group cursor-pointer">
                <img src={`/__mockup/images/client-home-urban/${style.img}`} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500" alt={style.tag} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className={`absolute bottom-3 right-3 px-2 py-1 font-anton uppercase text-lg transform -skew-x-6 border-l-2 border-black ${style.color}`}>
                  {style.tag}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Près de chez vous */}
        <section className="px-5 mb-6">
          <h2 className="font-anton text-3xl uppercase tracking-wide mb-5">Dans ton <span className="text-red-600">secteur</span></h2>
          
          <div className="flex flex-col gap-4">
            {[
              { name: "THE GENTLEMEN'S CLUB", area: "Bourgogne", distance: "800m", price: "250 DH" },
              { name: "STREET CUTZ", area: "Maarif", distance: "1.5 km", price: "180 DH" }
            ].map((salon, i) => (
              <div key={i} className="border-2 border-zinc-800 p-3 flex gap-4 items-center bg-zinc-900/50 hover:bg-zinc-900 transition-colors cursor-pointer group">
                <div className="w-20 h-20 border-2 border-zinc-700 shrink-0 overflow-hidden">
                  <img src={`/__mockup/images/client-home-urban/salon-${i+1}.png`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="Salon" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-anton text-lg truncate uppercase">{salon.name}</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1 mt-1">
                    <Map size={12} /> {salon.distance} • {salon.area}
                  </p>
                  <p className="text-sm font-bold mt-1 text-red-500">{salon.price}</p>
                </div>
                <button className="h-10 px-4 bg-white text-black font-anton uppercase transform -skew-x-6 border-b-2 border-r-2 border-zinc-400 active:translate-x-0.5 active:translate-y-0.5 active:border-b-0 active:border-r-0 transition-all shrink-0">
                  GO
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] bg-zinc-950 border-t-2 border-zinc-800 z-50">
        <div className="flex justify-between items-center px-6 h-16">
          {[
            { icon: Compass, label: "Découvrir", active: true },
            { icon: Search, label: "Explorer", active: false },
            { icon: Calendar, label: "Mes RDV", active: false },
            { icon: Heart, label: "Favoris", active: false },
            { icon: User, label: "Profil", active: false },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 cursor-pointer">
              <item.icon size={22} className={item.active ? "text-red-500" : "text-zinc-500"} strokeWidth={item.active ? 2.5 : 2} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${item.active ? "text-white" : "text-zinc-600"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
