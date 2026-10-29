import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  PostContextBox,
  PostMediaField,
  PostNotices,
  TrackedLink,
  type SocialPostView,
} from "@/client/features/social/SocialPostEditorParts";
import { socialQueryKey } from "@/client/features/social/socialQueries";
import {
  approveSocialPosts,
  deleteSocialPost,
  saveSocialPost,
  unapproveSocialPosts,
} from "@/serverFunctions/social";
import {
  SOCIAL_IDEA_TYPES,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
} from "@/shared/social";
import { utcToZoned, zonedToUtcIso } from "@/shared/socialTime";

type MediaView = SocialPostView["media"][number];

function EnumSelect<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T;
  options: readonly T[];
  label: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      items={options.map((option) => ({ value: option, label: label(option) }))}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function initialForm(
  post: SocialPostView | null,
  timezone: string,
  defaultLanguage: string,
  defaultDay: string | null,
) {
  const local = post?.scheduledAt
    ? utcToZoned(post.scheduledAt, timezone)
    : null;
  return {
    platform: post?.platform ?? SOCIAL_PLATFORMS[0],
    format: post?.format ?? SOCIAL_POST_FORMATS[1],
    ideaType: post?.ideaType ?? SOCIAL_IDEA_TYPES[0],
    title: post?.title ?? "",
    hook: post?.hook ?? "",
    caption: post?.caption ?? "",
    hashtags: post?.hashtags.join(" ") ?? "",
    languageCode: post?.languageCode ?? defaultLanguage,
    linkUrl: post?.linkUrl ?? "",
    day: local?.day ?? defaultDay ?? "",
    time: local?.time ?? "19:00",
  };
}

