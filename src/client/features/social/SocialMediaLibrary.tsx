import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { socialMediaOptions } from "@/client/features/social/socialQueries";
import {
  deleteSocialMedia,
  importSocialMedia,
  uploadSocialMedia,
} from "@/serverFunctions/social";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function toJpegIfNeeded(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/jpeg")
    return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.92),
  );
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function SocialMediaLibrary({
  projectId,
  onPick,
}: {
  projectId: string;
  onPick?: (assetId: string) => void;
}) {
  const { t } = useTranslation("social");
  const queryClient = useQueryClient();
  const query = useQuery(socialMediaOptions(projectId));
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: socialMediaOptions(projectId).queryKey,
    });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const blob = await toJpegIfNeeded(file);
      if (blob.size > MAX_UPLOAD_BYTES) throw new Error(t("media.tooLarge"));
      return uploadSocialMedia({
        data: {
          projectId,
          fileName: file.name,
          base64: await blobToBase64(blob),
        },
      });
    },
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await invalidate();
      toast.success(t("media.imported"));
    },
    onError: (error) =>
      toast.error(error.message || getStandardErrorMessage(error)),
  });

  const importUrl = useMutation({
    mutationFn: () => importSocialMedia({ data: { projectId, url } }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      setUrl("");
      await invalidate();
      toast.success(t("media.imported"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (assetId: string) =>
      deleteSocialMedia({ data: { projectId, assetId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success(t("media.deleted"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {onPick ? null : (
        <div>
          <h2 className="text-lg font-semibold">{t("media.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("media.description")}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/mp4,video/quicktime"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          pending={upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          {upload.isPending ? t("media.uploading") : t("media.upload")}
        </Button>
        <form
          className="flex min-w-64 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim()) importUrl.mutate();
          }}
        >
          <Input
            placeholder={t("media.importPlaceholder")}
            aria-label={t("media.importUrl")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            pending={importUrl.isPending}
            disabled={!url.trim()}
          >
            {t("media.import")}
          </Button>
        </form>
      </div>
      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("media.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {query.data?.map((asset) => (
            <figure
              key={asset.id}
              className="group overflow-hidden rounded-lg border bg-muted/30"
            >
              <button
                type="button"
                className="block aspect-square w-full"
                disabled={!onPick}
                onClick={() => onPick?.(asset.id)}
              >
                {asset.contentType.startsWith("video/") ? (
                  <video
                    src={asset.url}
                    className="size-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.label ?? ""}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </button>
              <figcaption className="flex items-center justify-between gap-1 p-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {asset.width
                    ? `${asset.width}×${asset.height}`
                    : asset.source}
                </span>
                {onPick ? null : (
                  <span className="flex gap-1">
                    <CopyButton
                      value={asset.url}
                      label={t("media.copyUrl")}
                      successMessage={t("media.copied")}
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t("media.delete")}
                      onClick={() => remove.mutate(asset.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
