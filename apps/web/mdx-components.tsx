import type { MDXComponents } from "mdx/types";

// Required by @next/mdx with the App Router. Slide typography lives in globals.css (.slide).
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}
