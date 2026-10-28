import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DocumentoLegal {
  id: string;
  titulo: string;
  fonte: string;
  url: string;
  /** Data (AAAA-MM-DD) em que alguém conferiu o texto contra a fonte oficial. Vazio = não verificado. */
  verificadoEm: string | null;
  texto: string;
}

export const PASTA_BASE_PADRAO = fileURLToPath(new URL("../base-legal/", import.meta.url));

/** Data AAAA-MM-DD que existe no calendário e não está no futuro. */
function dataDeVerificacao(valor: string, nomeArquivo: string, hoje: string): string {
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const valida =
    /^\d{4}-\d{2}-\d{2}$/.test(valor) && data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  if (!valida) throw new Error(`${nomeArquivo}: verificado_em inválido (${valor}); use AAAA-MM-DD ou deixe vazio`);
  if (valor > hoje) throw new Error(`${nomeArquivo}: verificado_em no futuro (${valor})`);
  return valor;
}

/** Lê um arquivo .md com cabeçalho `---` de pares chave: valor. Tolera BOM, CRLF e linhas em branco no início. */
export function lerDocumento(conteudo: string, nomeArquivo: string, hoje = new Date().toISOString().slice(0, 10)): DocumentoLegal {
  const normalizado = conteudo.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/^\s*\n/, "");
  const partes = normalizado.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!partes) throw new Error(`${nomeArquivo}: cabeçalho --- ausente`);

  const campos: Record<string, string> = {};
  for (const linha of partes[1].split("\n")) {
    const separador = linha.indexOf(":");
    if (separador === -1) continue;
    campos[linha.slice(0, separador).trim()] = linha.slice(separador + 1).trim();
  }

  for (const obrigatorio of ["id", "titulo", "fonte", "url"]) {
    if (!campos[obrigatorio]) throw new Error(`${nomeArquivo}: campo "${obrigatorio}" ausente`);
  }

  const texto = partes[2].trim();
  if (!texto) throw new Error(`${nomeArquivo}: texto vazio`);

  return {
    id: campos.id,
    titulo: campos.titulo,
    fonte: campos.fonte,
    url: campos.url,
    verificadoEm: campos.verificado_em ? dataDeVerificacao(campos.verificado_em, nomeArquivo, hoje) : null,
    texto,
  };
}

/** Carrega a base em ordem alfabética de arquivo, para que o prefixo da requisição (e o cache) seja estável. */
export function carregarBase(pasta: string = PASTA_BASE_PADRAO): DocumentoLegal[] {
  const arquivos = readdirSync(pasta, { withFileTypes: true })
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".md") && !entrada.name.startsWith("_"))
    .map((entrada) => entrada.name)
    .sort();

  const documentos = arquivos.map((nome) => lerDocumento(readFileSync(join(pasta, nome), "utf8"), nome));
  if (documentos.length === 0) throw new Error(`Base legal vazia: nenhum documento .md em ${pasta}`);

  const ids = new Set<string>();
  for (const documento of documentos) {
    if (ids.has(documento.id)) throw new Error(`id duplicado na base: ${documento.id}`);
    ids.add(documento.id);
  }
  return documentos;
}

export function documentosNaoVerificados(base: DocumentoLegal[]): DocumentoLegal[] {
  return base.filter((documento) => !documento.verificadoEm);
}
