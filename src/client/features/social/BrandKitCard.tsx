import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Skeleton } from "@/client/components/ui/skeleton";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  brandKitOptions,
  socialQueryKey,
} from "@/client/features/social/socialQueries";
import { saveBrandKit } from "@/serverFunctions/social";

const EMPTY = {
  tone: "",
  targetAudience: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  headingFont: "",
  bodyFont: "",
  logoUrl: "",
  bannedPhrases: "",
};

type BrandKitForm = typeof EMPTY;

export function BrandKitCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation("social");
  const query = useQuery(brandKitOptions(projectId));
  return (
    <CardShell
      title={t("brandKit.title")}
      icon={<Palette className="size-4" />}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {t("brandKit.description")}
      </p>
      {query.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <BrandKitForm
          projectId={projectId}
          initial={{
            ...EMPTY,
            ...Object.fromEntries(
              Object.entries(query.data ?? {}).map(([key, value]) => [
                key,
                value ?? "",
              ]),
            ),
          }}
        />
      )}
    </CardShell>
  );
}

function BrandKitForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: BrandKitForm;
}) {
  const { t } = useTranslation("social");
  const queryClient = useQueryClient();
  const [values, setValues] = useState<BrandKitForm>(initial);
  const set = (key: keyof BrandKitForm, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => saveBrandKit({ data: { projectId, brandKit: values } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: socialQueryKey(projectId),
      });
      toast.success(t("brandKit.saved"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const color = (key: "primaryColor" | "secondaryColor" | "accentColor") => (
    <Field>
      <FieldLabel htmlFor={`brand-${key}`}>{t(`brandKit.${key}`)}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t(`brandKit.${key}`)}
          className="h-9 w-10 cursor-pointer rounded border bg-transparent"
          value={values[key] || "#000000"}
          onChange={(event) => set(key, event.target.value)}
        />
        <Input
          id={`brand-${key}`}
          placeholder="#1A2B3C"
          value={values[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      </div>
    </Field>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="brand-tone">{t("brandKit.tone")}</FieldLabel>
          <Textarea
            id="brand-tone"
            rows={3}
            placeholder={t("brandKit.tonePlaceholder")}
            value={values.tone}
            onChange={(event) => set("tone", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="brand-audience">
            {t("brandKit.targetAudience")}
          </FieldLabel>
          <Textarea
            id="brand-audience"
            rows={3}
            placeholder={t("brandKit.targetAudiencePlaceholder")}
            value={values.targetAudience}
            onChange={(event) => set("targetAudience", event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {color("primaryColor")}
        {color("secondaryColor")}
        {color("accentColor")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="brand-heading-font">
            {t("brandKit.headingFont")}
          </FieldLabel>
          <Input
            id="brand-heading-font"
            placeholder="Playfair Display"
            value={values.headingFont}
            onChange={(event) => set("headingFont", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="brand-body-font">
            {t("brandKit.bodyFont")}
          </FieldLabel>
          <Input
            id="brand-body-font"
            placeholder="Inter"
            value={values.bodyFont}
            onChange={(event) => set("bodyFont", event.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="brand-logo">{t("brandKit.logoUrl")}</FieldLabel>
        <div className="flex items-center gap-3">
          {values.logoUrl ? (
            <img
              src={values.logoUrl}
              alt=""
              className="size-10 rounded border object-contain"
            />
          ) : null}
          <Input
            id="brand-logo"
            placeholder="https://…"
            value={values.logoUrl}
            onChange={(event) => set("logoUrl", event.target.value)}
          />
        </div>
        <FieldDescription>{t("brandKit.logoHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="brand-banned">
          {t("brandKit.bannedPhrases")}
        </FieldLabel>
        <Textarea
          id="brand-banned"
          rows={4}
          value={values.bannedPhrases}
          onChange={(event) => set("bannedPhrases", event.target.value)}
        />
        <FieldDescription>{t("brandKit.bannedPhrasesHint")}</FieldDescription>
      </Field>
      <Button type="submit" pending={mutation.isPending}>
        {t("brandKit.save")}
      </Button>
    </form>
  );
}
