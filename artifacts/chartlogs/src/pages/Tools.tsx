import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Target, DollarSign } from "lucide-react";

function CalcCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/10 hover:border-primary/20">
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ResultDisplay({
  items,
}: {
  items: { label: string; value: string; color?: string; large?: boolean }[];
}) {
  return (
    <div className="bg-muted/30 border border-border/60 rounded-xl p-4">
      <div className={`grid gap-4 ${items.length === 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">{item.label}</p>
            <p className={`font-mono font-bold tracking-tight ${item.large ? "text-3xl" : "text-xl"} ${item.color ?? "text-foreground"}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  col2 = false,
}: {
  label: string;
  children: ReactNode;
  col2?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${col2 ? "col-span-2" : ""}`}>
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function PositionSizeCalc() {
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [pair, setPair] = useState("EURUSD");

  const riskAmount = parseFloat(accountSize) * (parseFloat(riskPct) / 100);
  const pipDiff = Math.abs(parseFloat(entryPrice) - parseFloat(stopLoss));
  const isJpy = pair.includes("JPY");
  const isXAU = pair.includes("XAU");
  const pipSize = isJpy ? 0.01 : isXAU ? 0.1 : 0.0001;
  const pipValue = isJpy ? 6.5 : isXAU ? 100 : 10;
  const pips = pipDiff / pipSize;
  const positionSize = pips > 0 ? riskAmount / (pips * pipValue) : 0;
  const valid = !isNaN(positionSize) && isFinite(positionSize) && positionSize > 0;

  return (
    <CalcCard
      icon={<Calculator className="h-6 w-6" />}
      iconColor="text-indigo-400"
      iconBg="bg-indigo-500/10"
      title="Position Size Calculator"
      description="Find the right lot size based on your risk tolerance"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Account Balance ($)">
          <Input type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} placeholder="10000" />
        </FormField>
        <FormField label="Risk (%)">
          <Input type="number" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="1" step="0.1" min="0.1" max="10" />
        </FormField>
        <FormField label="Instrument">
          <Select value={pair} onValueChange={setPair}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["EURUSD", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "USDJPY", "GBPJPY", "EURCAD", "XAUUSD", "XAGUSD"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Entry Price">
          <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="1.08500" step="0.00001" />
        </FormField>
        <FormField label="Stop Loss Price" col2>
          <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="1.08200" step="0.00001" />
        </FormField>
      </div>

      {valid ? (
        <ResultDisplay
          items={[
            { label: "Risk Amount", value: `$${riskAmount.toFixed(2)}`, color: "text-primary" },
            { label: "Stop Distance", value: `${pips.toFixed(1)} pips` },
            { label: "Lot Size", value: positionSize.toFixed(2), color: "text-emerald-400", large: true },
          ]}
        />
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Enter entry and stop loss to calculate lot size
        </div>
      )}
    </CalcCard>
  );
}

function RRCalc() {
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");

  const entry = parseFloat(entryPrice);
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(takeProfit);
  const risk = direction === "long" ? entry - sl : sl - entry;
  const reward = direction === "long" ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : 0;
  const valid = !isNaN(rr) && isFinite(rr) && rr > 0;

  return (
    <CalcCard
      icon={<Target className="h-6 w-6" />}
      iconColor="text-amber-400"
      iconBg="bg-amber-500/10"
      title="Risk:Reward Calculator"
      description="Evaluate your trade's risk-to-reward before entry"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-2">
          <Button
            variant={direction === "long" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setDirection("long")}
          >
            Long
          </Button>
          <Button
            variant={direction === "short" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setDirection("short")}
          >
            Short
          </Button>
        </div>
        <FormField label="Entry Price">
          <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="1.08500" step="0.00001" />
        </FormField>
        <FormField label="Stop Loss">
          <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="1.08200" step="0.00001" />
        </FormField>
        <FormField label="Take Profit" col2>
          <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="1.09100" step="0.00001" />
        </FormField>
      </div>

      {valid ? (
        <div className="space-y-3">
          <ResultDisplay
            items={[
              { label: "Risk", value: risk.toFixed(5), color: "text-red-400" },
              { label: "Reward", value: reward.toFixed(5), color: "text-emerald-400" },
              {
                label: "R:R Ratio",
                value: `1:${rr.toFixed(2)}`,
                color: rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-amber-400" : "text-red-400",
                large: true,
              },
            ]}
          />
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={
                rr >= 2
                  ? "text-emerald-400 border-emerald-400/30 bg-emerald-500/5"
                  : rr >= 1.5
                  ? "text-amber-400 border-amber-400/30 bg-amber-500/5"
                  : rr >= 1
                  ? "text-yellow-400 border-yellow-400/30"
                  : "text-red-400 border-red-400/30 bg-red-500/5"
              }
            >
              {rr >= 2 ? "✓ Excellent setup" : rr >= 1.5 ? "Good setup" : rr >= 1 ? "Acceptable" : "Poor R:R — reconsider"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Enter entry, stop loss, and take profit to calculate
        </div>
      )}
    </CalcCard>
  );
}

function PipCalc() {
  const [pair, setPair] = useState("EURUSD");
  const [pips, setPips] = useState("10");
  const [lotSize, setLotSize] = useState("0.1");

  const isJpy = pair.includes("JPY");
  const isXAU = pair.includes("XAU");
  const pipValue = isJpy ? 6.5 : isXAU ? 100 : 10;
  const dollarValue = parseFloat(pips) * pipValue * parseFloat(lotSize);

  return (
    <CalcCard
      icon={<DollarSign className="h-6 w-6" />}
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/10"
      title="Pip Value Calculator"
      description="Calculate dollar value per pip for any instrument"
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Instrument">
          <Select value={pair} onValueChange={setPair}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["EURUSD", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "USDJPY", "GBPJPY", "EURCAD", "XAUUSD"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Lot Size">
          <Input type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} step="0.01" min="0.01" />
        </FormField>
        <FormField label="Number of Pips" col2>
          <Input type="number" value={pips} onChange={(e) => setPips(e.target.value)} step="1" min="1" />
        </FormField>
      </div>

      <ResultDisplay
        items={[
          {
            label: "Dollar Value",
            value: `$${isNaN(dollarValue) ? "0.00" : dollarValue.toFixed(2)}`,
            color: "text-primary",
            large: true,
          },
        ]}
      />
      <p className="text-xs text-center text-muted-foreground -mt-2">
        ${pipValue.toFixed(2)} per pip · {parseFloat(lotSize || "0").toFixed(2)} lots
      </p>
    </CalcCard>
  );
}

export default function Tools() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Professional calculators to plan and size your trades</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <PositionSizeCalc />
        <RRCalc />
        <PipCalc />
      </div>
    </div>
  );
}
