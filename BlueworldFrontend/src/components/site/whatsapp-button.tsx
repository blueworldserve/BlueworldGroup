import { MessageCircle } from "lucide-react";

/**
 * One-click "speak to sales" on WhatsApp (click-to-chat, the visitor's own WhatsApp opens
 * with a pre-filled message). Set VITE_WHATSAPP_NUMBER in BlueworldFrontend/.env in
 * international format, digits only, e.g. 2348012345678. If it isn't set, nothing renders.
 */
const NUMBER = ((import.meta.env["VITE_WHATSAPP_NUMBER"] as string | undefined) ?? "").replace(/\D/g, "");

export const WHATSAPP_ENABLED = NUMBER.length >= 8;

export function whatsappLink(text = "Hello Blueworld Cosmetics, I'd like to speak to your sales team."): string {
  return `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Floating button shown on every public page. */
export function WhatsAppButton() {
  if (!WHATSAPP_ENABLED) return null;
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with sales on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 sm:px-5"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Chat with sales</span>
    </a>
  );
}