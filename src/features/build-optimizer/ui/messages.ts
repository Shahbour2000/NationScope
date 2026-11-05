import { en } from "./messages.en";
import { ar } from "./messages.ar";

type Widen<T> = T extends string ? string : T extends readonly unknown[] ? T : { [K in keyof T]: Widen<T[K]> };
export type BuilderMessages = Widen<typeof en>;
export type BuilderLocale = "en" | "ar";
const DICT: Record<BuilderLocale, BuilderMessages> = { en, ar };
/** The Build Optimizer keeps its own dictionaries so the shared site messages are untouched. Arabic must have exactly the same keys (enforced by the type). */
export const getBuilderMessages = (locale: string): BuilderMessages => (locale === "ar" ? DICT.ar : DICT.en);
