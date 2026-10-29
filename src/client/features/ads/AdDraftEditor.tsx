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
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { adsQueryKey } from "@/client/features/ads/AdArchivePanel";
import {
  AdContextBox,
  AdErrorNote,
  cleanList,
  ListField,
  type AdDraftView,
} from "@/client/features/ads/AdDraftParts";
import { PostMediaField } from "@/client/features/social/SocialPostEditorParts";
import type { MediaAsset } from "@/client/features/social/SocialMediaLibrary";
import {
  approveAdDraft,
  deleteAdDraft,
  saveAdDraft,
  unapproveAdDraft,
} from "@/serverFunctions/ads";
import { AD_CTA_TYPES, AD_DRAFT_KINDS } from "@/shared/social";

type Cta = (typeof AD_CTA_TYPES)[number];
type Kind = (typeof AD_DRAFT_KINDS)[number];

export function AdDraftEditor({
  projectId,
  draft,
  onClose,
  onSend,
}: {
  projectId: string;
  draft: AdDraftView | null;
  onClose: () => void;
  onSend: (draft: AdDraftView) => void;
}) {
  const { t } = useTranslation("ads");
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>(draft?.kind ?? "static");
  const [name, setName] = useState(draft?.name ?? "");
  const [angle, setAngle] = useState(draft?.angle ?? "");
  const [script, setScript] = useState(draft?.script ?? "");
  const [cta, setCta] = useState<Cta>(
    AD_CTA_TYPES.find((value) => value === draft?.cta) ?? "SHOP_NOW",
  );
  const [landingUrl, setLandingUrl] = useState(draft?.landingUrl ?? "");
  const [primaryTexts, setPrimaryTexts] = useState(draft?.primaryTexts ?? [""]);
  const [headlines, setHeadlines] = useState(draft?.headlines ?? [""]);
  const [descriptions, setDescriptions] = useState(draft?.descriptions ?? []);
  const [hooks, setHooks] = useState(draft?.hooks ?? []);
  const [media, setMedia] = useState<MediaAsset[]>(draft?.media ?? []);
  const editable = !draft || draft.status !== "sent";
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adsQueryKey(projectId) });

  const save = useMutation({
    mutationFn: () =>
      saveAdDraft({
        data: {
          projectId,
          draftId: draft?.id,
          draft: {
            kind,
            name,
            angle: angle || null,
            script: script || null,
            cta,
            landingUrl,
            primaryTexts: cleanList(primaryTexts),
            headlines: cleanList(headlines),
            descriptions: cleanList(descriptions),
            hooks: cleanList(hooks),
            mediaAssetIds: media.map((asset) => asset.id),
            targetKeyword: draft?.targetKeyword,
            sourceType: draft?.sourceType,
            sourceTitle: draft?.sourceTitle,
            sourceUrl: draft?.sourceUrl,
            inspiration: draft?.inspiration,
            contextNotes: draft?.contextNotes,
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

  const action = useMutation({
    mutationFn: async (kindOfAction: "approve" | "unapprove" | "delete") => {
      if (!draft) return;
      const input = { data: { projectId, draftId: draft.id } };
      const response =
        kindOfAction === "approve"
          ? await approveAdDraft(input)
          : kindOfAction === "unapprove"
            ? await unapproveAdDraft(input)
            : await deleteAdDraft(input);
      if (!response.ok) throw new Error(response.message);
    },
    onSuccess: async (_, kindOfAction) => {
      await refresh();
      if (kindOfAction === "approve") toast.success(t("editor.approved"));
      if (kindOfAction === "delete") toast.success(t("editor.deleted"));
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
            {draft ? t("editor.editTitle") : t("editor.newTitle")}
            {draft ? (
              <Badge variant="outline">
                {t(`drafts.status.${draft.status}`)}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <AdErrorNote draft={draft} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="ad-kind">{t("editor.kind")}</FieldLabel>
            <select
              id="ad-kind"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === "ugc" ? "ugc" : "static")
              }
            >
              {AD_DRAFT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`drafts.kind.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ad-name">{t("editor.name")}</FieldLabel>
            <Input
              id="ad-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ad-angle">{t("editor.angle")}</FieldLabel>
            <Input
              id="ad-angle"
              value={angle}
              onChange={(event) => setAngle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ad-cta">{t("editor.cta")}</FieldLabel>
            <select
              id="ad-cta"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={cta}
              onChange={(event) =>
                setCta(
                  AD_CTA_TYPES.find((value) => value === event.target.value) ??
                    "SHOP_NOW",
                )
              }
            >
              {AD_CTA_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="ad-landing">{t("editor.landingUrl")}</FieldLabel>
          <Input
            id="ad-landing"
            placeholder="https://"
            value={landingUrl}
            onChange={(event) => setLandingUrl(event.target.value)}
          />
          <FieldDescription>{t("editor.landingHint")}</FieldDescription>
          {draft?.trackedUrl ? (
            <FieldDescription className="break-all">
              {t("editor.trackedUrl")}: {draft.trackedUrl}
            </FieldDescription>
          ) : null}
        </Field>
        {kind === "ugc" ? (
          <Field>
            <FieldLabel htmlFor="ad-script">{t("editor.script")}</FieldLabel>
            <Textarea
              id="ad-script"
              rows={6}
              value={script}
              onChange={(event) => setScript(event.target.value)}
            />
          </Field>
        ) : null}
        <ListField
          label={t("editor.hooks")}
          values={hooks}
          onChange={setHooks}
          max={10}
        />
        <ListField
          label={t("editor.primaryTexts")}
          values={primaryTexts}
          onChange={setPrimaryTexts}
          multiline
          max={5}
        />
        <ListField
          label={t("editor.headlines")}
          values={headlines}
          onChange={setHeadlines}
          max={5}
        />
        <ListField
          label={t("editor.descriptions")}
          values={descriptions}
          onChange={setDescriptions}
          max={5}
        />
        <PostMediaField
          projectId={projectId}
          media={media}
          setMedia={setMedia}
          editable={editable}
          format="feed_square"
          headline={headlines[0] ?? name}
        />
        <AdContextBox draft={draft} />
        <DialogFooter className="flex-wrap gap-2">
          {draft && editable ? (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => action.mutate("delete")}
            >
              {t("editor.delete")}
            </Button>
          ) : null}
          {draft &&
          (draft.status === "approved" || draft.status === "failed") ? (
            <>
              <Button
                variant="outline"
                onClick={() => action.mutate("unapprove")}
              >
                {t("editor.unapprove")}
              </Button>
              <Button variant="outline" onClick={() => onSend(draft)}>
                {t("editor.send")}
              </Button>
            </>
          ) : null}
          {draft && draft.status === "draft" ? (
            <Button
              variant="outline"
              pending={action.isPending}
              onClick={() => action.mutate("approve")}
            >
              {t("editor.approve")}
            </Button>
          ) : null}
          {editable ? (
            <Button
              pending={save.isPending}
              disabled={
                !name.trim() ||
                !landingUrl.trim() ||
                cleanList(primaryTexts).length === 0 ||
                cleanList(headlines).length === 0
              }
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
