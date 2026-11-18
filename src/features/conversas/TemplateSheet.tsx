import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { conversationsApi, type ConversationTemplate } from "@/api/conversations";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { Sheet } from "@/ui/sheet";
import { upsertMessage, type MessagesData } from "./messages";
import {
  CATEGORY_LABEL,
  initialValues,
  missingFields,
  renderPreview,
  templateKey,
} from "./templates";

interface TemplateSheetProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

/** Templates aprovados do canal oficial: escolher, conferir os campos e enviar (backend, adendo iu). */
export function TemplateSheet({ conversationId, open, onClose, onSent }: TemplateSheetProps) {
  const [selected, setSelected] = useState<ConversationTemplate | null>(null);
  const templates = useQuery({
    queryKey: ["conversation-templates", conversationId],
    queryFn: () => conversationsApi.templates(conversationId),
    enabled: open,
    staleTime: 60_000,
  });
  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Sheet open={open} title={selected ? selected.name : "Enviar template"} onClose={close}>
      {selected ? (
        <TemplateForm
          key={templateKey(selected)}
          conversationId={conversationId}
          template={selected}
          onBack={() => setSelected(null)}
          onSent={() => {
            close();
            onSent();
          }}
        />
      ) : (
        <div className="px-5 pb-2">
          <p className="pb-3 text-sm text-muted-foreground">
            Fora da janela de 24 horas, o WhatsApp oficial só entrega modelos aprovados pela Meta.
            Quando o cliente responder, a conversa volta ao normal.
          </p>
          {templates.isLoading ? (
            <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando templates…
            </p>
          ) : templates.error ? (
            <ErrorText>
              {templates.error instanceof ApiError
                ? templates.error.detail
                : "Não foi possível carregar os templates."}
            </ErrorText>
          ) : !templates.data?.length ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhum template aprovado neste número. Peça ao gestor para criar um no painel.
            </p>
          ) : (
            <ul aria-label="Templates aprovados" className="-mx-5">
              {templates.data.map((template) => (
                <li key={templateKey(template)}>
                  <button
                    type="button"
                    onClick={() => setSelected(template)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-5 py-2 text-left active:bg-muted",
                      !template.sendable && "opacity-60"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{template.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {CATEGORY_LABEL[template.category] ?? template.category} ·{" "}
                        {template.preview}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function TemplateForm({
  conversationId,
  template,
  onBack,
  onSent,
}: {
  conversationId: string;
  template: ConversationTemplate;
  onBack: () => void;
  onSent: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => initialValues(template));
  const [clientId] = useState(() => `tpl-${crypto.randomUUID()}`);
  const missing = missingFields(template, values);
  const send = useMutation({
    mutationFn: () =>
      conversationsApi.sendTemplate(conversationId, {
        template_name: template.name,
        language: template.language,
        values,
        client_message_id: clientId,
      }),
    onSuccess: (message) => {
      queryClient.setQueryData<MessagesData>(["messages", conversationId], (data) =>
        data ? upsertMessage(data, message) : data
      );
      void queryClient.invalidateQueries({ queryKey: ["meta-window", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onSent();
    },
  });

  return (
    <div className="space-y-4 px-5 pb-2">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground active:bg-muted"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Outros templates
      </button>
      {!template.sendable && <ErrorText>{template.unavailable_reason}</ErrorText>}
      {template.fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          value={values[field.key] ?? ""}
          placeholder={field.example || undefined}
          disabled={!template.sendable}
          onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
        />
      ))}
      <div>
        <p className="pb-1 text-xs font-medium text-muted-foreground">Prévia</p>
        <p
          data-testid="template-preview"
          className="whitespace-pre-wrap rounded-2xl bg-bubble-out p-3 text-sm"
        >
          {renderPreview(template, values)}
          {template.footer && (
            <span className="block pt-2 text-xs text-muted-foreground">{template.footer}</span>
          )}
        </p>
      </div>
      {send.error && (
        <ErrorText>
          {send.error instanceof ApiError ? send.error.detail : "Não foi possível enviar."}
        </ErrorText>
      )}
      {template.sendable && missing.length > 0 && (
        <p className="text-xs text-muted-foreground">Preencha: {missing.join(", ")}.</p>
      )}
      <Button
        block
        onClick={() => send.mutate()}
        disabled={!template.sendable || missing.length > 0 || send.isPending}
      >
        {send.isPending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Send aria-hidden="true" />
        )}
        Enviar template
      </Button>
    </div>
  );
}
