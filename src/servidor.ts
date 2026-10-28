import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { lerBooleano, lerInteiroPositivo, temCredencial } from "./config.ts";
import { ErroDePergunta, limparPergunta, responder } from "./dona-norma.ts";
import { iniciar } from "./iniciar.ts";
import { chaveDoCliente, criarLimitador, ipDoCliente } from "./limitador.ts";

// API mínima para embutir a Dona Norma no site: POST /perguntar {"pergunta": "..."}.
const donaNorma = iniciar();
const porta = lerInteiroPositivo(process.env.DONA_NORMA_PORTA, 8787);
const origens = (process.env.DONA_NORMA_CORS_ORIGEM || "https://wavern.com.br")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);
const confiarProxy = lerBooleano(process.env.DONA_NORMA_CONFIAR_PROXY);
const limitador = criarLimitador({
  maxPorJanela: lerInteiroPositivo(process.env.DONA_NORMA_LIMITE_POR_HORA, 20),
  janelaMs: 3_600_000,
  maxEntradas: 50_000,
});

/** Corpo acima disto é recusado com 413 sem ser lido. A pergunta em si é limitada em `limparPergunta`. */
const MAXIMO_BYTES_CORPO = 16 * 1024;

class CorpoGrandeDemais extends Error {}

if (!temCredencial()) {
  console.warn("Aviso: sem ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN. Toda pergunta válida vai falhar com 502 até configurar o .env.");
}

/** Junta os pacotes em bytes e decodifica no fim: um caractere UTF-8 partido entre pacotes não se corrompe. */
async function lerCorpo(requisicao: IncomingMessage): Promise<string> {
  const declarado = Number(requisicao.headers["content-length"]);
  if (Number.isFinite(declarado) && declarado > MAXIMO_BYTES_CORPO) throw new CorpoGrandeDemais();

  const partes: Buffer[] = [];
  let total = 0;
  for await (const pedaco of requisicao) {
    total += (pedaco as Buffer).length;
    if (total > MAXIMO_BYTES_CORPO) throw new CorpoGrandeDemais();
    partes.push(pedaco as Buffer);
  }
  return Buffer.concat(partes).toString("utf8");
}

function responderJson(resposta: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  if (resposta.headersSent) return;
  resposta.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...cabecalhos }).end(JSON.stringify(corpo));
}

function aplicarCors(requisicao: IncomingMessage, resposta: ServerResponse) {
  resposta.setHeader("Vary", "Origin");
  const origem = requisicao.headers.origin;
  const permitida = origens.includes("*") ? "*" : origem && origens.includes(origem) ? origem : undefined;
  if (!permitida) return;
  resposta.setHeader("Access-Control-Allow-Origin", permitida);
  resposta.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  resposta.setHeader("Access-Control-Allow-Headers", "Content-Type");
  resposta.setHeader("Access-Control-Max-Age", "86400");
}

async function atender(requisicao: IncomingMessage, resposta: ServerResponse) {
  aplicarCors(requisicao, resposta);
  const caminho = new URL(requisicao.url ?? "/", "http://localhost").pathname;

  if (caminho !== "/perguntar") return responderJson(resposta, 404, { erro: "Use POST /perguntar." });
  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204).end();
    return;
  }
  if (requisicao.method !== "POST") return responderJson(resposta, 405, { erro: "Use POST /perguntar." }, { Allow: "POST, OPTIONS" });

  let pergunta: string;
  try {
    const dados: unknown = JSON.parse(await lerCorpo(requisicao));
    const valor = typeof dados === "object" && dados !== null ? (dados as { pergunta?: unknown }).pergunta : undefined;
    if (typeof valor !== "string") return responderJson(resposta, 400, { erro: 'Envie {"pergunta": "..."}.' });
    pergunta = valor;
    limparPergunta(pergunta);
  } catch (erro) {
    if (erro instanceof CorpoGrandeDemais) return responderJson(resposta, 413, { erro: "Corpo grande demais." }, { Connection: "close" });
    if (erro instanceof ErroDePergunta) return responderJson(resposta, 400, { erro: erro.message });
    return responderJson(resposta, 400, { erro: "JSON inválido." });
  }

  // Só conta no limite o que de fato vai custar uma chamada à API.
  const cliente = chaveDoCliente(ipDoCliente(requisicao.socket.remoteAddress, requisicao.headers["x-forwarded-for"], confiarProxy));
  if (!limitador.permitir(cliente)) return responderJson(resposta, 429, { erro: "Limite de perguntas por hora atingido." });

  try {
    // A resposta é calculada antes de escrever qualquer cabeçalho: um erro aqui ainda vira um status HTTP.
    const dados = await responder(pergunta, donaNorma);
    responderJson(resposta, 200, dados);
  } catch (erro) {
    if (erro instanceof ErroDePergunta) return responderJson(resposta, 400, { erro: erro.message });
    console.error(erro);
    const daApi = erro instanceof Anthropic.APIError || /authentication/i.test((erro as Error)?.message ?? "");
    responderJson(resposta, daApi ? 502 : 500, { erro: "Não consegui responder agora. Tente de novo." });
  }
}

createServer((requisicao, resposta) => {
  atender(requisicao, resposta).catch((erro) => {
    console.error(erro);
    responderJson(resposta, 500, { erro: "Não consegui responder agora. Tente de novo." });
  });
}).listen(porta, () => console.log(`Dona Norma ouvindo em http://localhost:${porta}/perguntar`));
