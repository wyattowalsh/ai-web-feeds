import type { JsonLdObject } from "@/lib/structured-data";

type JsonLdProps = {
  data: JsonLdObject | JsonLdObject[];
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
