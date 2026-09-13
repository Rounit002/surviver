"use client";

import { useActionState, useState, useTransition } from "react";
import { LogoLoader } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { CATEGORY_LABELS, CATEGORY_VALUES } from "@/lib/competition/constants";
import { createEntryAction, lookupSiteAction, type EntryFormState } from "@/lib/products/actions";
import { displayHost } from "@/lib/format";
import type { ProductCategory } from "@/generated/prisma";

/**
 * Entry in one screen: paste the link, pick a category, pay.
 *
 * The remaining fields are prefilled from the site's own metadata so the
 * founder is correcting text rather than composing it. Everything stays
 * editable, and the preview shows exactly what spectators will see.
 */
export function EntryForm({
  priceLabel,
  initialUrl = "",
  initialCategory = "",
}: {
  priceLabel: string;
  initialUrl?: string;
  initialCategory?: ProductCategory | "";
}) {
  const [state, formAction, submitting] = useActionState(
    createEntryAction,
    {} as EntryFormState,
  );

  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">(initialCategory);
  const [faviconUrl, setFaviconUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looked, setLooked] = useState(false);
  const [looking, startLookup] = useTransition();

  const runLookup = () => {
    if (!url.trim()) {
      setLookupError("Enter your product URL first.");
      return;
    }
    setLookupError(null);
    startLookup(async () => {
      const result = await lookupSiteAction(url);
      setLooked(true);
      if (!result.ok) {
        setLookupError(result.error ?? "We could not read that site.");
        return;
      }
      if (result.url) setUrl(result.url);
      if (result.name && !name) setName(result.name);
      if (result.description && !description) {
        setDescription(result.description);
        if (!tagline) setTagline(result.description.slice(0, 88));
      }
      setFaviconUrl(result.faviconUrl ?? "");
      setImageUrl(result.imageUrl ?? "");
    });
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="faviconUrl" value={faviconUrl} />
      <input type="hidden" name="imageUrl" value={imageUrl} />

      <FormError>{state.error}</FormError>

      <Panel>
        <StepHeader n={1} title="Your product" hint="Paste the link. We read your site and fill in the rest." />

        <div className="space-y-4 p-5">
          <Field
            label="Product URL"
            htmlFor="url"
            required
            error={state.fieldErrors?.url ?? lookupError ?? undefined}
            hint={
              looked && !lookupError
                ? "Details pulled from your site. Edit anything that is not right."
                : "We will read your homepage to fill in the rest."
            }
          >
            <div className="flex gap-2">
              <Input
                id="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => {
                  if (url.trim() && !looked) runLookup();
                }}
                placeholder="yourproduct.com"
                inputMode="url"
                autoComplete="url"
                required
                aria-invalid={Boolean(state.fieldErrors?.url ?? lookupError)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={runLookup}
                disabled={looking}
                className="shrink-0"
              >
                {looking ? (
                  <>
                    <LogoLoader className="size-3.5" />
                    Reading…
                  </>
                ) : (
                  "Fetch"
                )}
              </Button>
            </div>
          </Field>

          <Field
            label="Category"
            htmlFor="category"
            required
            error={state.fieldErrors?.category}
          >
            <Select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              required
              aria-invalid={Boolean(state.fieldErrors?.category)}
            >
              <option value="">Choose a category</option>
              {CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel>
        <StepHeader n={2} title="How it appears" hint="Exactly what visitors see on the board." />

        <div className="space-y-4 p-5">
          <Field label="Product name" htmlFor="name" required error={state.fieldErrors?.name}>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="Cursorly"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
          </Field>

          <Field
            label="Tagline"
            htmlFor="tagline"
            required
            error={state.fieldErrors?.tagline}
            hint={`${tagline.length}/90 — one line, what it does`}
          >
            <Input
              id="tagline"
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 90))}
              maxLength={90}
              required
              placeholder="Build apps by describing them"
              aria-invalid={Boolean(state.fieldErrors?.tagline)}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            required
            error={state.fieldErrors?.description}
            hint={`${description.length}/400`}
          >
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 400))}
              maxLength={400}
              required
              rows={3}
              placeholder="Two sentences a stranger can understand."
              aria-invalid={Boolean(state.fieldErrors?.description)}
            />
          </Field>
        </div>

        <div className="border-border bg-muted/40 rounded-b-lg border-t px-5 py-4">
          <div className="label label-bright">Preview</div>
          <PreviewCard
            name={name}
            tagline={tagline}
            description={description}
            category={category}
            url={url}
            faviconUrl={faviconUrl}
          />
        </div>
      </Panel>

      <Panel>
        <StepHeader n={3} title="Rules and payment" hint="One flat fee. Your private listing is ready after payment." />

        <div className="p-5">
          <Field
            label="Email"
            htmlFor="email"
            required
            error={state.fieldErrors?.email}
            hint="Where your private campaign link is sent."
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              aria-invalid={Boolean(state.fieldErrors?.email)}
            />
          </Field>

          <label className="border-border bg-muted/40 mt-5 flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-[13px] leading-relaxed">
            <input
              type="checkbox"
              name="rules"
              className="accent-primary mt-0.5 size-4 shrink-0 cursor-pointer"
              aria-invalid={Boolean(state.fieldErrors?.rules)}
            />
            <span className="text-subtle">
              This is a paid placement. Ranking is earned from measured interest, never bought,
              and the bottom of each round is eliminated.
            </span>
          </label>
          {state.fieldErrors?.rules ? (
            <p className="text-danger mt-2 text-[12px]">{state.fieldErrors.rules}</p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <LogoLoader className="size-4" />
                Taking you to checkout…
              </>
            ) : (
              `Continue to test checkout · ${priceLabel}`
            )}
          </Button>

          <p className="text-faint mt-3 text-center text-[12px]">
            Your listing is private after payment. Save the private link shown after checkout.
          </p>
        </div>
      </Panel>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A numbered step, not a caption. The filled coral badge gives the form three
 * visible checkpoints, and the tinted band separates each header from the
 * fields under it.
 */
