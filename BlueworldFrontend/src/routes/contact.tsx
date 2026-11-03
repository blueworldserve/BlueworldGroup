import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/primitives";
import { CmsPageHero } from "@/components/site/cms-page-hero";
import { useSiteSettings } from "@/hooks/use-cms";
import { SITE_SETTINGS } from "@/data/placeholder-content";
import { ENDPOINTS, formErrorMessage, submitForm } from "@/lib/api";
import { WHATSAPP_ENABLED, whatsappLink } from "@/components/site/whatsapp-button";
import type { ContactSubmission } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Blue World Cosmetics" },
      {
        name: "description",
        content:
          "Reach Blue World Cosmetics in Ikeja, Lagos for distribution, contract manufacturing, private label or general enquiries.",
      },
      { property: "og:title", content: "Contact Us — Blue World Cosmetics" },
      {
        property: "og:description",
        content: "Distribution, private label and export enquiries — talk to our Lagos team.",
      },
    ],
  }),
  component: ContactPage,
});

const MESSAGE_MAX = 800; // keep in sync with MESSAGE_MAX_LENGTH in app/schemas/submission.py
const ENQUIRY_TYPES = ["Sales", "Distribution", "Private label", "Export", "General"] as const;

function ContactPage() {
  const { data } = useSiteSettings();
  const settings = data ?? SITE_SETTINGS;
  const [submitting, setSubmitting] = useState(false);
  const [messageLength, setMessageLength] = useState(0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload: ContactSubmission = {
      fullName: String(fd.get("fullName") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      enquiryType: String(fd.get("enquiryType") ?? "General"),
      subject: String(fd.get("subject") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      website: String(fd.get("website") ?? ""),
    };
    setSubmitting(true);
    try {
      await submitForm(ENDPOINTS.contact, payload);
      form.reset();
      setMessageLength(0);
      toast.success("Message sent", { description: "We reply to enquiries within one business day." });
    } catch (err) {
      // Keep what they typed so they can retry — never claim success on failure.
      toast.error("Message not sent", { description: formErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  const blocks = [
    { icon: MapPin, title: "Manufacturing Location", lines: settings.addressLines },
    { icon: Phone, title: "Phone", lines: settings.phones },
    { icon: Mail, title: "Email", lines: settings.emails },
    { icon: Clock, title: "Office hours", lines: settings.officeHours },
  ];

  return (
    <>
      <CmsPageHero
        slug="contact"
        eyebrow="Contact"
        title="Talk to the people who make it"
        description="Distribution, private label, contract manufacturing or export — send us the detail and the right desk will answer."
        image="hero.products"
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Reach us" title="Company details" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {blocks.map(({ icon: Icon, title, lines }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-deep">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-deep">
                    {title}
                  </h3>
                  <div className="mt-3 space-y-1">
                    {lines.map((line) => (
                      <p key={line} className="text-sm text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-card">
              <iframe
                title="Blue World Cosmetics head office location"
                src={settings.mapEmbedUrl}
                loading="lazy"
                className="h-72 w-full border-0"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <h2 className="font-display text-2xl font-bold text-primary-deep">Send us a message</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fill the form and we'll route it to the right team.
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Field label="Full name" name="fullName" required />
              <Field label="Email address" name="email" type="email" required />
              <Field label="Phone / WhatsApp (optional)" name="phone" type="tel" />
              <div>
                <label htmlFor="enquiryType" className="text-sm font-semibold text-primary-deep">
                  I'm enquiring about
                </label>
                <select
                  id="enquiryType"
                  name="enquiryType"
                  defaultValue="Sales"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {ENQUIRY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Subject" name="subject" required />
              {/* Honeypot: invisible to people, tempting to bots. Leave it empty. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <div>
                <label htmlFor="message" className="text-sm font-semibold text-primary-deep">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  required
                  minLength={5}
                  maxLength={MESSAGE_MAX}
                  onChange={(e) => setMessageLength(e.target.value.length)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
                <p className="mt-1.5 text-right text-xs text-muted-foreground">
                  {messageLength}/{MESSAGE_MAX}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-card transition-transform hover:-translate-y-0.5",
                  submitting && "opacity-60",
                )}
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
              {WHATSAPP_ENABLED && (
                <p className="text-center text-sm text-muted-foreground">
                  Prefer WhatsApp?{" "}
                  <a
                    href={whatsappLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-deep underline-offset-2 hover:underline"
                  >
                    Chat with sales
                  </a>
                </p>
              )}
            </form>
          </div>
        </div>
      </Section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold text-primary-deep">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}
