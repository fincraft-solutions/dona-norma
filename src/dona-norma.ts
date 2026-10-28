import { readFileSync } from "node:fs";
import type {
  BetaContentBlockParam,
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { DocumentoLegal } from "./base.ts";
import { type ConfigDonaNorma, suportaFallback } from "./config.ts";

export const PROMPT_SISTEMA = readFileSync(new URL("../prompts/sistema.md", import.meta.url), "utf8");

/** Em caracteres visíveis (code points depois de normalizar), não em unidades UTF-16. */
export const TAMANHO_MAXIMO_PERGUNTA = 1000;

/** Erro de validação da pergunta: culpa de quem perguntou, vira HTTP 400. */
export class ErroDePergunta extends Error {
  override name = "ErroDePergunta";
}

/** O mínimo do SDK que a Dona Norma usa; nos testes entra um cliente falso. */
export interface ClienteClaude {
  beta: {
    messages: {
      create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage>;
    };
  };
}

export interface FonteCitada {
  id: string;
  fonte: string;
  url: string;
  trecho: string;
}

export interface Resposta {
  texto: string;
  fontes: FonteCitada[];
  /** true quando a Dona Norma não achou base legal: o texto é o encaminhamento ao contador. */
  semBase: boolean;
  modelo: string;
}

export function mensagemSemBase(config: ConfigDonaNorma): string {
  return (
    "Não encontrei base oficial para responder isso com segurança. " +
    "O melhor caminho é conversar com um contador. " +
    `Se quiser, o Wavern conecta você a um: ${config.ctaUrl}`
  );
}

/** Normaliza (NFC), tira caracteres invisíveis e valida o tamanho. */
export function limparPergunta(pergunta: string): string {
  const limpa = pergunta.normalize("NFC").replace(/\p{Cf}/gu, "").trim();
  if (!limpa) throw new ErroDePergunta("Pergunta vazia.");
  if ([...limpa].length > TAMANHO_MAXIMO_PERGUNTA) {
    throw new ErroDePergunta(`Pergunta muito longa (máximo de ${TAMANHO_MAXIMO_PERGUNTA} caracteres).`);
  }
  // Impede que a pergunta feche a própria tag e escreva fora dela.
  return limpa.replace(/<\/?\s*pergunta_do_usuario\s*>/gi, "");
}

export function montarRequisicao(
  pergunta: string,
  base: DocumentoLegal[],
  config: ConfigDonaNorma,
): MessageCreateParamsNonStreaming {
  const documentos: BetaContentBlockParam[] = base.map((documento, indice) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: documento.texto },
    title: documento.fonte,
    context: documento.titulo,
    citations: { enabled: true },
    // A base é igual em toda pergunta: o cache no último documento reaproveita o prefixo inteiro.
    ...(indice === base.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  const requisicao: MessageCreateParamsNonStreaming = {
    model: config.modelo,
    max_tokens: config.maxTokens,
    output_config: { effort: config.esforco },
    system: PROMPT_SISTEMA,
    messages: [
      {
        role: "user",
        content: [...documentos, { type: "text", text: `<pergunta_do_usuario>\n${pergunta}\n</pergunta_do_usuario>` }],
      },
    ],
  };

  if (suportaFallback(config.modelo)) {
    requisicao.betas = ["server-side-fallback-2026-07-01"];
    requisicao.fallbacks = "default";
  }
  return requisicao;
}

const semEspacos = (texto: string) => texto.replace(/\s/g, "").length;

/**
 * Só aceita resposta completa (end_turn), com texto e com citações da base cobrindo boa parte dele.
 * Formatos inesperados nunca lançam: viram encaminhamento ao contador.
 */
export function interpretarResposta(
  mensagem: BetaMessage,
  base: DocumentoLegal[],
  config: ConfigDonaNorma,
): Resposta {
  const modelo = typeof mensagem?.model === "string" ? mensagem.model : config.modelo;
  const semBase: Resposta = { texto: mensagemSemBase(config), fontes: [], semBase: true, modelo };

  // refusal, max_tokens (resposta cortada), pause_turn etc.: nada disso sai como resposta oficial.
  if (mensagem?.stop_reason !== "end_turn" || !Array.isArray(mensagem.content)) return semBase;

  let texto = "";
  let caracteresCitados = 0;
  const fontes = new Map<string, FonteCitada>();
  for (const bloco of mensagem.content) {
    if (bloco?.type !== "text" || typeof bloco.text !== "string") continue;
    texto += bloco.text;

    let blocoCitado = false;
    for (const citacao of Array.isArray(bloco.citations) ? bloco.citations : []) {
      if (citacao?.type !== "char_location" || !Number.isInteger(citacao.document_index)) continue;
      const documento = base[citacao.document_index];
      if (!documento || typeof citacao.cited_text !== "string" || !citacao.cited_text.trim()) continue;
      blocoCitado = true;
      if (!fontes.has(documento.id)) {
        fontes.set(documento.id, { id: documento.id, fonte: documento.fonte, url: documento.url, trecho: citacao.cited_text.trim() });
      }
    }
    if (blocoCitado) caracteresCitados += semEspacos(bloco.text);
  }

  // Regra central da vitrine: sem citação, ou com citação cobrindo pouco do texto
  // (uma citação solta "carimbando" texto livre), não há resposta. Calibre com `npm run avaliar`.
  const total = semEspacos(texto);
  if (fontes.size === 0 || total === 0 || caracteresCitados / total < config.coberturaMinima) return semBase;

  return { texto: texto.trim(), fontes: [...fontes.values()], semBase: false, modelo };
}

export async function responder(
  pergunta: string,
  dependencias: { cliente: ClienteClaude; base: DocumentoLegal[]; config: ConfigDonaNorma },
): Promise<Resposta> {
  const { cliente, base, config } = dependencias;
  const limpa = limparPergunta(pergunta);
  if (base.length === 0) throw new Error("Base legal vazia: nada para citar.");

  const mensagem = await cliente.beta.messages.create(montarRequisicao(limpa, base, config));
  return interpretarResposta(mensagem, base, config);
}

export function formatarParaTerminal(resposta: Resposta): string {
  if (resposta.semBase) return resposta.texto;
  const fontes = resposta.fontes.map((fonte) => `  • ${fonte.fonte} — ${fonte.url}`).join("\n");
  return `${resposta.texto}\n\nFontes:\n${fontes}`;
}
