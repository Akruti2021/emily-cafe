'use client'
import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Coffee,
  Heart,
  LocateFixed,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Table2,
  Truck,
  Utensils,
  X,
} from 'lucide-react'

const categories = ['All', 'Rice', 'Burger', 'Pizza', 'Noodle', 'Drink']
const meals = [
  { name: 'Spaghetti Bolognese', category: 'Noodle', price: '4.99', image: 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=700&q=85' },
  { name: 'Cheese Burger', category: 'Burger', price: '5.25', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=85' },
  { name: 'Pizza Pepperoni', category: 'Pizza', price: '4.99', image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=85' },
  { name: 'Japanese Ramen', category: 'Noodle', price: '4.99', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=85' },
  { name: 'Spicy Macaroni', category: 'Noodle', price: '4.99', image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=700&q=85' },
  { name: 'Fried Chicken', category: 'Rice', price: '4.99', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=700&q=85' },
  { name: 'Special Fried Rice', category: 'Rice', price: '4.99', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=85' },
  { name: 'Iced Caramel Latte', category: 'Drink', price: '3.50', image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=85' },
]

function Logo() {
  return <a href="#home" className="logo" aria-label="Emily Cafe home"><span className="logo-mark"><Coffee size={21} /></span><span>Emily <b>Cafe</b></span></a>
}

export default function Page() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const filteredMeals = useMemo(() => meals.filter((meal) => (activeCategory === 'All' || meal.category === activeCategory) && meal.name.toLowerCase().includes(query.toLowerCase())), [activeCategory, query])

  return <main>
    {/* <header className="site-header"><div className="nav-wrap"><Logo /><nav className="desktop-nav" aria-label="Primary navigation"><a className="active" href="#home">Home</a><a href="#meals">Order</a><a href="#booking">Book</a><a href="#features">Catering</a><Link href="/login">Login</Link><a href="#meals">Cart <span className="cart-dot">2</span></a></nav><button className="mobile-trigger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen ? <X /> : <Menu />}</button></div>{mobileOpen && <nav className="mobile-nav"><a href="#home" onClick={() => setMobileOpen(false)}>Home</a><a href="#meals">Order</a><a href="#booking">Book</a><a href="#features">Catering</a><Link href="#/login">Login</Link><a href="#meals">Cart <span className="cart-dot">2</span></a></nav>}</header> */}

    <header className="site-header">
      <div className="nav-wrap">
        <Logo />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className="active" href="#home">Home</a>
          <a href="#meals">Order</a>
          <a href="#booking">Book</a>
          <a href="#features">Catering</a>
          <Link href="/login">Login</Link>
          <a href="#meals">Cart <span className="cart-dot">2</span></a>
        </nav>
        <button className="mobile-trigger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {mobileOpen && (
        <nav className="mobile-nav">
          <a href="#home" onClick={() => setMobileOpen(false)}>Home</a>
          <a href="#meals">Order</a>
          <a href="#booking">Book</a>
          <a href="#features">Catering</a>
          <Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
          <a href="#meals">Cart <span className="cart-dot">2</span></a>
        </nav>
      )}
    </header>
    
    <section className="hero" id="home"><div className="hero-copy"><p className="eyebrow"><Sparkles size={15} /> GOOD FOOD, GOOD MOOD</p><h1>Find your food<br /><em>delivered fresh</em><br />&amp; hot.</h1><p className="hero-text">From our kitchen to your doorstep, discover comforting flavors, warm service, and little moments worth savoring.</p><div className="location-search"><Search size={20} /><input aria-label="Find nearest food" placeholder="Find nearest food here" /><button>Set location <ChevronDown size={16} /></button></div><div className="hero-stats"><span><strong>4.9/5</strong><small>Guest rating</small></span><span><strong>20 min</strong><small>Average delivery</small></span><span><strong>100%</strong><small>Made fresh</small></span></div></div><div className="hero-art"><div className="art-glow" /><img className="hero-food-image" src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1100&q=90" alt="Fresh salmon sushi bowl with avocado and vegetables" /><div className="ingredient ingredient-one">🥒</div><div className="ingredient ingredient-two">🥕</div><div className="ingredient ingredient-three">✦</div><div className="chopstick stick-one" /><div className="chopstick stick-two" /><div className="hero-badge"><Star fill="currentColor" size={14} /><span>Chef&apos;s pick<small>Fresh every day</small></span></div></div></section>

    <section className="section features" id="features"><div className="section-heading centered"><p className="eyebrow">WHY EMILY CAFE</p><h2>Made for your <em>good days.</em></h2><p>Whatever the occasion, we bring a little more joy to the table.</p></div><div className="feature-grid"><Feature icon={<Truck />} title="Fast Delivery" text="Hot, fresh, and at your door before you can say seconds." /><Feature icon={<Utensils />} title="Catering" text="Thoughtful menus and generous servings for every gathering." /><Feature icon={<Table2 />} title="Book a Table" text="Reserve your favorite spot and make tonight feel special." action={() => setBookingOpen(true)} /></div></section>

    <section className="section meals" id="meals"><div className="section-heading meals-heading"><div><p className="eyebrow">OUR MENU</p><h2>Meals made with <em>heart.</em></h2></div><label className="meal-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" /></label></div><div className="category-tabs" role="tablist">{categories.map((category) => <button key={category} className={activeCategory === category ? 'selected' : ''} onClick={() => setActiveCategory(category)} role="tab" aria-selected={activeCategory === category}>{category}</button>)}</div><div className="meal-grid">{filteredMeals.map((meal) => <article className="meal-card" key={meal.name}><div className="meal-image"><img src={meal.image} alt={meal.name} /><button className="heart" aria-label={`Save ${meal.name}`}><Heart size={17} /></button></div><div className="meal-info"><div><h3>{meal.name}</h3><p><MapPin size={12} /> Emily Cafe, Jakarta</p></div><strong>${meal.price}</strong></div><div className="rating"><span>★★★★★</span> <small>4.9 · 156 reviews</small></div></article>)}</div>{filteredMeals.length === 0 && <p className="empty">No meals found. Try another search.</p>}<button className="outline-cta">View more <ArrowRight size={17} /></button></section>

    <section className="download"><div className="phone-stack"><div className="phone phone-back"><div className="phone-screen"><Coffee /></div></div><div className="phone phone-front"><div className="phone-screen"><span>Emily Cafe</span><strong>Good food<br />is here.</strong><div className="mini-food" /></div></div></div><div className="download-copy"><p className="eyebrow">EMILY CAFE IN YOUR POCKET</p><h2>Still get your favorite food<br /><em>whenever &amp; wherever.</em></h2><p>Order delivery, book a table, and cater your next gathering, all from our little app.</p><div className="store-badges"><button> <span>Download on the<br /><b>App Store</b></span></button><button>▶ <span>GET IT ON<br /><b>Google Play</b></span></button></div></div></section>

    <footer id="footer"><div className="footer-top"><Logo /><p>A cozy corner for delicious food,<br />warm coffee, and good company.</p></div><div className="footer-columns"><FooterColumn title="Get Started" links={['Booking a table', 'Delivery', 'Catering', 'Find a place']} /><FooterColumn title="Contact Us" links={['+62 213-0921', 'emilycafe@mail.com', 'Jakarta, Indonesia', 'Gedung 21 Lt 11']} /><FooterColumn title="About Us" links={['Our story', 'Careers', 'FAQ', 'News & events']} /><FooterColumn title="Connect With Us" links={['Instagram', 'Facebook', 'TikTok', 'LinkedIn']} /></div><div className="footer-bottom">© 2026 Emily Cafe. Made with care for hungry hearts.</div></footer>
    {bookingOpen && <div className="modal-backdrop" role="presentation" onClick={() => setBookingOpen(false)}><div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X /></button><p className="eyebrow">RESERVE YOUR SPOT</p><h2 id="booking-title">Book a table.</h2><p>We&apos;ll keep your favorite table warm.</p><div className="form-row"><label><span><CalendarDays size={15} /> Date</span><input type="date" /></label><label><span><Clock3 size={15} /> Time</span><input type="time" /></label></div><label className="select-label"><span><ShoppingBag size={15} /> Guests</span><select defaultValue="2"><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option><option value="5">5 guests</option></select></label><button className="primary-cta" onClick={() => setBookingOpen(false)}>Request reservation <ArrowRight size={17} /></button></div></div>}
  </main>
}

function Feature({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: () => void }) { return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><button onClick={action}>{title === 'Book a Table' ? 'Reserve now' : 'Check it out'} <ArrowRight size={15} /></button></article> }
function FooterColumn({ title, links }: { title: string; links: string[] }) { return <div><h3>{title}</h3>{links.map((link) => <a href="#home" key={link}>{link}</a>)}</div> }
