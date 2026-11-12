import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  CircleHelp,
  Contact,
  Hourglass,
  MessageCircleHeart,
  MessageCircleOff,
  MessageCircleWarning,
  MessagesSquare,
  Percent,
  Send,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { metricsApi } from "@/api/metrics";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AgoraPage } from "./AgoraPage";
import { PeriodPicker } from "./PeriodPicker";
import { STALE_MS, useOverview } from "./useOverview";
import { Card, DayBars, Loading, RankBars, SectionError, StatGrid, StatTile } from "./charts";
import {
  asPeriod,
  change,
  dayRange,
  formatInt,
  formatMoney,
  formatPercent,
  type PeriodKey,
} from "./period";

const SECTIONS = [
  { key: "agora", label: "Agora" },
  { key: "comercial", label: "Comercial" },
  { key: "marketing", label: "Marketing" },
  { key: "whatsapp", label: "PerformaZap" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const asSection = (value: string | null): SectionKey =>
  SECTIONS.some((item) => item.key === value) ? (value as SectionKey) : "agora";

function versus(current: number, previous: number): string | undefined {
  const delta = change(current, previous);
  if (delta === null) return undefined;
  return `${delta > 0 ? "+" : ""}${delta}% sobre o período anterior`;
}

function Comercial({ period }: { period: PeriodKey }) {
  const overview = useOverview(period);
  const range = dayRange(period);
  const origem = useQuery({
    queryKey: ["metrics", "origem", period],
    queryFn: () => metricsApi.origem(range),
    staleTime: STALE_MS,
    retry: false,
  });
  if (overview.isPending) return <Loading />;
  if (!overview.data) {
    return <SectionError error={overview.error} onRetry={() => void overview.refetch()} />;
  }
  const { commercial, attendance } = overview.data;
  const summary = commercial.executiveSummary;
  const leads = commercial.kpis.leadsPeriod;
  return (
    <div className="space-y-4">
      <StatGrid label="Leads">
        <StatTile
          icon={UserPlus}
          tone="primary"
          label="Leads que entraram"
          value={formatInt(leads)}
          hint={versus(leads, commercial.previous.leads)}
        />
        <StatTile
          icon={Trophy}
          tone="success"
          label="Convertidos"
          value={formatInt(summary.conversionsInPeriod)}
          hint={versus(summary.conversionsInPeriod, commercial.previous.conversions)}
        />
        <StatTile
          icon={UserX}
          tone="warning"
          label="Perdidos"
          value={origem.data ? formatInt(origem.data.kpis.perdidos) : "–"}
        />
        <StatTile
          icon={Percent}
          tone="violet"
          label="Taxa de conversão"
          value={formatPercent(summary.conversionRatePercent)}
        />
        <StatTile
          icon={Contact}
          tone="neutral"
          label="Contatos únicos"
          value={formatInt(summary.uniqueContacts)}
        />
        <StatTile
          icon={BadgeCheck}
          tone="primary"
          label="Qualificados"
          value={formatInt(summary.interestedOrQualified)}
        />
      </StatGrid>
      {attendance && (
        <StatGrid label="Atendimento">
          <StatTile
            icon={MessagesSquare}
            tone="primary"
            label="Novos atendimentos"
            value={formatInt(attendance.new_attendances)}
          />
          <StatTile
            icon={Hourglass}
            tone="warning"
            label="Espera média"
            value={formatDuration(attendance.avg_waiting_time_seconds)}
          />
          <StatTile
            icon={ArrowRightLeft}
            tone="neutral"
            label="Transferências"
            value={formatInt(attendance.transfers)}
          />
        </StatGrid>
      )}
      {commercial.leadsData.length > 1 && (
        <Card title="Leads por dia">
          <DayBars
            unit="leads"
            days={commercial.leadsData.map((day) => ({ date: day.date, value: day.leads }))}
          />
        </Card>
      )}
      <Card title="Conversões por pessoa">
        <RankBars
          empty="Sem conversões no período."
          items={commercial.teamPerformance
            .filter((person) => person.conversions > 0)
            .map((person) => ({
              key: person.userId ?? person.name,
              label: person.name,
              value: person.conversions,
            }))}
        />
      </Card>
    </div>
  );
}

function Marketing({ period }: { period: PeriodKey }) {
  const range = dayRange(period);
  const marketing = useQuery({
    queryKey: ["metrics", "marketing", period],
    queryFn: () => metricsApi.marketing(range),
    staleTime: STALE_MS,
  });
  const origem = useQuery({
    queryKey: ["metrics", "origem", period],
    queryFn: () => metricsApi.origem(range),
    staleTime: STALE_MS,
    retry: false,
  });
  const pixel = useQuery({
    queryKey: ["metrics", "pixel"],
    queryFn: metricsApi.pixel,
    staleTime: STALE_MS,
    retry: false,
  });
  if (marketing.isPending) return <Loading />;
  if (!marketing.data) {
    return <SectionError error={marketing.error} onRetry={() => void marketing.refetch()} />;
  }
  const { resumo, canais, fontes, moeda, tem_gasto: hasSpend } = marketing.data;
  const campaigns = canais
    .flatMap((canal) => canal.campanhas.map((item) => ({ ...item, canal: canal.canal })))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 10);
  const money = (value: number | null) => (value === null ? "–" : formatMoney(value, moeda));
  return (
    <div className="space-y-4">
      <StatGrid label="Resultado de marketing">
        <StatTile
          icon={UserPlus}
          tone="primary"
          label="Leads"
          value={formatInt(resumo.leads)}
          hint={`${formatInt(resumo.leads_novos)} novos`}
        />
        <StatTile
          icon={BadgeCheck}
          tone="primary"
          label="Qualificados"
          value={formatInt(resumo.qualificados)}
        />
        <StatTile
          icon={Trophy}
          tone="success"
          label="Ganhos"
          value={formatInt(resumo.ganhos)}
          hint={
            resumo.taxa_ganho === null ? undefined : `${formatPercent(resumo.taxa_ganho)} dos leads`
          }
        />
        <StatTile
          icon={CircleDollarSign}
          tone="success"
          label="Receita"
          value={formatMoney(resumo.receita, moeda)}
        />
        {hasSpend && (
          <>
            <StatTile icon={Wallet} tone="neutral" label="Investido" value={money(resumo.gasto)} />
            <StatTile icon={Tag} tone="neutral" label="Custo por lead" value={money(resumo.cpl)} />
            <StatTile
              icon={TrendingUp}
              tone="violet"
              label="Retorno (ROAS)"
              value={
                resumo.roas === null
                  ? "–"
                  : resumo.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
              }
            />
          </>
        )}
        <StatTile
          icon={CircleHelp}
          tone="warning"
          label="Sem origem"
          value={formatInt(resumo.sem_origem)}
        />
      </StatGrid>
      {resumo.plataforma && (
        <Card title="Como a plataforma de anúncios conta">
          <StatGrid label="Números da plataforma">
            <StatTile label="Impressões" value={formatInt(resumo.plataforma.impressoes)} />
            <StatTile label="Cliques" value={formatInt(resumo.plataforma.cliques)} />
            <StatTile label="Conversas" value={formatInt(resumo.plataforma.conversas)} />
            <StatTile label="Leads" value={formatInt(resumo.plataforma.leads)} />
          </StatGrid>
        </Card>
      )}
      <Card title="Leads por canal">
        <RankBars
          empty="Sem leads no período."
          items={canais.map((canal) => ({
            key: canal.canal,
            label: canal.canal,
            value: canal.leads,
          }))}
        />
      </Card>
      <Card title="Campanhas com mais leads">
        <RankBars
          empty="Nenhuma campanha com leads no período."
          items={campaigns.map((item, index) => ({
            key: `${item.canal}-${index}`,
            label: item.nome ?? "Sem nome",
            value: item.leads,
            detail: `${item.canal} · ${formatInt(item.ganhos)} ganhos`,
          }))}
        />
      </Card>
      <Card title="Fontes (UTM)">
        <RankBars
          empty="Sem UTM registrada no período."
          items={fontes.slice(0, 10).map((item, index) => ({
            key: `${item.fonte}-${index}`,
            label: item.fonte ?? "Não informada",
            value: item.leads,
          }))}
        />
      </Card>
      <Card title="Mensagens mais enviadas">
        <RankBars
          empty="Sem mensagens no período."
          items={(origem.data?.mensagens_iniciais ?? []).slice(0, 10).map((item, index) => ({
            key: String(index),
            label: item.mensagem,
            value: item.entradas,
          }))}
        />
      </Card>
      {pixel.data && (
        <Card title="Pixel da Meta">
          <p className="text-sm">
            Dos últimos {formatInt(pixel.data.total)} eventos: {formatInt(pixel.data.sent)} enviados
            {pixel.data.failed > 0 ? ` e ${formatInt(pixel.data.failed)} com falha` : ""}.
          </p>
        </Card>
      )}
    </div>
  );
}

function PerformaZap({ period }: { period: PeriodKey }) {
  const overview = useOverview(period);
  if (overview.isPending) return <Loading />;
  if (!overview.data) {
    return <SectionError error={overview.error} onRetry={() => void overview.refetch()} />;
  }
  const { summary, rows } = overview.data.zap;
  return (
    <div className="space-y-4">
      <StatGrid label="WhatsApp">
        <StatTile
          icon={Contact}
          tone="primary"
          label="Contatos"
          value={formatInt(summary.contatos)}
        />
        <StatTile
          icon={Target}
          tone="success"
          label="Efetividade"
          value={formatPercent(summary.efetividade)}
        />
        <StatTile
          icon={Send}
          tone="primary"
          label="Abordados"
          value={formatInt(summary.contatei)}
        />
        <StatTile
          icon={MessageCircleHeart}
          tone="success"
          label="Conversas efetivas"
          value={formatInt(summary.efetivas)}
        />
        <StatTile
          icon={MessageCircleWarning}
          tone="warning"
          label="A responder"
          value={formatInt(summary.aResponder)}
        />
        <StatTile
          icon={MessageCircleOff}
          tone="neutral"
          label="Sem retorno"
          value={formatInt(summary.semRetorno)}
        />
        <StatTile
          icon={ArrowUpRight}
          tone="primary"
          label="Mensagens enviadas"
          value={formatInt(summary.mensagensEnviadas)}
        />
        <StatTile
          icon={ArrowDownLeft}
          tone="violet"
          label="Mensagens recebidas"
          value={formatInt(summary.mensagensRecebidas)}
        />
      </StatGrid>
      <Card title="Por WhatsApp">
        <RankBars
          empty="Sem contas WhatsApp com conversas no período."
          items={rows.map((row, index) => ({
            key: `${row.name}-${index}`,
            label: row.name,
            value: row.contatos,
            detail: `${formatInt(row.efetivas)} efetivas · ${formatPercent(row.efetividade)} de efetividade · ${formatInt(row.aResponder)} a responder`,
          }))}
        />
      </Card>
    </div>
  );
}

/** Área do gestor. Só acompanhamento: a configuração continua no painel web. */
export function DashboardsPage() {
  const [params, setParams] = useSearchParams();
  const section = asSection(params.get("secao"));
  const period = asPeriod(params.get("periodo"));
  const go = (next: { secao?: SectionKey; periodo?: PeriodKey }) =>
    setParams({ secao: next.secao ?? section, periodo: next.periodo ?? period }, { replace: true });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 bg-card py-2.5 shadow-card">
        <div
          role="tablist"
          aria-label="Dashboards"
          className="flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]"
        >
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === section}
              onClick={() => go({ secao: item.key })}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3.5 text-sm transition-colors",
                item.key === section
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "bg-muted font-medium text-muted-foreground active:bg-secondary"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {section === "agora" ? (
          <AgoraPage />
        ) : (
          <div className="space-y-4 p-4">
            <PeriodPicker value={period} onChange={(periodo) => go({ periodo })} />
            {section === "comercial" && <Comercial period={period} />}
            {section === "marketing" && <Marketing period={period} />}
            {section === "whatsapp" && <PerformaZap period={period} />}
          </div>
        )}
      </div>
    </div>
  );
}
