import type { ReactNode } from "react";
import Image from "@/components/image";

export function LearningEntryHero({
  variant,
  badge,
  image,
  headline,
  description,
  children,
}: {
  variant: "home" | "study";
  badge?: string;
  image: string;
  headline: ReactNode;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`wrap entry-hero entry-hero--${variant}`}
      aria-labelledby="learning-entry-title"
    >
      <div className="entry-hero-copy">
        {badge && <span className="entry-hero-badge">{badge}</span>}
        <h1 id="learning-entry-title">{headline}</h1>
        <p>{description}</p>
        <div className="entry-hero-actions">{children}</div>
      </div>
      <div className="entry-hero-photo">
        <Image
          src={image}
          alt=""
          width={variant === "home" ? 1200 : 960}
          height={variant === "home" ? 800 : 640}
          priority={variant === "home"}
        />
      </div>
    </section>
  );
}
