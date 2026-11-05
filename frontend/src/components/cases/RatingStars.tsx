"use client";

import { StarIcon } from "lucide-react";
import { useId } from "react";

import { cn } from "cn";

import { RATINGS, type Rating } from "@/lib/caseActions";

// Her yildizin kendi rengi var: soldan saga turuncudan turkuaza (Figma: RatingStars). 3. yildiz gecisli.
const STAR_COLOR: Record<Rating, string> = {
  1: "text-brand-accent-strong",
  2: "text-brand-accent",
  3: "",
  4: "text-primary",
  5: "text-primary-strong",
};
const GRADIENT_STAR: Rating = 3;

function StarGradient({ id }: { id: string }) {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-accent)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface StarProps {
  position: Rating;
  filled: boolean;
  gradientId: string;
  className: string;
}

function Star({ position, filled, gradientId, className }: StarProps) {
  if (!filled) {
    return <StarIcon aria-hidden className={cn(className, "text-muted-foreground")} />;
  }
  const paint = position === GRADIENT_STAR ? `url(#${gradientId})` : "currentColor";
  return <StarIcon aria-hidden fill={paint} stroke={paint} className={cn(className, STAR_COLOR[position])} />;
}

interface RatingInputProps {
  value: Rating | null;
  onChange: (rating: Rating) => void;
}

// Puan secimi: her yildiz 44 px dokunma alani; klavye ve ekran okuyucu icin radyo grubu
export function RatingInput({ value, onChange }: RatingInputProps) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label="Puan" className="flex gap-1">
      <StarGradient id={id} />
      {RATINGS.map((rating) => (
        <label
          key={rating}
          className="flex size-11 cursor-pointer items-center justify-center rounded-md has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="radio"
            name={`${id}-rating`}
            className="sr-only"
            aria-label={`${rating} yıldız`}
            checked={value === rating}
            onChange={() => onChange(rating)}
          />
          <Star position={rating} filled={value !== null && rating <= value} gradientId={id} className="size-7" />
        </label>
      ))}
    </div>
  );
}

// Verilmis puanin salt okunur gosterimi
export function RatingDisplay({ value }: { value: number }) {
  const id = useId();
  return (
    <div role="img" aria-label={`${RATINGS.length} üzerinden ${value} yıldız`} className="flex gap-1">
      <StarGradient id={id} />
      {RATINGS.map((rating) => (
        <Star key={rating} position={rating} filled={rating <= value} gradientId={id} className="size-5" />
      ))}
    </div>
  );
}