export function SocialPostEditor({
  projectId,
  post,
  timezone,
  defaultLanguage,
  defaultDay,
  onClose,
}: {
  projectId: string;
  post: SocialPostView | null;
  timezone: string;
  defaultLanguage: string;
  defaultDay: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["social", "common"]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() =>
    initialForm(post, timezone, defaultLanguage, defaultDay),
  );
  const [media, setMedia] = useState<MediaView[]>(post?.media ?? []);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const editable =
    !post || ["draft", "approved", "scheduled", "failed"].includes(post.status);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: socialQueryKey(projectId) });

  const save = useMutation({
    mutationFn: () =>
      saveSocialPost({
        data: {
          projectId,
          postId: post?.id,
          post: {
            platform: form.platform,
            format: form.format,
            ideaType: form.ideaType,
            title: form.title,
            hook: form.hook || null,
            caption: form.caption,
            hashtags: form.hashtags
              .split(/[\s,]+/)
              .map((tag) => tag.replace(/^#/, ""))
              .filter(Boolean),
            languageCode: form.languageCode,
            linkUrl: form.linkUrl.trim() || null,
            scheduledAt: form.day
              ? zonedToUtcIso(form.day, form.time, timezone)
              : null,
            mediaAssetIds: media.map((asset) => asset.id),
            targetKeyword: post?.targetKeyword,
            sourceType: post?.sourceType,
            sourceTitle: post?.sourceTitle,
            sourceUrl: post?.sourceUrl,
            contextNotes: post?.contextNotes,
            imageBrief: post?.imageBrief,
          },
        },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await refresh();
      toast.success(t("editor.saved"));
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const statusAction = useMutation({
    mutationFn: async (action: "approve" | "unapprove" | "delete") => {
      if (!post) return;
      if (action === "approve") {
        const [result] = await approveSocialPosts({
          data: { projectId, postIds: [post.id] },
        });
        if (result?.error) throw new Error(result.error);
      } else if (action === "unapprove") {
        await unapproveSocialPosts({ data: { projectId, postIds: [post.id] } });
      } else {
        const response = await deleteSocialPost({
          data: { projectId, postId: post.id },
        });
        if (!response.ok) throw new Error(response.message);
      }
    },
    onSuccess: async (_, action) => {
      await refresh();
      if (action === "delete") toast.success(t("editor.deleted"));
      onClose();
    },
    onError: (error) =>
      toast.error(error.message || getStandardErrorMessage(error)),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {post ? t("editor.editTitle") : t("editor.newTitle")}
            {post ? (
              <Badge variant="outline">{t(`status.${post.status}`)}</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <PostNotices post={post} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>{t("editor.platform")}</FieldLabel>
            <EnumSelect
              value={form.platform}
              options={SOCIAL_PLATFORMS}
              label={(value) => t(`platform.${value}`)}
              onChange={(value) => set("platform", value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("editor.format")}</FieldLabel>
            <EnumSelect
              value={form.format}
              options={SOCIAL_POST_FORMATS}
              label={(value) => t(`format.${value}`)}
              onChange={(value) => set("format", value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("editor.ideaType")}</FieldLabel>
            <EnumSelect
              value={form.ideaType}
              options={SOCIAL_IDEA_TYPES}
              label={(value) => t(`ideaType.${value}`)}
              onChange={(value) => set("ideaType", value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <Field>
            <FieldLabel htmlFor="post-title">{t("editor.title")}</FieldLabel>
            <Input
              id="post-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="post-lang">{t("editor.language")}</FieldLabel>
            <Input
              id="post-lang"
              value={form.languageCode}
              onChange={(event) => set("languageCode", event.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="post-hook">{t("editor.hook")}</FieldLabel>
          <Input
            id="post-hook"
            value={form.hook}
            onChange={(event) => set("hook", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="post-caption">{t("editor.caption")}</FieldLabel>
          <Textarea
            id="post-caption"
            rows={7}
            value={form.caption}
            onChange={(event) => set("caption", event.target.value)}
          />
          <FieldDescription>{form.caption.length} / 2200</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="post-tags">{t("editor.hashtags")}</FieldLabel>
          <Input
            id="post-tags"
            value={form.hashtags}
            onChange={(event) => set("hashtags", event.target.value)}
          />
          <FieldDescription>{t("editor.hashtagsHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="post-link">{t("editor.link")}</FieldLabel>
          <Input
            id="post-link"
            placeholder="https://"
            value={form.linkUrl}
            onChange={(event) => set("linkUrl", event.target.value)}
          />
          <FieldDescription>{t("editor.linkHint")}</FieldDescription>
        </Field>
        <TrackedLink post={post} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="post-day">{t("editor.date")}</FieldLabel>
            <Input
              id="post-day"
              type="date"
              value={form.day}
              onChange={(event) => set("day", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="post-time">{t("editor.time")}</FieldLabel>
            <Input
              id="post-time"
              type="time"
              value={form.time}
              onChange={(event) => set("time", event.target.value)}
            />
            <FieldDescription>{timezone}</FieldDescription>
          </Field>
        </div>
        <PostMediaField
          projectId={projectId}
          media={media}
          setMedia={setMedia}
          editable={editable}
          format={form.format}
          headline={form.hook || form.title}
        />
        <PostContextBox post={post} />
        {post && ["approved", "scheduled"].includes(post.status) ? (
          <p className="text-xs text-muted-foreground">
            {t("editor.reapproveNote")}
          </p>
        ) : null}
        <DialogFooter className="flex-wrap gap-2">
          {post && editable ? (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              pending={
                statusAction.isPending && statusAction.variables === "delete"
              }
              onClick={() => statusAction.mutate("delete")}
            >
              {t("editor.delete")}
            </Button>
          ) : null}
          {post && ["approved", "scheduled", "failed"].includes(post.status) ? (
            <Button
              variant="outline"
              onClick={() => statusAction.mutate("unapprove")}
            >
              {t("editor.unapprove")}
            </Button>
          ) : null}
          {post && ["draft", "failed"].includes(post.status) ? (
            <Button
              variant="outline"
              pending={
                statusAction.isPending && statusAction.variables === "approve"
              }
              onClick={() => statusAction.mutate("approve")}
            >
              {t("editor.approve")}
            </Button>
          ) : null}
          {editable ? (
            <Button
              pending={save.isPending}
              disabled={!form.title.trim() || !form.caption.trim()}
              onClick={() => save.mutate()}
            >
              {t("editor.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
