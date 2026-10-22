import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { OptionSelect } from "@/client/features/leads/OptionSelect";
import {
  prQueryKey,
  type MediaContact,
  type MediaOutlet,
} from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  addMediaOutlet,
  saveMediaContact,
  updateMediaOutlet,
} from "@/serverFunctions/digitalPr";
import {
  MEDIA_CONTACT_ROLES,
  MEDIA_OUTLET_TYPES,
  PR_MARKETS,
  type MediaContactRole,
  type MediaOutletType,
  type PrMarket,
} from "@/shared/digitalPr";

function useRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });
}

export function OutletEditDialog({
  projectId,
  outlet,
  onClose,
}: {
  projectId: string;
  outlet: MediaOutlet;
  onClose: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  const refresh = useRefresh(projectId);
  const [name, setName] = useState(outlet.name ?? "");
  const [type, setType] = useState<MediaOutletType>(outlet.type);
  const [market, setMarket] = useState<PrMarket>(outlet.market);
  const [notes, setNotes] = useState(outlet.notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateMediaOutlet({
        data: {
          projectId,
          outletId: outlet.id,
          name: name.trim() || null,
          type,
          market,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      onClose();
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{outlet.domain}</DialogTitle>
          <DialogDescription>{t("media.editHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="outlet-name">
              {t("media.fields.name")}
            </FieldLabel>
            <Input
              id="outlet-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionSelect
              id="outlet-type"
              label={t("media.fields.type")}
              value={type}
              options={MEDIA_OUTLET_TYPES}
              optionLabel={(value) => t(`types.${value}`)}
              onChange={setType}
            />
            <OptionSelect
              id="outlet-market"
              label={t("media.fields.market")}
              value={market}
              options={PR_MARKETS}
              optionLabel={(value) => t(`markets.${value}`)}
              onChange={setMarket}
            />
          </div>
          <Field>
            <FieldLabel htmlFor="outlet-notes">
              {t("media.fields.notes")}
            </FieldLabel>
            <Textarea
              id="outlet-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            pending={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactEditDialog({
  projectId,
  outlet,
  contact,
  onClose,
}: {
  projectId: string;
  outlet: MediaOutlet;
  contact: MediaContact | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  const refresh = useRefresh(projectId);
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? "");
  const [role, setRole] = useState<MediaContactRole>(contact?.role ?? "author");

  const cleanEmail = email.trim().toLowerCase();
  const valid =
    (name.trim().length > 0 || cleanEmail.length > 0) &&
    (cleanEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));

  const mutation = useMutation({
    mutationFn: () =>
      saveMediaContact({
        data: {
          projectId,
          outletId: outlet.id,
          contactId: contact?.id,
          name: name.trim() || null,
          email: cleanEmail || null,
          jobTitle: jobTitle.trim() || null,
          role,
        },
      }),
    onSuccess: async () => {
      onClose();
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contact ? t("media.editContact") : t("media.addContact")}
          </DialogTitle>
          <DialogDescription>{outlet.name ?? outlet.domain}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="contact-name">
              {t("media.fields.contactName")}
            </FieldLabel>
            <Input
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-email">
              {t("media.fields.email")}
            </FieldLabel>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contact-title">
                {t("media.fields.jobTitle")}
              </FieldLabel>
              <Input
                id="contact-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </Field>
            <OptionSelect
              id="contact-role"
              label={t("media.fields.role")}
              value={role}
              options={MEDIA_CONTACT_ROLES}
              optionLabel={(value) => t(`roles.${value}`)}
              onChange={setRole}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!valid}
            pending={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddOutletDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  const refresh = useRefresh(projectId);
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<MediaOutletType>("news");
  const [market, setMarket] = useState<PrMarket>("tr");

  const mutation = useMutation({
    mutationFn: () =>
      addMediaOutlet({
        data: { projectId, domain: domain.trim(), type, market },
      }),
    onSuccess: async () => {
      toast.success(t("media.outletAdded"));
      onClose();
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("media.addOutlet")}</DialogTitle>
          <DialogDescription>{t("media.addOutletHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="new-outlet-domain">
              {t("media.fields.domain")}
            </FieldLabel>
            <Input
              id="new-outlet-domain"
              autoFocus
              placeholder="ornekdergi.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionSelect
              id="new-outlet-type"
              label={t("media.fields.type")}
              value={type}
              options={MEDIA_OUTLET_TYPES}
              optionLabel={(value) => t(`types.${value}`)}
              onChange={setType}
            />
            <OptionSelect
              id="new-outlet-market"
              label={t("media.fields.market")}
              value={market}
              options={PR_MARKETS}
              optionLabel={(value) => t(`markets.${value}`)}
              onChange={setMarket}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={domain.trim().length < 3}
            pending={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
