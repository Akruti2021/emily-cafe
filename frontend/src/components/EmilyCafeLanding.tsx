'use client'
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react'
import { api, getErrorMessage } from '../api/client'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coffee,
  Heart,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Table2,
  Truck,
  Utensils,
  X,
} from 'lucide-react'

const fallbackCategories = ['All', 'Rice', 'Burger', 'Pizza', 'Noodle', 'Drink']
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
const fallbackMenuImage = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=85'
type LiveMeal = { id: string; name: string; category: string; price: number; taxRate: number; image: string }
type CartLine = { menuItemId: string; name: string; price: number; taxRate: number; quantity: number }

function Logo() {
  return <a href="#home" className="logo" aria-label="Emily Cafe home"><span className="logo-mark"><Coffee size={21} /></span><span>Emily <b>Cafe</b></span></a>
}

export default function Page() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [liveMeals, setLiveMeals] = useState<LiveMeal[] | null>(null)
  const [liveCategories, setLiveCategories] = useState<string[]>([])
  const [liveMenuLoading, setLiveMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [tableOrder, setTableOrder] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderConfirmation, setOrderConfirmation] = useState<{ orderNumber: string; grandTotal: number } | null>(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const scannedRestaurantId = params.get('restaurantId')
      const scannedTableId = params.get('tableId')
      setRestaurantId(scannedRestaurantId)
      setTableId(scannedTableId)
      setTableOrder(Boolean(scannedRestaurantId && scannedTableId))
      if (!scannedRestaurantId) return

      setLiveMeals([])
      setLiveMenuLoading(true)
      setMenuError('')
      api.get<{
        categories: Array<{
          name: string;
          items: Array<{ id: string; name: string; price: number | string; taxRate?: number | string; status?: string }>;
        }>;
      }>(`/menu/${encodeURIComponent(scannedRestaurantId)}`)
        .then(({ data }) => {
          if (!active) return
          const availableCategories = (data.categories ?? []).filter((category) =>
            category.items.some((item) => item.status !== 'inactive'),
          )
          setLiveCategories(availableCategories.map((category) => category.name))
          setLiveMeals(availableCategories.flatMap((category) => category.items
            .filter((item) => item.status !== 'inactive')
            .map((item) => ({
              id: item.id,
              name: item.name,
              category: category.name,
              price: Number(item.price),
              taxRate: Number(item.taxRate ?? 0),
              image: fallbackMenuImage,
            }))))
        })
        .catch((err: unknown) => {
          if (active) setMenuError(getErrorMessage(err))
        })
        .finally(() => {
          if (active) setLiveMenuLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const shownMeals = liveMeals ?? meals
  const categories = liveMeals === null ? fallbackCategories : ['All', ...liveCategories]
  const filteredMeals = useMemo(() => shownMeals.filter((meal) =>
    (activeCategory === 'All' || meal.category === activeCategory) &&
    meal.name.toLowerCase().includes(query.toLowerCase()),
  ), [shownMeals, activeCategory, query])
  const canOrder = Boolean(tableOrder && restaurantId && tableId && liveMeals !== null)
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)
  const cartSubtotal = cart.reduce((total, item) => total + Math.round(item.price * item.quantity * 100) / 100, 0)
  const cartTax = cart.reduce((total, item) => total + Math.round(item.price * item.quantity * item.taxRate) / 100, 0)
  const cartTotal = cartSubtotal + cartTax

  function addToCart(meal: { id?: string; name: string; price: number | string; taxRate?: number }) {
    const menuItemId = meal.id
    if (!menuItemId || !canOrder) return
    setOrderError('')
    setCart((current) => {
      const existing = current.find((item) => item.menuItemId === menuItemId)
      if (existing) {
        return current.map((item) => item.menuItemId === menuItemId
          ? { ...item, quantity: Math.min(item.quantity + 1, 20) }
          : item)
      }
      return [...current, {
        menuItemId,
        name: meal.name,
        price: Number(meal.price),
        taxRate: meal.taxRate ?? 0,
        quantity: 1,
      }]
    })
  }

  function changeCartQuantity(menuItemId: string, delta: number) {
    setCart((current) => current
      .map((item) => item.menuItemId === menuItemId
        ? { ...item, quantity: Math.min(item.quantity + delta, 20) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  async function submitDineInOrder() {
    if (!restaurantId || !tableId || cart.length === 0) return
    setSubmittingOrder(true)
    setOrderError('')
    try {
      const { data } = await api.post<{ orderNumber: string; grandTotal: number }>('/orders/dine-in', {
        restaurantId,
        tableId,
        items: cart.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
      })
      setOrderConfirmation(data)
      setCart([])
      setCartOpen(false)
    } catch (err) {
      setOrderError(getErrorMessage(err))
    } finally {
      setSubmittingOrder(false)
    }
  }

  const formatRupees = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount)

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

    {tableOrder && <div role="status" className="mx-auto mt-5 max-w-6xl rounded-xl bg-[#eff6ff] px-5 py-3 text-sm font-medium text-[#1d4ed8]">You&apos;re viewing the menu for your table.</div>}
    <section className="section meals" id="meals">
      <div className="section-heading meals-heading">
        <div><p className="eyebrow">OUR MENU</p><h2>Meals made with <em>heart.</em></h2></div>
        <label className="meal-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" /></label>
      </div>
      {categories.length > 1 && <div className="category-tabs" role="tablist">{categories.map((category) => <button key={category} className={activeCategory === category ? 'selected' : ''} onClick={() => setActiveCategory(category)} role="tab" aria-selected={activeCategory === category}>{category}</button>)}</div>}
      {liveMenuLoading && <p className="empty" role="status">Loading the current menu...</p>}
      {menuError && <p className="empty" role="alert">The live menu could not be loaded: {menuError}</p>}
      {!liveMenuLoading && liveMeals !== null && liveMeals.length === 0 && !menuError && <p className="empty">There are no active menu items yet.</p>}
      <div className="meal-grid">
        {filteredMeals.map((meal) => (
          <article className="meal-card" key={'id' in meal ? meal.id : meal.name}>
            <div className="meal-image">
              <img src={meal.image} alt={meal.name} />
              {canOrder && 'id' in meal ? (
                <button className="heart" aria-label={`Add ${meal.name} to your order`} onClick={() => addToCart(meal)}>
                  <Plus size={17} />
                </button>
              ) : (
                <button className="heart" aria-label={`Save ${meal.name}`}><Heart size={17} /></button>
              )}
            </div>
            <div className="meal-info">
              <div><h3>{meal.name}</h3><p><MapPin size={12} /> Emily Cafe</p></div>
              <strong>{liveMeals !== null ? formatRupees(Number(meal.price)) : `$${Number(meal.price).toFixed(2)}`}</strong>
            </div>
            <div className="rating"><span>★★★★★</span> <small>4.9 · 156 reviews</small></div>
          </article>
        ))}
      </div>
      {!liveMenuLoading && filteredMeals.length === 0 && (liveMeals === null || liveMeals.length > 0) && !menuError && <p className="empty">No meals found. Try another search.</p>}
      {liveMeals === null && <button className="outline-cta">View more <ArrowRight size={17} /></button>}
    </section>

    {canOrder && cartCount > 0 && !cartOpen && (
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-5 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#2563eb] px-5 py-3.5 text-sm font-semibold text-white shadow-xl transition hover:bg-[#1d4ed8]"
      >
        <ShoppingBag size={17} /> {cartCount} {cartCount === 1 ? 'item' : 'items'} · {formatRupees(cartTotal)}
      </button>
    )}

    {cartOpen && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5" role="presentation" onClick={() => setCartOpen(false)}>
        <section
          className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 text-[#302a26] shadow-2xl sm:rounded-3xl sm:p-7"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">DINE IN</p><h2 id="order-title" className="mt-1 text-2xl font-semibold">Your order</h2><p className="mt-1 text-sm text-[#817a74]">Your table has been included with this order.</p></div>
            <button type="button" onClick={() => setCartOpen(false)} aria-label="Close order" className="rounded-full p-2 text-[#817a74] hover:bg-[#f5f2ed]"><X size={19} /></button>
          </div>

          <div className="mt-6 space-y-3">
            {cart.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between gap-4 rounded-xl border border-[#eee8df] p-3.5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-[#817a74]">{formatRupees(item.price)} each</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => changeCartQuantity(item.menuItemId, -1)} aria-label={`Remove one ${item.name}`} className="flex size-8 items-center justify-center rounded-full border border-[#e8e2da] text-[#625a53] hover:bg-[#f5f2ed]"><Minus size={14} /></button>
                  <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                  <button type="button" onClick={() => changeCartQuantity(item.menuItemId, 1)} aria-label={`Add one ${item.name}`} disabled={item.quantity >= 20} className="flex size-8 items-center justify-center rounded-full border border-[#e8e2da] text-[#625a53] hover:bg-[#f5f2ed] disabled:opacity-40"><Plus size={14} /></button>
                </div>
                <strong className="shrink-0 text-sm">{formatRupees(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>

          {orderError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{orderError}</p>}
          <div className="mt-5 space-y-2 border-t border-[#eee8df] pt-4 text-sm">
            <div className="flex justify-between text-[#817a74]"><span>Subtotal</span><span>{formatRupees(cartSubtotal)}</span></div>
            <div className="flex justify-between text-[#817a74]"><span>Tax</span><span>{formatRupees(cartTax)}</span></div>
            <div className="flex justify-between pt-1 text-base font-semibold"><span>Total</span><span>{formatRupees(cartTotal)}</span></div>
          </div>
          <button type="button" onClick={() => void submitDineInOrder()} disabled={submittingOrder || cart.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50">
            {submittingOrder ? <span className="size-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : <CheckCircle2 size={17} />}
            {submittingOrder ? 'Sending order...' : 'Place dine-in order'}
          </button>
          <p className="mt-3 text-center text-[11px] text-[#928b84]">Your order will be saved to the restaurant&apos;s order list.</p>
        </section>
      </div>
    )}

    {orderConfirmation && (
      <div role="status" className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-4 rounded-2xl bg-emerald-700 px-4 py-3.5 text-white shadow-xl">
        <div className="flex items-center gap-3"><CheckCircle2 size={21} /><div><p className="text-sm font-semibold">Order sent · {orderConfirmation.orderNumber}</p><p className="mt-0.5 text-xs text-emerald-100">Total {formatRupees(orderConfirmation.grandTotal)}</p></div></div>
        <button type="button" onClick={() => setOrderConfirmation(null)} aria-label="Dismiss order confirmation" className="rounded-full p-1.5 hover:bg-emerald-600"><X size={16} /></button>
      </div>
    )}

    <section className="download"><div className="phone-stack"><div className="phone phone-back"><div className="phone-screen"><Coffee /></div></div><div className="phone phone-front"><div className="phone-screen"><span>Emily Cafe</span><strong>Good food<br />is here.</strong><div className="mini-food" /></div></div></div><div className="download-copy"><p className="eyebrow">EMILY CAFE IN YOUR POCKET</p><h2>Still get your favorite food<br /><em>whenever &amp; wherever.</em></h2><p>Order delivery, book a table, and cater your next gathering, all from our little app.</p><div className="store-badges"><button> <span>Download on the<br /><b>App Store</b></span></button><button>▶ <span>GET IT ON<br /><b>Google Play</b></span></button></div></div></section>

    <footer id="footer"><div className="footer-top"><Logo /><p>A cozy corner for delicious food,<br />warm coffee, and good company.</p></div><div className="footer-columns"><FooterColumn title="Get Started" links={['Booking a table', 'Delivery', 'Catering', 'Find a place']} /><FooterColumn title="Contact Us" links={['+62 213-0921', 'emilycafe@mail.com', 'Jakarta, Indonesia', 'Gedung 21 Lt 11']} /><FooterColumn title="About Us" links={['Our story', 'Careers', 'FAQ', 'News & events']} /><FooterColumn title="Connect With Us" links={['Instagram', 'Facebook', 'TikTok', 'LinkedIn']} /></div><div className="footer-bottom">© 2026 Emily Cafe. Made with care for hungry hearts.</div></footer>
    {bookingOpen && <div className="modal-backdrop" role="presentation" onClick={() => setBookingOpen(false)}><div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X /></button><p className="eyebrow">RESERVE YOUR SPOT</p><h2 id="booking-title">Book a table.</h2><p>We&apos;ll keep your favorite table warm.</p><div className="form-row"><label><span><CalendarDays size={15} /> Date</span><input type="date" /></label><label><span><Clock3 size={15} /> Time</span><input type="time" /></label></div><label className="select-label"><span><ShoppingBag size={15} /> Guests</span><select defaultValue="2"><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option><option value="5">5 guests</option></select></label><button className="primary-cta" onClick={() => setBookingOpen(false)}>Request reservation <ArrowRight size={17} /></button></div></div>}
  </main>
}

function Feature({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: () => void }) { return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><button onClick={action}>{title === 'Book a Table' ? 'Reserve now' : 'Check it out'} <ArrowRight size={15} /></button></article> }
function FooterColumn({ title, links }: { title: string; links: string[] }) { return <div><h3>{title}</h3>{links.map((link) => <a href="#home" key={link}>{link}</a>)}</div> }
