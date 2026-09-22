import { BrowserNotifications } from "@/components/browser-notifications";
import { SubscriptionForm } from "@/components/subscription-form";

export const dynamic = "force-dynamic";

export default function NotifikasiPage() {
  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-foreground">Notifikasi</h1>
      <p className="mt-1 text-xs text-muted">
        Atur kanal dan ambang notifikasi. Semua notifikasi menyebut sumber BMKG
        dan menegaskan bahwa ini bukan peringatan resmi.
      </p>

      <div className="mt-4 space-y-3">
        <BrowserNotifications />
        <SubscriptionForm />
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        Untuk peringatan resmi gempa dan tsunami, ikuti BMKG, InaTEWS, dan BPBD
        setempat.
      </p>
    </div>
  );
}
