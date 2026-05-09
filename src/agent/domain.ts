/**
 * Domain configuration for the grounded-Q&A agent.
 *
 * The agent's system prompt is the only meaningfully domain-coupled
 * piece of the harness — the citation format, refusal rule, and
 * evidence shape are all domain-agnostic. Pulling the domain-flavored
 * language out into a config means a single agent implementation can
 * answer questions across multiple corpora without forking the prompt.
 *
 * To add a new domain: define a DomainConfig and pass it to
 * answerQuestion() (or set it as the default for `bun run eval --corpus
 * <name>`). Keep the citation format identical across domains so the
 * downstream citation-check + judge stay simple.
 */

export type DomainConfig = {
  /** Short identifier matching the corpus key (e.g., "medicare", "osha"). */
  id: string;
  /**
   * Human-readable description used inside the system prompt. Should
   * read naturally in the sentence "You are a {description} assistant
   * grounded in a fixed set of public federal {publicationsLabel}."
   */
  description: string;
  /** What the corpus documents are called collectively (e.g., "Medicare publications", "OSHA workplace-safety publications"). */
  publicationsLabel: string;
};

export const MEDICARE_DOMAIN: DomainConfig = {
  id: "medicare",
  description: "benefits-policy",
  publicationsLabel: "Medicare publications",
};

export const OSHA_DOMAIN: DomainConfig = {
  id: "osha",
  description: "workplace-safety",
  publicationsLabel: "OSHA publications",
};

export const DOMAINS: Record<string, DomainConfig> = {
  medicare: MEDICARE_DOMAIN,
  osha: OSHA_DOMAIN,
};

export function getDomain(id: string): DomainConfig {
  const domain = DOMAINS[id];
  if (!domain) {
    const available = Object.keys(DOMAINS).join(", ");
    throw new Error(`unknown domain "${id}". Available: ${available}`);
  }
  return domain;
}

/**
 * Build the agent system prompt for a given domain. The structure is
 * identical across domains — only the domain-flavored language at the
 * top changes. Keeping the citation rule and refusal rule constant
 * means the deterministic citation-check and the LLM-as-judge work
 * unchanged for any new domain.
 */
export function buildSystemPrompt(domain: DomainConfig): string {
  return `
You are a ${domain.description} assistant grounded in a fixed set of public
federal ${domain.publicationsLabel}. Your only job is to answer the user's
question using the EVIDENCE chunks provided. You do not use any
information outside the EVIDENCE.

For every answer:
  1. State the answer directly. Do not preface with "according to the document" or similar.
  2. Cite the source document and page in this exact format at the end of your answer:
     [cite: <document-id>, page <N>]
     where <document-id> is one of the document IDs in the EVIDENCE
     headers and <N> is the page number from that header.
  3. If the answer is NOT in the EVIDENCE, do not guess. Respond with
     exactly: "I don't see that in the document." (no citation)

Output only the answer + citation (or the refusal). No reasoning, no
disclaimers, no "I hope this helps."
`.trim();
}
