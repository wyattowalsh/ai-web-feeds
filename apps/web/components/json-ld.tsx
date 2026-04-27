import type { JsonLdObject } from "@/lib/structured-data";

type JsonLdProps = {
  data: JsonLdObject | JsonLdObject[];
  /** Per-request nonce from middleware (enables strict script-src without 'unsafe-inline'). */
  nonce?: string;
};

export function JsonLd({ data, nonce }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
