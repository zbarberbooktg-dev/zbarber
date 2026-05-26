import React from 'react';
import { 
  Bell, 
  MapPin, 
  Search, 
  Star, 
  Heart, 
  Home, 
  Compass, 
  Calendar, 
  User, 
  ChevronRight 
} from 'lucide-react';

export function Modern() {
  return (
    <div className="font-['Plus_Jakarta_Sans'] bg-gray-50 text-gray-900 min-h-screen">
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      
      <div className="mx-auto w-[390px] min-h-screen bg-white relative pb-24 shadow-2xl overflow-hidden">
        
        {/* Header / Top bar */}
        <header className="px-5 pt-12 pb-4 flex justify-between items-center bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-200 transition-colors">
            <MapPin size={16} className="text-purple-600" />
            <span className="text-sm font-semibold text-gray-800">Casablanca</span>
            <ChevronRight size={14} className="text-gray-500 rotate-90" />
          </div>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer">
              <Bell size={22} className="text-gray-700" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-orange-400 p-[2px]">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Karim&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-8">
          
          {/* Hero / Welcome */}
          <section className="px-5 pt-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-1">
              Salut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-orange-500">Karim!</span> 👋
            </h1>
            <p className="text-gray-500 text-sm font-medium mb-6">Prêt pour un nouveau look aujourd'hui?</p>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder="Rechercher un salon, un style..." 
                className="w-full bg-gray-100 text-gray-800 text-sm font-medium rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow shadow-sm"
              />
            </div>
            
            <div className="mt-6 rounded-3xl overflow-hidden relative shadow-lg shadow-purple-200">
              <img src="/__mockup/images/client-home-modern/hero.png" alt="Promo" className="w-full h-40 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex flex-col justify-center px-6">
                <span className="bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md w-max mb-2">Offre Spéciale</span>
                <h3 className="text-white font-bold text-lg leading-tight mb-1">Découvrez le<br/>VIP Grooming</h3>
                <p className="text-gray-200 text-xs">-20% sur votre première séance</p>
              </div>
            </div>
          </section>

          {/* Tendances coupes */}
          <section className="pl-5 overflow-hidden">
            <div className="flex justify-between items-end pr-5 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Tendances coupes 🔥</h2>
              <span className="text-sm font-semibold text-purple-600 cursor-pointer">Voir tout</span>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 pr-5 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { img: 'cut1.png', tag: 'Fade', label: 'Mid Fade Classique' },
                { img: 'cut2.png', tag: 'Dégradé', label: 'Dégradé Haut' },
                { img: 'cut3.png', tag: 'Barbe', label: 'Taille Barbe' },
                { img: 'cut4.png', tag: 'Taper', label: 'Taper Fade' },
              ].map((item, i) => (
                <div key={i} className="min-w-[140px] snap-start relative group cursor-pointer">
                  <div className="w-[140px] h-[180px] rounded-2xl overflow-hidden shadow-md">
                    <img src={`/__mockup/images/client-home-modern/${item.img}`} alt={item.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  </div>
                  <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    {item.tag}
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white text-xs font-bold leading-tight drop-shadow-md">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Salons en vedette */}
          <section className="pl-5 overflow-hidden">
            <div className="flex justify-between items-end pr-5 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Salons en vedette 🌟</h2>
            </div>
            
            <div className="flex gap-5 overflow-x-auto pb-6 pr-5 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { name: 'Le Barbier de Marrakech', area: 'Maarif', rating: 4.9, dist: '1.2 km', img: 'salon1.png', color: 'from-purple-500 to-indigo-500' },
                { name: 'Maison Hassan', area: 'Gauthier', rating: 4.8, dist: '2.5 km', img: 'salon2.png', color: 'from-orange-500 to-red-500' },
                { name: 'Gentlemen\'s Club', area: 'Anfa', rating: 4.7, dist: '3.1 km', img: 'salon3.png', color: 'from-teal-500 to-emerald-500' }
              ].map((salon, i) => (
                <div key={i} className="min-w-[260px] bg-white rounded-3xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 snap-start cursor-pointer hover:border-purple-200 transition-colors">
                  <div className="relative h-[130px] rounded-2xl overflow-hidden mb-3">
                    <img src={`/__mockup/images/client-home-modern/${salon.img}`} alt={salon.name} className="w-full h-full object-cover" />
                    <button className="absolute top-3 right-3 w-8 h-8 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-red-500 transition-colors">
                      <Heart size={16} className={i === 0 ? "fill-red-500 text-red-500" : ""} />
                    </button>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" /> {salon.rating}
                    </div>
                  </div>
                  <div className="px-1">
                    <h3 className="font-bold text-gray-900 text-base mb-1 truncate">{salon.name}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} /> {salon.area}
                      </div>
                      <span className="bg-gray-100 px-2 py-1 rounded-md text-gray-600">{salon.dist}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Programme fidélité */}
          <section className="px-5">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-orange-500/20 rounded-full blur-3xl"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h2 className="text-lg font-bold mb-1">Programme Fidélité</h2>
                  <p className="text-gray-400 text-xs">Plus que 2 coupes pour un soin offert!</p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎁</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center relative z-10">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                      step <= 3 
                        ? 'bg-gradient-to-tr from-purple-500 to-orange-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-110' 
                        : step === 5 
                          ? 'bg-white/10 text-gray-400 border border-dashed border-white/20' 
                          : 'bg-gray-700 text-gray-500'
                    }`}>
                      {step === 5 ? '🎁' : step <= 3 ? '✓' : step}
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-[44px] left-8 right-8 h-1 bg-gray-700 -z-0">
                <div className="h-full bg-gradient-to-r from-purple-500 to-orange-400 w-1/2 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
              </div>
            </div>
          </section>

          {/* Près de chez vous */}
          <section className="px-5 mb-8">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-bold text-gray-900">Près de chez vous 📍</h2>
            </div>
            
            <div className="flex flex-col gap-4">
              {[
                { name: 'Barber Shop Bourgogne', dist: '0.4 km', price: 'À partir de 150 DH', img: 'salon3.png' },
                { name: 'Classic Cuts', dist: '0.8 km', price: 'À partir de 120 DH', img: 'salon1.png' }
              ].map((salon, i) => (
                <div key={i} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                    <img src={`/__mockup/images/client-home-modern/${salon.img}`} alt={salon.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate mb-1">{salon.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{salon.dist} • {salon.price}</p>
                    <button className="bg-purple-50 text-purple-600 font-bold text-xs py-1.5 px-3 rounded-lg hover:bg-purple-100 transition-colors w-max">
                      Réserver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-6 flex justify-between items-center z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl h-[88px]">
          {[
            { icon: Compass, label: 'Découvrir', active: true },
            { icon: Search, label: 'Explorer', active: false },
            { icon: Calendar, label: 'Mes RDV', active: false },
            { icon: Heart, label: 'Favoris', active: false },
            { icon: User, label: 'Profil', active: false },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 cursor-pointer group">
              <div className={`relative p-2 rounded-xl transition-all duration-300 ${item.active ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {item.active && (
                  <div className="absolute inset-0 bg-purple-50 rounded-xl -z-10 scale-110"></div>
                )}
                <item.icon size={24} className={item.active ? 'stroke-[2.5px]' : 'stroke-2'} />
              </div>
              <span className={`text-[10px] font-bold ${item.active ? 'text-purple-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </nav>

        {/* Add safe area padding for modern phones */}
        <style dangerouslySetInnerHTML={{__html: `
          .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        `}} />
      </div>
    </div>
  );
}
