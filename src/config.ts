export type Esforco = "low" | "medium" | "high" | "xhigh" | "max";

export interface ConfigDonaNorma {
  modelo: string;
  esforco: Esforco;
  maxTokens: number;
  ctaUrl: string;
  exigirBaseVerificada: boolean;
  /** Fração mínima do texto da resposta coberta por citações (0 a 1). */
  coberturaMinima: number;
}

// Modelos que aceitam `fallbacks: "default"` (refaz no servidor uma resposta recusada pelos filtros de segurança).
const MODELOS_COM_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
const ESFORCOS: Esforco[] = ["low", "medium", "high", "xhigh", "max"];

export function suportaFallback(modelo: string): boolean {
  return MODELOS_COM_FALLBACK.has(modelo);
}

/** true, 1, sim ou yes, sem diferenciar maiúsculas. Qualquer outro valor é falso. */
export function lerBooleano(valor: string | undefined): boolean {
  return /^(true|1|sim|yes)$/i.test((valor ?? "").trim());
}

/** Número entre 0 e 1; senão, o padrão. */
export function lerFracao(valor: string | undefined, padrao: number): number {
  const texto = (valor ?? "").trim();
  const numero = Number(texto);
  return texto !== "" && Number.isFinite(numero) && numero >= 0 && numero <= 1 ? numero : padrao;
}

/** Inteiro maior que zero; senão, o padrão. */
export function lerInteiroPositivo(valor: string | undefined, padrao: number): number {
  const numero = Number((valor ?? "").trim());
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

function lerEsforco(valor: string | undefined): Esforco {
  const normalizado = (valor ?? "").trim().toLowerCase();
  if (!normalizado) return "low";
  if ((ESFORCOS as string[]).includes(normalizado)) return normalizado as Esforco;
  console.warn(`DONA_NORMA_ESFORCO inválido (${valor}); usando low.`);
  return "low";
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): ConfigDonaNorma {
  return {
    modelo: env.DONA_NORMA_MODELO?.trim() || "claude-opus-5-5",
    esforco: lerEsforco(env.DONA_NORMA_ESFORCO),
    maxTokens: lerInteiroPositivo(env.DONA_NORMA_MAX_TOKENS, 4000),
    ctaUrl: env.DONA_NORMA_CTA_URL?.trim() || "https://wavern.com.br",
    exigirBaseVerificada: lerBooleano(env.DONA_NORMA_EXIGIR_BASE_VERIFICADA),
    coberturaMinima: lerFracao(env.DONA_NORMA_COBERTURA_MINIMA, 0.35),
  };
}

/** Há alguma credencial da API no ambiente? (O SDK também lê perfis do `ant auth login`.) */
export function temCredencial(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim() || env.ANTHROPIC_PROFILE?.trim());
}
