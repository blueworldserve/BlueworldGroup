import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";
import { resolveImage } from "@/data/images";
import { AppLink } from "@/components/site/app-link";
import { HeroFlag } from "@/components/site/hero-context";
import { RichText } from "@/components/site/rich-text";
import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "deep" | "warm";
}) {
  return (
    <section
      className={cn(
        "px-5 py-20 lg:px-8 lg:py-28",
        tone === "muted" && "bg-secondary",
        tone === "warm" && "bg-accent-soft",
        tone === "deep" && "surface-deep",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  invert = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
  invert?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}
    >
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2
        className={cn(
          "mt-3 text-3xl font-extrabold leading-[1.1] lg:text-[2.6rem]",
          invert ? "text-primary-foreground" : "text-primary-deep",
        )}
      >
        {typeof title === "string" ? <RichText text={title} /> : title}
      </h2>
      <span className={cn("mt-5 block h-0.5 w-14 bg-accent", align === "center" && "mx-auto")} />
      {description && (
        <p
          className={cn(
            "mt-5 text-lg leading-8 lg:text-xl lg:leading-9",
            invert ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          <RichText text={description} />
        </p>
      )}
    </motion.div>
  );
}

export function CmsImage({
  src,
  alt,
  className,
  width,
  height,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  eager?: boolean;
}) {
  const resolved = resolveImage(src);
  if (!src || !resolved) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary text-muted-foreground/40", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      {...(eager ? { fetchPriority: "high" as const } : {})}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const parent = e.currentTarget.parentElement;
        if (parent) parent.classList.add("bg-secondary");
      }}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "solid",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        "inline-flex items-center gap-2 border-2 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-all",
        "shadow-[4px_4px_0_0_rgba(0,0,0,0.9)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]",
        "active:translate-y-0.5 active:shadow-[1px_1px_0_0_rgba(0,0,0,0.9)]",
        variant === "solid"
          ? "border-black bg-accent text-accent-foreground hover:bg-primary-deep hover:text-primary-foreground"
          : "border-white/80 bg-transparent text-white hover:bg-white hover:text-primary-deep",
      )}
    >
      {children}
    </AppLink>
  );
}

/** Full-width hero photo that asks for a large version instead of the default size. */
function HeroPhoto({ src }: { src: string }) {
  const remote = /^https?:\/\//.test(src);
  return (
    <img
      src={resolveImage(src, 2000)}
      srcSet={
        remote
          ? `${resolveImage(src, 1200)} 1200w, ${resolveImage(src, 1600)} 1600w, ${resolveImage(src, 2400)} 2400w`
          : undefined
      }
      sizes="100vw"
      alt=""
      fetchPriority="high"
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  mobileImage,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  image?: string;
  /** Optional portrait photo used on phones (under 768px) instead of `image`. */
  mobileImage?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative flex min-h-[82svh] items-center overflow-hidden bg-primary-deep md:min-h-[92vh]">
      <HeroFlag />
      {(image || "hero.factory") && (
        <div className="absolute inset-0">
          {mobileImage ? (
            <picture className="block h-full w-full">
              <source media="(min-width: 768px)" srcSet={resolveImage(image || "hero.factory")} />
              <img
                src={resolveImage(mobileImage, 1200)}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </picture>
          ) : (
            <HeroPhoto src={image || "hero.factory"} />
          )}
          {/* On a phone the text spans the whole width, so darken evenly instead of only from the left. */}
          {mobileImage && <div className="absolute inset-0 bg-black/30 md:hidden" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-32 lg:px-8 lg:pb-28 lg:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] text-primary-foreground [text-shadow:0_2px_24px_rgba(0,0,0,0.4)] lg:text-6xl">
            {title}
          </h1>
          <span className="mt-6 block h-0.5 w-16 bg-accent" />
          {description && (
            <p className="mt-6 max-w-3xl text-xl leading-9 text-primary-foreground/95 [text-shadow:0_1px_16px_rgba(0,0,0,0.45)] lg:text-2xl lg:leading-[1.55]">
              <RichText text={description} />
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card py-16 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-secondary py-16 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorBlock({ label = "Something went wrong." }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-destructive/30 bg-destructive/5 py-16 text-sm text-destructive">
      {label}
    </div>
  );
}

/** Emphasis word: orange italic accent face, letters lift on hover, underline draws in on scroll. */
export function Hl({ children }: { children: string }) {
  return (
    <motion.span
      className="bw-hl font-accent"
      style={{
        color: "var(--accent, #ee8a1e)",
        fontStyle: "italic",
        fontWeight: 600,
        backgroundImage: "linear-gradient(currentColor, currentColor)",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 100%",
      }}
      initial={{ backgroundSize: "0% 2px" }}
      whileInView={{ backgroundSize: "100% 2px" }}
      whileHover={{ backgroundSize: "100% 3px" }}
      viewport={{ once: true, margin: "-20%" }}
      transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
    >
      {children.split("").map((c, i) => (
        <span key={i} className="bw-ch" style={{ transitionDelay: `${i * 25}ms` }}>
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </motion.span>
  );
}