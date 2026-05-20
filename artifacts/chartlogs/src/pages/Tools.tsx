import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Target } from "lucide-react";

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle>Position Size Calculator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Account Balance ($)</Label>
            <Input
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Risk (%)</Label>
            <Input
              type="number"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              placeholder="1"
              step="0.1"
              min="0.1"
              max="10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Instrument</Label>
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["EURUSD", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "USDJPY", "GBPJPY", "EURCAD", "XAUUSD", "XAGUSD"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Entry Price</Label>
            <Input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="1.08500"
              step="0.00001"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-muted-foreground">Stop Loss Price</Label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="1.08200"
              step="0.00001"
            />
          </div>
        </div>

        {valid ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Risk Amount</p>
                <p className="text-lg font-bold font-mono text-primary">${riskAmount.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Stop Distance</p>
                <p className="text-lg font-bold font-mono">{pips.toFixed(1)} pips</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Lot Size</p>
                <p className="text-2xl font-bold font-mono text-emerald-400">{positionSize.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Fill in entry and stop loss to calculate position size
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle>Risk:Reward Calculator</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Entry Price</Label>
            <Input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="1.08500"
              step="0.00001"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Stop Loss</Label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="1.08200"
              step="0.00001"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Take Profit</Label>
            <Input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="1.09100"
              step="0.00001"
            />
          </div>
        </div>

        {valid ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Risk</p>
                <p className="text-lg font-bold font-mono text-red-400">{risk.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reward</p>
                <p className="text-lg font-bold font-mono text-emerald-400">{reward.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">R:R Ratio</p>
                <p className={`text-2xl font-bold font-mono ${rr >= 2 ? "text-emerald-400" : rr >= 1 ? "text-yellow-400" : "text-red-400"}`}>
                  1:{rr.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <Badge variant="outline" className={rr >= 2 ? "text-emerald-400 border-emerald-400/30" : rr >= 1 ? "text-yellow-400 border-yellow-400/30" : "text-red-400 border-red-400/30"}>
                {rr >= 2 ? "Excellent setup" : rr >= 1.5 ? "Good setup" : rr >= 1 ? "Acceptable" : "Poor R:R — reconsider"}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Fill in entry, stop loss, and take profit to calculate
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary font-mono text-xl">$</span>
          Pip Value Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Instrument</Label>
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["EURUSD", "GBPUSD", "AUDUSD", "USDCAD", "USDCHF", "USDJPY", "GBPJPY", "EURCAD", "XAUUSD"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Lot Size</Label>
            <Input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              step="0.01"
              min="0.01"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Number of Pips</Label>
            <Input
              type="number"
              value={pips}
              onChange={(e) => setPips(e.target.value)}
              step="1"
              min="1"
            />
          </div>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Dollar Value</p>
          <p className="text-3xl font-bold font-mono text-primary">
            ${isNaN(dollarValue) ? "0.00" : dollarValue.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ${pipValue.toFixed(2)} per pip · {parseFloat(lotSize).toFixed(2)} lots
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Tools() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">Trading calculators to plan your trades</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <PositionSizeCalc />
        <RRCalc />
        <PipCalc />
      </div>
    </div>
  );
}