function StepHeader({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="border-border bg-muted/40 flex items-center gap-3 rounded-t-lg border-b px-5 py-3.5">
      <span className="bg-primary text-primary-foreground num flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] leading-tight font-semibold">{title}</h2>
        <p className="text-faint mt-0.5 text-[12px] leading-snug">{hint}</p>
      </div>
    </div>
  );
}

function PreviewCard({
  name,
  tagline,
  description,
  category,
  url,
  faviconUrl,
}: {
  name: string;
  tagline: string;
  description: string;
  category: ProductCategory | "";
  url: string;
  faviconUrl: string;
}) {
  const host = url ? displayHost(url) : "yourproduct.com";

  return (
    <div className="bg-surface shadow-tile mt-2 rounded-lg p-5">
      <div className="flex items-start gap-3">
        {faviconUrl ? (
          // Arbitrary remote host, so a plain img rather than next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt=""
            width={40}
            height={40}
            className="border-border size-10 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="bg-muted-strong text-subtle flex size-10 shrink-0 items-center justify-center rounded-md text-[15px] font-semibold"
          >
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] leading-tight font-semibold">
            {name || "Your product"}
          </h3>
          <p className="text-subtle mt-0.5 truncate text-[13px]">
            {tagline || "Your tagline appears here"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="num text-subtle text-[15px] leading-none font-semibold">&mdash;</div>
          <div className="label mt-1.5">Collecting</div>
        </div>
      </div>

      <p className="text-subtle mt-3.5 line-clamp-3 text-[13px] leading-relaxed">
        {description || "Your description appears here, up to three lines on the board."}
      </p>

      <div className="text-faint mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
        <span className="text-subtle">
          {category ? CATEGORY_LABELS[category] : "Category"}
        </span>
        <span aria-hidden>&middot;</span>
        <span className="mono">{host}</span>
        <span aria-hidden>&middot;</span>
        <span>Round 1</span>
      </div>
    </div>
  );
}
