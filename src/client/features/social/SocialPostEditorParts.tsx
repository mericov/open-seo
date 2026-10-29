import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, ImagePlus, Wand2, X } from "lucide-react";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { ImageComposer } from "@/client/features/social/ImageComposer";
import {
  SocialMediaLibrary,
  type MediaAsset,
} from "@/client/features/social/SocialMediaLibrary";
import type { listSocialPosts } from "@/serverFunctions/social";

export type SocialPostView = Awaited<
  ReturnType<typeof listSocialPosts>
>["scheduled"][number];

export function PostNotices({ post }: { post: SocialPostView | null }) {
  const { t } = useTranslation("social");
  return (
    <>
      {post?.errorMessage ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <span className="font-medium">{t("editor.error")}: </span>
          {post.errorMessage}
        </p>
      ) : null}
      {post?.permalink ? (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm underline"
        >
          <ExternalLink className="size-4" />
          {t("editor.live")}
        </a>
      ) : null}
    </>
  );
}

export function TrackedLink({ post }: { post: SocialPostView | null }) {
  const { t } = useTranslation("social");
  return post?.trackedUrl ? (
    <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-xs">
      <p className="flex items-center justify-between gap-2">
        <span className="break-all">
          <span className="font-medium">{t("editor.trackedUrl")}: </span>
          {post.trackedUrl}
        </span>
        <CopyButton
          value={post.trackedUrl}
          successMessage={t("media.copied")}
        />
      </p>
      {post.storyLinkUrl ? (
        <p className="text-muted-foreground">{t("editor.storyLink")}</p>
      ) : null}
    </div>
  ) : null;
}

export function PostMediaField({
  projectId,
  media,
  setMedia,
  editable,
  format,
  headline,
}: {
  projectId: string;
  media: MediaAsset[];
  setMedia: (update: (current: MediaAsset[]) => MediaAsset[]) => void;
  editable: boolean;
  format: string;
  headline: string;
}) {
  const { t } = useTranslation("social");
  const [picking, setPicking] = useState(false);
  const [composing, setComposing] = useState(false);
  return (
    <Field>
      <FieldLabel>{t("editor.media")}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {media.map((asset) => (
          <div
            key={asset.id}
            className="relative size-24 overflow-hidden rounded border"
          >
            {asset.contentType.startsWith("video/") ? (
              <video src={asset.url} className="size-full object-cover" muted />
            ) : (
              <img src={asset.url} alt="" className="size-full object-cover" />
            )}
            {editable ? (
              <button
                type="button"
                aria-label={t("editor.removeMedia")}
                className="absolute top-1 right-1 rounded bg-background/80 p-0.5"
                onClick={() =>
                  setMedia((current) =>
                    current.filter((item) => item.id !== asset.id),
                  )
                }
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        ))}
        {editable ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPicking((value) => !value)}
            >
              <ImagePlus className="size-4" />
              {t("editor.addMedia")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setComposing(true)}
            >
              <Wand2 className="size-4" />
              {t("editor.compose")}
            </Button>
          </div>
        ) : null}
      </div>
      {picking ? (
        <div className="mt-2 rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">{t("editor.pickMedia")}</p>
          <SocialMediaLibrary
            projectId={projectId}
            onPick={(asset) => {
              setMedia((current) =>
                current.some((item) => item.id === asset.id)
                  ? current
                  : [...current, asset],
              );
              setPicking(false);
            }}
          />
        </div>
      ) : null}
      {composing ? (
        <ImageComposer
          projectId={projectId}
          format={format}
          headline={headline}
          baseImages={media.filter(
            (asset) => !asset.contentType.startsWith("video/"),
          )}
          onSaved={(asset) => setMedia((current) => [...current, asset])}
          onClose={() => setComposing(false)}
        />
      ) : null}
    </Field>
  );
}

export function PostContextBox({ post }: { post: SocialPostView | null }) {
  const { t } = useTranslation("social");
  return post && (post.targetKeyword || post.sourceUrl || post.contextNotes) ? (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-1 font-medium">{t("editor.context")}</p>
      {post.targetKeyword ? (
        <p>
          {t("editor.keyword")}: {post.targetKeyword}
        </p>
      ) : null}
      {post.sourceUrl || post.sourceTitle ? (
        <p className="break-all">
          {t("editor.source")}: {post.sourceType ? `${post.sourceType} · ` : ""}
          {post.sourceTitle ?? ""} {post.sourceUrl ?? ""}
        </p>
      ) : null}
      {post.contextNotes ? (
        <p className="text-muted-foreground">
          {t("editor.notes")}: {post.contextNotes}
        </p>
      ) : null}
    </div>
  ) : null;
}
