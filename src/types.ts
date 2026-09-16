/** Content model for the course. Everything the generator renders is typed. */

export interface Section {
  /** anchor id, e.g. "core-idea" */
  id: string;
  /** small uppercase label above the heading */
  kicker: string;
  /** section heading */
  title: string;
  /** HTML body */
  html: string;
}

export interface Exercise {
  prompt: string;              // HTML
  difficulty: "warm-up" | "core" | "stretch";
  answer: string;              // HTML — shown inline and on /answers/
}

export interface QA {
  q: string;
  a: string;                   // HTML
}

export interface Project {
  title: string;
  brief: string;               // HTML
  spec: string[];              // acceptance criteria
  stretch?: string[];
}

export interface QuizItem {
  q: string;
  options: [string, string, string, string];
  answer: number;              // 0-3
  why: string;
}

export interface Chapter {
  id: string;                  // "c04"
  num: number;
  layer: string;               // layer id
  title: string;
  subtitle: string;
  blurb: string;               // one-paragraph summary for listings
  lines: number;               // lines in the runnable file
  file: string;                // code/c04_agent_loop.ts
  tags: string[];
  sections: Section[];
  exercises: Exercise[];
  qa: QA[];
  project: Project;
  quiz: QuizItem[];
  /** teaser line shown at the end of the chapter, pointing at the next one */
  continues?: string;
}

export interface Layer {
  id: string;
  name: string;
  from: string;
  to: string;
  desc: string;
  /** the sentence that bridges this layer into the next */
  bridge: string;
}

export interface Page {
  slug: string;                // "glossary"
  title: string;
  subtitle: string;
  kicker: string;
  html: string;                // full <main> inner content
  wide?: boolean;
}
