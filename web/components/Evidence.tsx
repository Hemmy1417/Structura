"use client";

/**
 * Evidence as filed: images fetched from the contract's own storage (the
 * bytes every validator read), with the sha256 recomputed in this browser
 * and compared with the digest the contract recorded at filing. Claims the
 * submitter made are labelled as claims.
 */
import { useEffect, useState } from "react";

import * as present from "@/lib/present";
import { getImage, getItem } from "@/lib/read";
import type { ItemView } from "@/lib/types";
import { When } from "./bits";

export function StoredImage({ item, className = "" }: { item: ItemView; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [check, setCheck] = useState<"checking" | "match" | "mismatch" | "failed">("checking");

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    getImage(item.item_id)
      .then(({ bytes, digest }) => {
        if (!alive) return;
        made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.format === "PNG" ? "image/png" : "image/jpeg" }));
        setUrl(made);
        setCheck(digest === item.sha256 ? "match" : "mismatch");
      })
      .catch(() => alive && setCheck("failed"));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [item.item_id, item.sha256, item.format]);

  return (
    <figure className={`grid gap-2 ${className}`}>
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[10px] bg-canvas">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={item.caption || present.itemKind(item.kind, item.origin)} className="h-full w-full object-cover" />
        ) : check === "failed" ? (
          <span className="body-sm px-3 text-center text-iron">The image could not be read from the chain.</span>
        ) : (
          <span className="working h-[3px] w-2/3" aria-label="Reading the image" />
        )}
      </div>
      <figcaption className="caption">
        {check === "match" ? "These are the bytes the validators read" : check === "mismatch" ? "The digest does not match the record" :
          check === "failed" ? "Not read" : "Checking the digest"}
      </figcaption>
    </figure>
  );
}

function Claims({ item }: { item: ItemView }) {
  const bits = [
    item.origin_ref ? `source: ${item.origin_ref}` : "",
    item.claimed_capture ? `taken: ${item.claimed_capture}` : "",
    item.claimed_location ? `place: ${item.claimed_location}` : "",
  ].filter(Boolean);
  if (!bits.length) return null;
  return <p className="body-sm text-iron">Claimed by the submitter: {present.prose(bits.join("; "))}</p>;
}

export function ItemCard({ item, requirement, isNew }: {
  item: ItemView;
  requirement?: string;
  isNew?: boolean;
}) {
  const [text, setText] = useState<string | null>(item.text ?? null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || text !== null || item.kind === "IMAGE") return;
    void getItem(item.item_id).then((full) => setText(full?.text ?? ""));
  }, [open, text, item]);

  return (
    <article className="card-quiet grid content-start gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="caption">{present.itemName(item.item_id)}</p>
        <p className="caption text-right">
          {present.itemKind(item.kind, item.origin)}
          {item.kind === "DECLARATION" ? ", read by no round" : isNew ? ", new in the appeal" : ""}
        </p>
      </div>
      {item.kind === "IMAGE" ? <StoredImage item={item} /> : null}
      <p className="font-semibold">{present.prose(item.caption) || present.itemKind(item.kind, item.origin)}</p>
      {item.reference ? <p className="body-sm text-slate">Reference: {present.prose(item.reference)}</p> : null}
      {requirement ? <p className="body-sm text-slate">Offered for: {present.prose(requirement)}</p> : null}
      <Claims item={item} />
      {item.kind !== "IMAGE" ? (
        <div>
          <button type="button" className="btn btn-neutral btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide the text" : `Read the text, ${present.plural(item.chars ?? 0, "character")}`}
          </button>
          {open ? (
            <blockquote className="body-sm mt-3 max-h-64 overflow-auto whitespace-pre-wrap border-l-2 border-fog pl-4 text-slate">
              {text === null ? "Reading" : present.prose(text)}
            </blockquote>
          ) : null}
        </div>
      ) : null}
      <p className="caption">
        Filed by the {present.roleLower(item.role)}, <When iso={item.submitted_at} />, {present.size(item.bytes)}
      </p>
    </article>
  );
}
