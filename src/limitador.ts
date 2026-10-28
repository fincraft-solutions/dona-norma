import { isIPv6 } from "node:net";

export interface OpcoesLimitador {
  maxPorJanela: number;
  janelaMs: number;
  /** Teto de clientes guardados em memória; acima dele, os mais antigos saem. */
  maxEntradas: number;
  /** Relógio injetável para os testes. */
  agora?: () => number;
}

export interface Limitador {
  /** Conta um uso e diz se ainda está dentro do limite. */
  permitir(chave: string): boolean;
  /** Remove janelas expiradas. Também roda sozinho dentro de `permitir`. */
  limpar(): void;
  tamanho(): number;
}

/** Limite por janela fixa, em memória. Serve para um processo só; com várias instâncias, use Redis ou o banco. */
export function criarLimitador({ maxPorJanela, janelaMs, maxEntradas, agora = Date.now }: OpcoesLimitador): Limitador {
  // Map preserva a ordem de inserção: o primeiro é o mais antigo (útil para o teto de entradas).
  const uso = new Map<string, { inicio: number; total: number }>();
  let ultimaLimpeza = agora();

  function limpar() {
    const instante = agora();
    for (const [chave, registro] of uso) {
      if (instante - registro.inicio >= janelaMs) uso.delete(chave);
    }
    ultimaLimpeza = instante;
  }

  return {
    permitir(chave) {
      const instante = agora();
      if (instante - ultimaLimpeza >= janelaMs) limpar();

      const registro = uso.get(chave);
      if (!registro || instante - registro.inicio >= janelaMs) {
        uso.delete(chave);
        uso.set(chave, { inicio: instante, total: 1 });
        while (uso.size > maxEntradas) uso.delete(uso.keys().next().value as string);
        return true;
      }
      registro.total += 1;
      return registro.total <= maxPorJanela;
    },
    limpar,
    tamanho: () => uso.size,
  };
}

/** Agrupa IPv6 pelo prefixo /64 (um cliente costuma ter o /64 inteiro); IPv4 fica como está. */
export function chaveDoCliente(ip: string): string {
  const semPrefixo = ip.replace(/^::ffff:/i, "");
  if (!isIPv6(semPrefixo)) return semPrefixo;

  // Expande "::" para obter os 8 grupos e fica com os 4 primeiros.
  const [esquerda, direita = ""] = semPrefixo.split("::");
  const gruposEsquerda = esquerda ? esquerda.split(":") : [];
  const gruposDireita = direita ? direita.split(":") : [];
  const zeros = Array(8 - gruposEsquerda.length - gruposDireita.length).fill("0");
  const grupos = semPrefixo.includes("::") ? [...gruposEsquerda, ...zeros, ...gruposDireita] : semPrefixo.split(":");
  return `${grupos.slice(0, 4).map((grupo) => grupo.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * IP do cliente. Atrás de proxy (nginx, Vercel, Cloudflare) todos chegam com o IP do proxy;
 * com `confiarProxy`, usa o último endereço de X-Forwarded-For, que é o que o proxy viu.
 */
export function ipDoCliente(enderecoSocket: string | undefined, xForwardedFor: string | string[] | undefined, confiarProxy: boolean): string {
  if (confiarProxy && xForwardedFor) {
    const cabecalho = Array.isArray(xForwardedFor) ? xForwardedFor.join(",") : xForwardedFor;
    const ultimo = cabecalho.split(",").map((parte) => parte.trim()).filter(Boolean).at(-1);
    if (ultimo) return ultimo;
  }
  return enderecoSocket ?? "desconhecido";
}
