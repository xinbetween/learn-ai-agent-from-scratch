import type { Chapter } from "../../src/types.ts";
import c00 from "./c00.ts";
import c01 from "./c01.ts";
import c02 from "./c02.ts";
import c03 from "./c03.ts";
import c04 from "./c04.ts";
import c05 from "./c05.ts";
import c06 from "./c06.ts";
import c07 from "./c07.ts";
import c08 from "./c08.ts";
import c09 from "./c09.ts";
import c10 from "./c10.ts";
import c11 from "./c11.ts";
import c12 from "./c12.ts";
import c13 from "./c13.ts";
import c14 from "./c14.ts";
import c15 from "./c15.ts";
import c16 from "./c16.ts";
import c17 from "./c17.ts";
import c18 from "./c18.ts";
import c19 from "./c19.ts";
import c20 from "./c20.ts";
import c21 from "./c21.ts";
import c22 from "./c22.ts";
import c23 from "./c23.ts";
import c24 from "./c24.ts";
import c25 from "./c25.ts";
import c26 from "./c26.ts";

/** Reading order, which is not id order.
 *
 *  c25 and c26 were written after the course was numbered, and chapter ids are
 *  URLs. Renumbering would have moved eleven chapters and broken every link
 *  anyone had shared, so the ids were appended and the array puts them where
 *  they belong: the action space beside code execution, the interactive loop
 *  before the server that hosts it. */
export const chapters: Chapter[] = [
  c00, c01, c02, c03, c04,
  c05, c06, c07, c08,
  c09, c10, c11, c12,
  c13, c25, c14, c15, c16,
  c17, c18, c19, c20, c21, c26, c22,
  c23, c24,
];
