import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  blobToBase64,
  SocialMediaLibrary,
  type MediaAsset,
} from "@/client/features/social/SocialMediaLibrary";
import {
  brandKitOptions,
  socialMediaOptions,
} from "@/client/features/social/socialQueries";
import { uploadSocialMedia } from "@/serverFunctions/social";

const ASPECT_KEYS = ["1:1", "4:5", "9:16"] as const;
const ASPECTS = {
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
} as const;
type Aspect = keyof typeof ASPECTS;
type Position = "top" | "center" | "bottom";

function aspectFor(format: string): Aspect {
  if (format === "feed_square") return "1:1";
  if (format === "story" || format === "reel") return "9:16";
  return "4:5";
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = url;
  });
}

async function loadFont(family: string | null | undefined) {
  if (!family) return "Inter, system-ui, sans-serif";
  const id = `font-${family.replace(/\s+/g, "-")}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@700&display=swap`;
    document.head.appendChild(link);
  }
  await document.fonts.load(`700 64px "${family}"`).catch(() => undefined);
  return `"${family}", Inter, system-ui, sans-serif`;
}

function cover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

async function render(
  canvas: HTMLCanvasElement,
  options: {
    baseUrl: string;
    aspect: Aspect;
    headline: string;
    position: Position;
    textColor: string;
    bandColor: string;
    font: string | null | undefined;
    logoUrl: string | null;
  },
) {
  const [width, height] = ASPECTS[options.aspect];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = await loadImage(options.baseUrl);
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  if (Math.abs(imageRatio - targetRatio) > 0.15) {
    context.filter = "blur(40px) brightness(0.85)";
    cover(context, image, width, height);
    context.filter = "none";
    const scale = Math.min(width / image.width, height / image.height);
    context.drawImage(
      image,
      (width - image.width * scale) / 2,
      (height - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  } else cover(context, image, width, height);

  if (options.headline.trim()) {
    const fontFamily = await loadFont(options.font);
    const size = Math.round(width / 14);
    context.font = `700 ${size}px ${fontFamily}`;
    const lines = wrap(context, options.headline.trim(), width - 160);
    const lineHeight = size * 1.2;
    const bandHeight = lines.length * lineHeight + 80;
    const safe = options.aspect === "9:16" ? 260 : 60;
    const top =
      options.position === "top"
        ? safe
        : options.position === "bottom"
          ? height - safe - bandHeight
          : (height - bandHeight) / 2;
    context.fillStyle = `${options.bandColor}d9`;
    context.fillRect(40, top, width - 80, bandHeight);
    context.fillStyle = options.textColor;
    context.textAlign = "center";
    context.textBaseline = "top";
    lines.forEach((line, index) => {
      context.fillText(line, width / 2, top + 40 + index * lineHeight);
    });
  }
  if (options.logoUrl) {
    const logo = await loadImage(options.logoUrl).catch(() => null);
    if (logo) {
      const logoWidth = width * 0.16;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      const bottom = options.aspect === "9:16" ? 260 : 50;
      context.drawImage(
        logo,
        width - logoWidth - 50,
        height - logoHeight - bottom,
        logoWidth,
        logoHeight,
      );
    }
  }
}

export function ImageComposer({
  projectId,
  format,
  headline: initialHeadline,
  baseImages,
  onSaved,
  onClose,
}: {
  projectId: string;
  format: string;
  headline: string;
  baseImages: MediaAsset[];
  onSaved: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("social");
  const queryClient = useQueryClient();
  const kit = useQuery(brandKitOptions(projectId)).data;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<MediaAsset | null>(baseImages[0] ?? null);
  const [aspect, setAspect] = useState<Aspect>(aspectFor(format));
  const [headline, setHeadline] = useState(initialHeadline);
  const [position, setPosition] = useState<Position>("bottom");
  const [textColor, setTextColor] = useState("#ffffff");
  const [bandColor, setBandColor] = useState("#000000");
  const [withLogo, setWithLogo] = useState(false);

  useEffect(() => {
    if (kit?.primaryColor) setBandColor(kit.primaryColor);
    if (kit?.secondaryColor) setTextColor(kit.secondaryColor);
  }, [kit?.primaryColor, kit?.secondaryColor]);

  useEffect(() => {
    if (!base || !canvasRef.current) return;
    void render(canvasRef.current, {
      baseUrl: base.url,
      aspect,
      headline,
      position,
      textColor,
      bandColor,
      font: kit?.headingFont,
      logoUrl: withLogo ? (kit?.logoUrl ?? null) : null,
    });
  }, [
    base,
    aspect,
    headline,
    position,
    textColor,
    bandColor,
    withLogo,
    kit?.headingFont,
    kit?.logoUrl,
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error(t("composer.noBase"));
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error(t("composer.noBase"));
      return uploadSocialMedia({
        data: {
          projectId,
          fileName: `composed-${aspect}.jpg`,
          base64: await blobToBase64(blob),
        },
      });
    },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: socialMediaOptions(projectId).queryKey,
      });
      onSaved(response.result);
      toast.success(t("composer.saved"));
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("composer.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
          <div className="flex items-start justify-center rounded-md bg-muted p-2">
            {base ? (
              <canvas
                ref={canvasRef}
                className="max-h-[60vh] w-auto max-w-full"
              />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                {t("composer.noBase")}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <Field>
              <FieldLabel>{t("composer.aspect")}</FieldLabel>
              <SegmentedToggle
                showLabels
                value={aspect}
                onChange={setAspect}
                items={ASPECT_KEYS.map((value) => ({
                  value,
                  icon: null,
                  label: value,
                }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="composer-text">
                {t("composer.headline")}
              </FieldLabel>
              <Textarea
                id="composer-text"
                rows={3}
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("composer.position")}</FieldLabel>
              <SegmentedToggle
                showLabels
                value={position}
                onChange={setPosition}
                items={(["top", "center", "bottom"] as const).map((value) => ({
                  value,
                  icon: null,
                  label: t(`composer.${value}`),
                }))}
              />
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                />
                {t("composer.textColor")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={bandColor}
                  onChange={(event) => setBandColor(event.target.value)}
                />
                {t("composer.bandColor")}
              </label>
            </div>
            {kit?.logoUrl ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={withLogo}
                  onChange={(event) => setWithLogo(event.target.checked)}
                />
                {t("composer.logo")}
              </label>
            ) : null}
            {aspect === "9:16" ? (
              <p className="text-xs text-muted-foreground">
                {t("composer.fillNote")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("composer.base")}</p>
          <SocialMediaLibrary projectId={projectId} onPick={setBase} />
        </div>
        <DialogFooter>
          <Button
            pending={save.isPending}
            disabled={!base}
            onClick={() => save.mutate()}
          >
            {t("composer.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
