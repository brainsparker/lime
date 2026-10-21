import { createContext } from "react";
import type { LinkClick } from "@/lib/linkOpening";

export type OpenLink = (
  url: string,
  event?: LinkClick & { preventDefault?: () => void },
) => void;

export const LinkOpeningContext = createContext<OpenLink | null>(null);
