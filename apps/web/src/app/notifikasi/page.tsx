import type { Metadata } from "next";
import { BrowserNotifications } from "@/components/browser-notifications";
import { PageHeading } from "@/components/page-heading";
import { SubscriptionForm } from "@/components/subscription-form";

export const metadata: Metadata = {
  title: "Notifikasi gempa",
  description: "Notifikasi gempa baru dari data BMKG lewat browser, Telegram atau Discord.",
};

export default function NotifikasiPage() {
  return (
    <div className="mx-auto w-full max-w-screen-md pb-12">
      <PageHeading title="Notifikasi gempa" />
      <BrowserNotifications />
      <SubscriptionForm />
    </div>
  );
}
