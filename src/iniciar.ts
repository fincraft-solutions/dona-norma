import Anthropic from "@anthropic-ai/sdk";
import { carregarBase, documentosNaoVerificados, type DocumentoLegal } from "./base.ts";
import { carregarConfig, type ConfigDonaNorma } from "./config.ts";
import type { ClienteClaude } from "./dona-norma.ts";

export interface DonaNormaPronta {
  cliente: ClienteClaude;
  base: DocumentoLegal[];
  config: ConfigDonaNorma;
}

/** Junta configuração, base legal e cliente da API, aplicando a trava de base verificada. */
export function iniciar(): DonaNormaPronta {
  const config = carregarConfig();
  const base = carregarBase();

  const pendentes = documentosNaoVerificados(base);
  if (pendentes.length > 0) {
    const lista = pendentes.map((documento) => documento.id).join(", ");
    if (config.exigirBaseVerificada) {
      throw new Error(`Base legal com documentos não verificados: ${lista}. Rode a skill atualizar-base-legal.`);
    }
    console.warn(`Aviso: ${pendentes.length} documento(s) da base ainda não verificados (${lista}).`);
  }

  return { cliente: new Anthropic(), base, config };
}
