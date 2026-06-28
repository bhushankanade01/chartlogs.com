import { useLocation } from "wouter";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Plug,
  Brain,
  Calendar,
  BarChart3,
  Lock,
  Sun,
  Moon,
  Check,
  X,
  Star,
  TrendingUp,
  Zap,
  ArrowRight,
  ChevronDown,
  Menu,
} from "lucide-react";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealDiv({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const features = [
  {
    icon: Plug,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    title: "Live MT4/MT5 Sync",
    description:
      "Connect your broker account once. Every closed trade syncs instantly — no manual entry, no CSV exports, no delays.",
    badge: "Auto-sync every 3 min",
  },
  {
    icon: Brain,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "AI Trading Reports",
    description:
      "Get AI-generated weekly analysis: what worked, what didn't, and exactly what to improve next week.",
    badge: "50+ patterns analyzed",
  },
  {
    icon: Calendar,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Economic Calendar",
    description:
      "Stay ahead of market-moving events. Filter by impact level and track how news affects your trades.",
    badge: "Live event data",
  },
  {
    icon: BarChart3,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Performance Analytics",
    description:
      "Win rate, profit factor, risk-reward ratio — every metric pros use, updated in real-time as you trade.",
    badge: "30+ metrics",
  },
  {
    icon: Sun,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    title: "Dark & Light Mode",
    description:
      "Trade at night or in daylight. Full theme support with instant switching — your preference saved automatically.",
    badge: "Saved to device",
    isTheme: true,
  },
  {
    icon: Lock,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "Secure & Private",
    description:
      "256-bit encryption. Read-only broker access. Your data is yours — never sold, never shared.",
    badge: "GDPR compliant",
  },
];

const comparisonRows = [
  { label: "Trade entry", manual: "Manual typing every trade", cl: "Auto-synced in seconds" },
  { label: "Data accuracy", manual: "Error-prone, easy to miss", cl: "100% accurate, automated" },
  { label: "Time required", manual: "30–60 min per week", cl: "Zero — it's all automatic" },
  { label: "Historical imports", manual: "Tedious CSV formatting", cl: "One-click CSV import" },
  { label: "AI analysis", manual: "Not available", cl: "Weekly AI report included" },
  { label: "Real-time sync", manual: "Never", cl: "Every 3 minutes" },
];

const pricingTiers = [
  {
    name: "Free",
    price: "₹0",
    period: "/forever",
    description: "Perfect for getting started",
    popular: false,
    features: [
      "Manual trade entry",
      "CSV import",
      "Basic analytics",
      "Economic calendar",
      "Up to 200 trades",
    ],
    cta: "Get Started Free",
    variant: "outline" as const,
  },
  {
    name: "Pro",
    price: "₹1,499",
    period: "/month",
    description: "For active traders serious about growth",
    popular: true,
    features: [
      "Everything in Free",
      "1 MT4/MT5 broker account",
      "Live auto-sync",
      "AI weekly reports",
      "Unlimited trades",
      "Journal & tagging",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    variant: "default" as const,
  },
  {
    name: "Elite",
    price: "₹1,999",
    period: "/month",
    description: "For professional traders & prop firms",
    popular: false,
    features: [
      "Everything in Pro",
      "Unlimited MT accounts",
      "Advanced AI analysis",
      "Multi-account analytics",
      "Custom tags & strategies",
      "CSV/PDF export",
      "Dedicated support",
    ],
    cta: "Start Elite Trial",
    variant: "outline" as const,
  },
];

const testimonials = [
  {
    name: "Rajesh K.",
    role: "Forex Trader · 6 years",
    quote:
      "I used to spend Sunday evenings filling in spreadsheets. ChartLogs killed that habit. My broker syncs in the background and I get an AI report every Monday morning. Game-changer.",
    rating: 5,
  },
  {
    name: "Priya M.",
    role: "Gold & Indices Trader",
    quote:
      "The AI weekly analysis actually pinpointed that I was overtrading during the London-NY overlap. My win rate went from 51% to 63% in 6 weeks after fixing that.",
    rating: 5,
  },
  {
    name: "Amit S.",
    role: "MT5 Prop Trader",
    quote:
      "Finally a journal that doesn't make me do homework. My trades appear automatically, the analytics are clear, and the dark mode is perfect for my late-night sessions.",
    rating: 5,
  },
];

function HeroSection({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex flex-col items-center justify-center text-center px-4 pt-20 pb-24">
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 hero-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary mb-8 animate-fade-in">
          <Zap className="h-3.5 w-3.5" />
          AI-powered · Live MT4/MT5 sync · No manual entry
        </div>

        <h1
          className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-tight animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          Your Trading Edge
          <br />
          <span className="gradient-text">Starts Here</span>
        </h1>

        <p
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          AI-powered trading journal with live MT4/MT5 sync. Track, analyze, and optimize your
          trades automatically — no spreadsheets, no manual entry.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <Button size="lg" className="px-8 text-base h-12 shadow-lg shadow-primary/25" onClick={onRegister}>
            Start Free Trial
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="px-8 text-base h-12" onClick={onLogin}>
            View Demo
          </Button>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-in"
          style={{ animationDelay: "400ms" }}
        >
          {["100+ Active Traders", "99.95% Uptime", "Bank-Grade Security"].map((badge) => (
            <div key={badge} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              {badge}
            </div>
          ))}
        </div>
      </div>

      <div
        className="relative z-10 mt-16 w-full max-w-5xl mx-auto animate-fade-in"
        style={{ animationDelay: "500ms" }}
      >
        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl shadow-black/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
            <div className="w-3 h-3 rounded-full bg-rose-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-xs text-muted-foreground font-mono">ChartLogs Dashboard</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Total P&L", value: "+₹84,230", color: "text-emerald-400" },
                { label: "Win Rate", value: "67.3%", color: "text-indigo-400" },
                { label: "Profit Factor", value: "2.41", color: "text-cyan-400" },
                { label: "Total Trades", value: "142", color: "text-violet-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-muted/40 rounded-lg p-3 text-left">
                  <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                  <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="h-28 bg-muted/30 rounded-lg flex items-end gap-1 px-4 pb-3 overflow-hidden">
              {[40, 55, 35, 70, 60, 80, 45, 90, 75, 85, 65, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor: h > 60 ? "rgb(52 211 153 / 0.5)" : "rgb(99 102 241 / 0.4)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground animate-bounce"
        aria-label="Scroll to features"
      >
        <ChevronDown className="h-6 w-6" />
      </button>
    </section>
  );
}

function FeaturesSection({ theme }: { theme: string }) {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <RevealDiv className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 rounded-full px-3 py-1 text-xs font-medium mb-4">
            FEATURES
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything a serious trader needs
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Built specifically for forex and stock traders who want data-driven improvement,
            not more manual work.
          </p>
        </RevealDiv>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => {
            const Icon =
              feature.isTheme
                ? theme === "dark"
                  ? Moon
                  : Sun
                : (feature.icon as typeof Plug);
            return (
              <RevealDiv
                key={feature.title}
                delay={i * 80}
                className="group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {feature.description}
                </p>
                <div className="inline-flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-emerald-400" />
                  {feature.badge}
                </div>
              </RevealDiv>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="py-24 px-4 bg-muted/20">
      <div className="max-w-4xl mx-auto">
        <RevealDiv className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-rose-500/10 text-rose-400 rounded-full px-3 py-1 text-xs font-medium mb-4">
            WHY CHARTLOGS
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Stop wasting time on spreadsheets
          </h2>
          <p className="text-muted-foreground text-lg">
            See how ChartLogs stacks up against the old way of journaling.
          </p>
        </RevealDiv>

        <RevealDiv>
          <div className="rounded-2xl border border-border overflow-hidden shadow-lg">
            <div className="grid grid-cols-3 bg-muted/50">
              <div className="p-4 text-sm font-medium text-muted-foreground" />
              <div className="p-4 text-center text-sm font-medium text-muted-foreground border-l border-border">
                Manual Spreadsheet
              </div>
              <div className="p-4 text-center text-sm font-semibold text-primary border-l border-border bg-primary/5">
                ChartLogs
              </div>
            </div>
            {comparisonRows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}
              >
                <div className="p-4 text-sm font-medium">{row.label}</div>
                <div className="p-4 border-l border-border flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-rose-400 flex-shrink-0" />
                  {row.manual}
                </div>
                <div className="p-4 border-l border-border flex items-center gap-2 text-sm bg-primary/5">
                  <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  {row.cl}
                </div>
              </div>
            ))}
          </div>
        </RevealDiv>
      </div>
    </section>
  );
}

function PricingSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section id="pricing" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <RevealDiv className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 rounded-full px-3 py-1 text-xs font-medium mb-4">
            PRICING
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Start free. Upgrade when you're ready to unlock live sync and AI reports.
          </p>
        </RevealDiv>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingTiers.map((tier, i) => (
            <RevealDiv
              key={tier.name}
              delay={i * 100}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                tier.popular
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full shadow">
                    Most Popular
                  </div>
                </div>
              )}
              <div className="mb-6">
                <div className="text-sm font-medium text-muted-foreground mb-1">{tier.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">{tier.period}</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">{tier.description}</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.popular ? "default" : "outline"}
                className={`w-full ${tier.popular ? "shadow-md shadow-primary/20" : ""}`}
                onClick={onRegister}
              >
                {tier.cta}
              </Button>
            </RevealDiv>
          ))}
        </div>

        <RevealDiv className="text-center mt-8 text-sm text-muted-foreground">
          No credit card required for Free plan · Cancel anytime · 7-day refund guarantee
        </RevealDiv>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-24 px-4 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        <RevealDiv className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-400 rounded-full px-3 py-1 text-xs font-medium mb-4">
            TRADERS LOVE IT
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Real results from real traders
          </h2>
        </RevealDiv>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <RevealDiv
              key={t.name}
              delay={i * 100}
              className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </RevealDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ onRegister, onFaq }: { onRegister: () => void; onFaq: () => void }) {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-60" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <RevealDiv>
          <TrendingUp className="h-12 w-12 text-primary mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Start trading smarter today
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join 100+ traders who track their edge with ChartLogs. Free to start —
            upgrade when you're ready for live sync.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="px-10 h-12 text-base shadow-lg shadow-primary/25" onClick={onRegister}>
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" className="h-12 text-base" onClick={onFaq}>
              Have questions? See FAQ
            </Button>
          </div>
        </RevealDiv>
      </div>
    </section>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "Pricing", id: "pricing" },
  ];

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/90 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="" className="h-9 w-9 object-contain flex-shrink-0" />
            <span className="text-xl font-bold font-mono tracking-tighter text-primary">CHARTLOGS</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => setLocation("/faq")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/login")}>
                Log In
              </Button>
              <Button size="sm" onClick={() => setLocation("/register")}>
                Sign Up
              </Button>
            </div>
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-md border-b border-border px-6 py-4 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); setLocation("/faq"); }}
              className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2"
            >
              FAQ
            </button>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setMobileMenuOpen(false); setLocation("/login"); }}>
                Log In
              </Button>
              <Button className="flex-1" onClick={() => { setMobileMenuOpen(false); setLocation("/register"); }}>
                Sign Up
              </Button>
            </div>
          </div>
        )}
      </header>

      <HeroSection
        onRegister={() => setLocation("/register")}
        onLogin={() => setLocation("/login")}
      />
      <FeaturesSection theme={theme} />
      <ComparisonSection />
      <PricingSection onRegister={() => setLocation("/register")} />
      <TestimonialsSection />
      <CtaSection
        onRegister={() => setLocation("/register")}
        onFaq={() => setLocation("/faq")}
      />

      <footer className="border-t border-border py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="text-lg font-bold font-mono tracking-tighter text-primary mb-3">
                CHARTLOGS
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered trading journal with live MT4/MT5 sync.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Product</div>
              <div className="space-y-2">
                {[
                  { label: "Features", action: () => scrollTo("features") },
                  { label: "Pricing", action: () => scrollTo("pricing") },
                  { label: "FAQ", action: () => setLocation("/faq") },
                ].map((l) => (
                  <button
                    key={l.label}
                    onClick={l.action}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Account</div>
              <div className="space-y-2">
                {[
                  { label: "Log In", path: "/login" },
                  { label: "Sign Up", path: "/register" },
                ].map((l) => (
                  <button
                    key={l.label}
                    onClick={() => setLocation(l.path)}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Legal</div>
              <div className="space-y-2">
                {["Privacy Policy", "Terms of Service"].map((l) => (
                  <span key={l} className="block text-sm text-muted-foreground cursor-default">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} ChartLogs. All rights reserved.</span>
            <span className="flex items-center gap-2">
              Made for traders, by traders
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

