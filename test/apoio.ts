// Apoio aos testes do servidor: porta livre, API falsa local e servidor real em processo filho. Nunca chama a API real.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export async function portaLivre(): Promise<number> {
  const servidor = createServer();
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  await new Promise((pronto) => servidor.close(pronto));
  return porta;
}

/** API falsa que responde sempre "Sim." citando o documento 3 da base. */
export async function apiFalsa(): Promise<{ url: string; chamadas: () => number; servidor: Server }> {
  let chamadas = 0;
  const servidor = createServer(async (requisicao, resposta) => {
    for await (const _ of requisicao);
    chamadas += 1;
    const citacao = { type: "char_location", cited_text: "O MEI pode contratar", document_index: 3, document_title: "x", start_char_index: 0, end_char_index: 20, file_id: null };
    resposta.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "Sim.", citations: [citacao] }],
      }),
    );
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  return { url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`, chamadas: () => chamadas, servidor };
}

export async function subirServidor(env: Record<string, string>): Promise<{ url: string; processo: ChildProcess }> {
  const porta = await portaLivre();
  const processo = spawn(process.execPath, [new URL("../src/servidor.ts", import.meta.url).pathname], {
    env: { PATH: process.env.PATH ?? "", DONA_NORMA_PORTA: String(porta), ...env },
    stdio: "ignore",
  });
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    try {
      await fetch(`http://127.0.0.1:${porta}/`);
      break;
    } catch {
      await new Promise((pronto) => setTimeout(pronto, 100));
    }
  }
  return { url: `http://127.0.0.1:${porta}/perguntar`, processo };
}

export const postar = (url: string, corpo: string, cabecalhos: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...cabecalhos }, body: corpo });
