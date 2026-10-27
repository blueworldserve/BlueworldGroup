import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { EmptyBlock, LoadingBlock, PageHero, Section, SectionHeading } from "@/components/site/primitives";
import { useJobPostings } from "@/hooks/use-cms";
import { ENDPOINTS, formErrorMessage, submitFormData } from "@/lib/api";
import type { CareerApplication, JobPosting } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/career")({
  head: () => ({
    meta: [
      { title: "Careers — Blue World Cosmetics" },
      {
        name: "description",
        content:
          "Open roles in formulation, production, quality assurance and commercial at our Obadore, Igando, Lagos manufacturing organization.",
      },
      { property: "og:title", content: "Careers — Blue World Cosmetics" },
      {
        property: "og:description",
        content: "Build cosmetics that reach millions of African households. See our open roles.",
      },
    ],
  }),
  component: CareerPage,
});

const PERKS = [
  { title: "Made here, owned here", body: "Every product you work on is formulated, filled and shipped from our own organization." },
  { title: "Real training budget", body: "Cosmetic science certifications, GMP training and conference travel are funded." },
  { title: "Health cover", body: "HMO cover for you and immediate family from day one of confirmation." },
  { title: "Growth on merit", body: "Line leads and QA supervisors are promoted from inside the factory, not hired around it." },
];

function CareerPage() {
  const { data, isLoading } = useJobPostings();
  const jobs = [...(data ?? [])].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [applyTo, setApplyTo] = useState<JobPosting | null>(null);

  return (
    <>
      <PageHero
        eyebrow="Career"
        title="Work where the product is actually made"
        description="We hire chemists, machine operators, QA analysts and commercial people who care about doing manufacturing properly."
        image="hero.factory"
      />

      <Section tone="muted">
        <SectionHeading eyebrow="Why join" title="What you get working here" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((perk) => (
            <div key={perk.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-base font-bold text-primary-deep">{perk.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{perk.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Open roles" title="Positions we're hiring for" />
        <div className="mt-12 space-y-4">
          {isLoading && <LoadingBlock label="Loading open roles…" />}
          {!isLoading && jobs.length === 0 && (
            <EmptyBlock label="No open roles right now — check back soon." />
          )}
          {jobs.map((job) => {
            const open = openJob === job.slug;
            return (
              <div key={job.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setOpenJob(open ? null : job.slug)}
                  className="flex w-full flex-wrap items-center justify-between gap-4 p-6 text-left"
                >
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary-deep">{job.title}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                      {job.department} · {job.location} · {job.employmentType}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {job.summary}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary-deep">
                    {open ? "Hide details" : "View details"}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-border px-6 pb-6 pt-6">
                    <div className="grid gap-8 md:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-primary-deep">
                          Responsibilities
                        </h4>
                        <ul className="mt-4 space-y-2">
                          {job.responsibilities.map((r) => (
                            <li key={r} className="flex gap-3 text-sm text-muted-foreground">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-primary-deep">
                          Requirements
                        </h4>
                        <ul className="mt-4 space-y-2">
                          {job.requirements.map((r) => (
                            <li key={r} className="flex gap-3 text-sm text-muted-foreground">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setApplyTo(job)}
                      className="mt-8 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground shadow-card transition-transform hover:-translate-y-0.5"
                    >
                      Apply for this role
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {applyTo && <ApplyForm job={applyTo} onClose={() => setApplyTo(null)} />}
    </>
  );
}

// Keep this the same as MAX_APPLICATIONS_PER_ROLE in the backend (app/routers/public_writes.py).
const MAX_APPLICATIONS_PER_ROLE: number = 2;
const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_EXTENSIONS = /\.(pdf|docx?)$/i;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ApplyForm({ job, onClose }: { job: JobPosting; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Checked here so people find out straight away, not after waiting for an upload to fail.
  function pickResume(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ""; // lets them pick the same file again after removing it
    if (!file) return;
    if (!RESUME_EXTENSIONS.test(file.name)) {
      setResume(null);
      setResumeError("Please choose a PDF or Word document (.pdf, .doc or .docx).");
    } else if (file.size > RESUME_MAX_BYTES) {
      setResume(null);
      setResumeError(`That file is ${formatSize(file.size)}. Please choose one under 5 MB.`);
    } else if (file.size === 0) {
      setResume(null);
      setResumeError("That file looks empty. Please choose your resume again.");
    } else {
      setResume(file);
      setResumeError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: CareerApplication = {
      jobSlug: job.slug,
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      coverMessage: String(form.get("coverMessage") ?? ""),
    };
    const body = new FormData();
    body.append("jobSlug", payload.jobSlug);
    body.append("fullName", payload.fullName);
    body.append("email", payload.email);
    body.append("phone", payload.phone);
    body.append("coverMessage", payload.coverMessage);
    if (resume) body.append("resume", resume);

    setSubmitting(true);
    try {
      await submitFormData(ENDPOINTS.careersApply, body);
      toast.success("Application received", {
        description: `Thanks ${payload.fullName.split(" ")[0]} — our people team will reach out by email.`,
      });
      onClose();
    } catch (err) {
      // Never claim success unless the server really saved it. The form stays open
      // with everything they typed, so they can simply press Submit again.
      toast.error("We couldn't send your application", { description: formErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-primary-deep/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-7 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-accent">Apply</p>
            <h3 className="mt-1 font-display text-xl font-bold text-primary-deep">{job.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-muted-foreground"
          >
            Close
          </button>
        </div>
         <div role="note" className="mt-5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm leading-relaxed text-primary-deep">
          <p className="font-bold">Before you submit</p>
          <p className="mt-1">
            You can apply for this role <strong>{MAX_APPLICATIONS_PER_ROLE === 1 ? "only once" : `a maximum of ${MAX_APPLICATIONS_PER_ROLE} times`}</strong>, and
            an application can't be edited after it's sent. Please double-check your name, email address and phone number, and attach your resume, before
            you press Submit.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Full name" name="fullName" required maxLength={120} />
          <Field label="Email address" name="email" type="email" required maxLength={254} />
          <Field label="Phone number" name="phone" required maxLength={40} />
          <div>
            <label htmlFor="coverMessage" className="text-sm font-semibold text-primary-deep">
              Why this role?
            </label>
            <textarea
              id="coverMessage"
              name="coverMessage"
              rows={4}
              required
              maxLength={3000}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="resume" className="text-sm font-semibold text-primary-deep">
              Resume / CV <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="resume"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={pickResume}
              className="sr-only"
            />
            {resume ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-primary-deep">{resume.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(resume.size)}</span>
                <button
                  type="button"
                  onClick={() => setResume(null)}
                  className="shrink-0 text-xs font-bold text-accent hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-5 text-sm font-semibold text-primary-deep transition-colors hover:border-accent"
              >
                <UploadCloud className="h-4 w-4 text-accent" />
                Upload your resume
              </button>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">PDF or Word (.doc, .docx), up to 5 MB.</p>
            {resumeError && (
              <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
                {resumeError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full rounded-full bg-primary-deep px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5",
              submitting && "opacity-60",
            )}
          >
            {submitting ? (resume ? "Uploading…" : "Sending…") : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
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
        maxLength={maxLength}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}