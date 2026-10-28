import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  blogTrackingQueryKey,
  type BlogSuggestion,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { formatNumber } from "@/i18n/format";
import { addBlogPosts } from "@/serverFunctions/blogTracking";
import type { TrackedPageKind } from "@/shared/pageTracking";

type ParsedPost = { url: string; targetKeyword?: string };

function parseLines(text: string) {
  const posts: ParsedPost[] = [];
  const invalid: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [urlPart = "", ...rest] = line.split(",");
    const url = urlPart.trim();
    const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (!URL.canParse(candidate) || !candidate.includes(".")) {
      invalid.push(url);
      continue;
    }
    const targetKeyword = rest.join(",").trim();
    posts.push({
      url: candidate,
      ...(targetKeyword ? { targetKeyword } : {}),
    });
  }
  return { posts, invalid };
}

export function AddBlogPostsDialog({
  projectId,
  kind,
  suggestions,
  onClose,
}: {
  projectId: string;
  kind: TrackedPageKind;
  suggestions: BlogSuggestion[];
  onClose: () => void;
}) {
  const { t } = useTranslation(["blogTracking", "common"]);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { posts: typedPosts, invalid } = parseLines(text);
  const typedUrls = new Set(typedPosts.map((post) => post.url));
  const posts = [
    ...typedPosts,
    ...[...selected]
      .filter((url) => !typedUrls.has(url))
      .map((url) => ({ url })),
  ];

  const mutation = useMutation({
    mutationFn: () =>
      addBlogPosts({
        data: { projectId, posts: posts.map((post) => ({ ...post, kind })) },
      }),
    meta: { errorToast: false },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: blogTrackingQueryKey(projectId),
      });
      toast.success(t("add.added", { count: result.added }));
      onClose();
    },
    onError: (mutationError) =>
      setError(getStandardErrorMessage(mutationError)),
  });

  const submit = () => {
    if (invalid.length > 0) {
      setError(t("add.invalidLines", { lines: invalid.join(", ") }));
      return;
    }
    if (posts.length === 0) {
      setError(t("add.nothingToAdd"));
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const toggle = (url: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(url);
      else next.delete(url);
      return next;
    });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(kind === "blog" ? "add.title" : "add.categoryTitle")}
          </DialogTitle>
          <DialogDescription>
            {t(kind === "blog" ? "add.urlsHint" : "add.categoryUrlsHint")}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="blog-post-urls">
            {t(kind === "blog" ? "add.urlsLabel" : "add.categoryUrlsLabel")}
          </FieldLabel>
          <Textarea
            id="blog-post-urls"
            rows={5}
            value={text}
            placeholder={t(
              kind === "blog"
                ? "add.urlsPlaceholder"
                : "add.categoryUrlsPlaceholder",
            )}
            onChange={(event) => setText(event.target.value)}
            className="font-mono text-xs"
          />
        </Field>
        {suggestions.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {t("add.suggestionsTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("add.suggestionsHint")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  setSelected(new Set(suggestions.map((item) => item.url)))
                }
              >
                {t("add.selectAll")}
              </Button>
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
              {suggestions.map((suggestion) => (
                <li key={suggestion.url}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(suggestion.url)}
                      onCheckedChange={(checked) =>
                        toggle(suggestion.url, checked)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {suggestion.url}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("add.suggestionMeta", {
                          clicks: formatNumber(suggestion.clicks),
                          impressions: formatNumber(suggestion.impressions),
                        })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            onClick={submit}
            pending={mutation.isPending}
            disabled={posts.length === 0}
          >
            {t(kind === "blog" ? "add.submit" : "add.categorySubmit", {
              count: posts.length,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
