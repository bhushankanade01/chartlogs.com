import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Sun, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How do I connect my MT4/MT5 broker account?",
        a: "Go to Settings → Broker Sync and enter your broker server name, account number, and investor (read-only) password. ChartLogs uses MetaApi to establish a secure, read-only connection — we can only read your trade history, never place trades.",
      },
      {
        q: "How long does the initial sync take?",
        a: "The first sync can take 2–5 minutes as we download your complete trade history. After that, new closed trades sync automatically every 3 minutes in the background.",
      },
      {
        q: "Which brokers are supported?",
        a: "Any broker that supports MT4 or MT5 is compatible — including Exness, IC Markets, Pepperstone, XM, and hundreds more. If your broker provides an MT4/MT5 server, it works with ChartLogs.",
      },
      {
        q: "Can I use ChartLogs without broker sync?",
        a: "Yes. You can manually log trades using the Add Trade button, or import your trade history via CSV file from the Trades page.",
      },
    ],
  },
  {
    category: "Data Privacy & Security",
    items: [
      {
        q: "Is my trading data secure?",
        a: "Yes. We use 256-bit TLS encryption for all data in transit, and your data is stored in encrypted form at rest. We only request investor (read-only) access to your broker account — we can never execute trades.",
      },
      {
        q: "Who can see my trades?",
        a: "Only you. Your trade data is private by default and never shared with third parties. We do not sell your data.",
      },
      {
        q: "Can ChartLogs place trades on my account?",
        a: "No. We only require your investor password, which is strictly read-only. It is technically impossible for us to place, modify, or close trades on your account.",
      },
      {
        q: "How do I delete my account and data?",
        a: "You can delete your account from Settings. This permanently removes all your trade data, journal entries, and account information from our servers within 24 hours.",
      },
    ],
  },
  {
    category: "Subscription & Billing",
    items: [
      {
        q: "What's included in the Free plan?",
        a: "The Free plan includes manual trade entry, CSV import, basic analytics, and the economic calendar. It's a great way to get started with no credit card required.",
      },
      {
        q: "What does the Pro plan add?",
        a: "Pro adds live MT4/MT5 broker sync (1 account), AI-powered weekly analysis reports, advanced performance metrics, and priority support.",
      },
      {
        q: "Can I switch plans at any time?",
        a: "Yes. You can upgrade or downgrade your plan at any time from the Settings page. Upgrades take effect immediately; downgrades take effect at the next billing cycle.",
      },
      {
        q: "Do you offer refunds?",
        a: "We offer a 7-day refund for new Pro/Elite subscriptions if you're not satisfied. Contact support within 7 days of your first payment.",
      },
    ],
  },
  {
    category: "AI Reports & Analytics",
    items: [
      {
        q: "How do the AI weekly reports work?",
        a: "Every Monday, our AI analyzes your previous week's trades — identifying patterns, calculating metrics like win rate and profit factor, and giving you specific, actionable suggestions to improve your trading.",
      },
      {
        q: "What trading metrics does ChartLogs track?",
        a: "We track win rate, profit factor, risk-reward ratio, average win/loss, max drawdown, P&L by symbol, session performance, and 50+ more metrics. All metrics update in real-time as trades sync.",
      },
      {
        q: "Can I add notes and tags to my trades?",
        a: "Yes. From the Journal page, you can add notes, rate your emotional state, tag trades with strategies or mistakes, and attach screenshots. These tags feed into your analytics.",
      },
    ],
  },
  {
    category: "Troubleshooting",
    items: [
      {
        q: "My broker sync is showing an error. What do I do?",
        a: "First, verify your broker server name and investor password in Settings → Broker Sync. Common issues: wrong server name (check your MT4/MT5 platform), expired investor password, or broker maintenance. Click 'Sync Now' after updating credentials.",
      },
      {
        q: "Trades are syncing but the numbers look wrong.",
        a: "Ensure your account currency is set correctly in Settings → Accounts. Also check if your broker uses a non-standard lot size. You can manually edit any incorrectly synced trade from the Trades page.",
      },
      {
        q: "The economic calendar isn't loading.",
        a: "The economic calendar fetches live data from external sources. If it's not loading, check your internet connection. The calendar may also show a brief delay during heavy market event periods.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="font-medium text-foreground pr-4">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed border-t border-border pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="text-xl font-bold font-mono tracking-tighter text-primary"
          >
            CHARTLOGS
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/login")}>Log In</Button>
            <Button size="sm" onClick={() => setLocation("/register")}>Sign Up</Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about ChartLogs.
          </p>
        </div>

        <div className="space-y-10">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <span className="h-px flex-1 bg-border" />
                {section.category}
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center p-8 rounded-2xl bg-primary/5 border border-primary/20">
          <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
          <p className="text-muted-foreground mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button onClick={() => setLocation("/register")}>Start Free Trial</Button>
            <Button variant="outline" asChild>
              <a href="mailto:support@chartlogs.com">Email Support</a>
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-8 mt-16">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-mono font-bold text-primary">CHARTLOGS</span>
          <div className="flex gap-6">
            <button onClick={() => setLocation("/")} className="hover:text-foreground transition-colors">Home</button>
            <button onClick={() => setLocation("/faq")} className="hover:text-foreground transition-colors">FAQ</button>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground transition-colors">Login</button>
          </div>
          <span>&copy; {new Date().getFullYear()} ChartLogs</span>
        </div>
      </footer>
    </div>
  );
}
