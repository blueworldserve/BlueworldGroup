/** Starting-point emails for HR. The HR person can edit every word before sending. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "ADA OBI" / "ada obi" -> "Ada Obi". Names already in normal capitals are left alone. */
export function titleCase(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean !== clean.toUpperCase() && clean !== clean.toLowerCase()) return clean;
  return clean.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function firstName(name: string): string {
  return titleCase(name).split(" ")[0] || "there";
}

/** "2026-11-03" -> "Tuesday, 3 November 2026" */
export function formatInterviewDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "14:30" -> "2:30 PM" */
export function formatInterviewTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return "";
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Left in the text until HR sets the date; sending is blocked while it's still there. */
export const DATE_PLACEHOLDER = "[INTERVIEW DATE]";

interface TemplateInput {
  name: string;
  jobTitle: string;
  company: string;
  signer: string;
}

export function approvalEmail(input: TemplateInput & { date: string; time: string; venue: string }) {
  const when = input.date ? formatInterviewDate(input.date) : DATE_PLACEHOLDER;
  const time = input.time ? formatInterviewTime(input.time) : "";
  const details = [`Date: ${when}`, time ? `Time: ${time}` : "", input.venue.trim() ? `Venue: ${input.venue.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
  return {
    subject: `Interview invitation, ${input.jobTitle} at ${input.company}`,
    body: `Good day ${firstName(input.name)},

Thank you for applying for the position of ${input.jobTitle} at ${input.company}. After reviewing your application, we are pleased to inform you that you have been shortlisted for an interview.

Interview details
${details}

Please confirm your attendance by replying to this email, and bring a valid means of identification along with a copy of your resume. If the date is not convenient for you, kindly let us know as soon as possible so that we can arrange an alternative.

We look forward to meeting you.

Warm regards,
${input.signer}
Human Resources, ${input.company}`,
  };
}

export function declineEmail(input: TemplateInput) {
  return {
    subject: `Your application for ${input.jobTitle}, ${input.company}`,
    body: `Good day ${firstName(input.name)},

Thank you for your interest in the ${input.jobTitle} position at ${input.company}, and for the time you took to apply.

After carefully reviewing all applications, we wish to inform you that we will be going ahead with the applicants whose experience is the best fit for this role at this time. This was not an easy decision, and it is not a reflection of your potential.

We will keep your details on file and encourage you to apply for future openings that match your skills and experience.

We wish you every success in your job search.

Kind regards,
${input.signer}
Human Resources, ${input.company}`,
  };
}