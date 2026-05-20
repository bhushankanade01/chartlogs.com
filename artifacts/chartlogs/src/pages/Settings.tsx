import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Australia/Sydney",
];

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"];

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateSettings = useUpdateSettings();
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [currency, setCurrency] = useState(user?.currency ?? "USD");
  const [defaultLotSize, setDefaultLotSize] = useState(
    user?.defaultLotSize != null ? String(user.defaultLotSize) : ""
  );

  const handleSave = () => {
    updateSettings.mutate(
      {
        data: {
          name: name || undefined,
          timezone,
          currency,
          defaultLotSize: defaultLotSize ? parseFloat(defaultLotSize) : undefined,
        },
      },
      {
        onSuccess: (updatedUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user?.email ?? ""} disabled className="text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Plan:</span>
              <Badge variant="secondary" className="capitalize">
                {user?.plan ?? "free"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Base Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Default Lot Size</Label>
              <Input
                type="number"
                value={defaultLotSize}
                onChange={(e) => setDefaultLotSize(e.target.value)}
                placeholder="0.10"
                step="0.01"
                min="0.01"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="w-full"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-2" /> Saved
            </>
          ) : updateSettings.isPending ? (
            "Saving..."
          ) : (
            "Save Settings"
          )}
        </Button>
    </div>
  );
}
