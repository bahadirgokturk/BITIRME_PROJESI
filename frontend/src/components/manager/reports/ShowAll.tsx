"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Gercek veride onlarca satir cikabilir; kart uzamasin diye once en ustteki satirlar gosterilir
const VISIBLE_COUNT = 5;

export function useShowAll<T>(items: readonly T[]) {
  const [showAll, setShowAll] = useState(false);
  return {
    visible: showAll ? items : items.slice(0, VISIBLE_COUNT),
    showAll,
    hasMore: items.length > VISIBLE_COUNT,
    toggle: () => setShowAll(!showAll),
  };
}

interface ShowAllButtonProps {
  showAll: boolean;
  // Ornek: "7 sorunun", "12 binanin" (dugme metni: "... hepsini goster")
  totalText: string;
  onClick: () => void;
}

export function ShowAllButton({ showAll, totalText, onClick }: ShowAllButtonProps) {
  return (
    <Button variant="outline" className="h-11 w-full md:h-9 md:w-auto" onClick={onClick}>
      {showAll ? "Daha az göster" : `${totalText} hepsini göster`}
    </Button>
  );
}
