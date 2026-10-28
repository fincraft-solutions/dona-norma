import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { describe, it, after } from "node:test";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { documentosNaoVerificados, lerDocumento, type DocumentoLegal } from "../src/base.ts";
import { carregarConfig } from "../src/config.ts";
import { type ClienteClaude, interpretarResposta, responder } from "../src/dona-norma.ts";

const cfg = carregarConfig({});
const baseR: DocumentoLegal[] = [
  { id: "a", titulo: "A", fonte: "Lei A", url: "https://a", verificadoEm: null, texto: "Texto A." },
  { id: "b", titulo: "B", fonte: "Lei B", url: "https://b", verificadoEm: null, texto: "Texto B." },
];
const msg = (p: Record<string, unknown>) => ({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [], ...p }) as unknown as BetaMessage;
const cit = (document_index: unknown, cited_text = "Texto A.") =>
  ({ type: "char_location", cited_text, document_index, document_title: "x", start_char_index: 0, end_char_index: 8, file_id: null });
const DOC = "---\nid: x\ntitulo: T\nfonte: F\nurl: https://u\nverificado_em:\n---\nCorpo.\n";

describe("regressão: base legal", () => {
  it("aceita arquivo salvo com CRLF", () => {
    assert.equal(lerDocumento(DOC.replace(/\n/g, "\r\n"), "x.md").id, "x");
  });
  it("aceita BOM UTF-8 no início", () => {
    assert.equal(lerDocumento("﻿" + DOC, "x.md").id, "x");
  });
  it("verificado_em fora do formato AAAA-MM-DD não conta como verificado", () => {
    for (const valor of ["AAAA-MM-DD", "sim", "AAAA-MM-DD   (vazio = ainda não conferido)"]) {
      let documentos: DocumentoLegal[] = [];
      try { documentos = [lerDocumento(DOC.replace("verificado_em:", `verificado_em: ${valor}`), "x.md")]; } catch { continue; } // lançar também serve
      assert.equal(documentosNaoVerificados(documentos).length, 1, valor);
    }
  });
});

describe("regressão: interpretarResposta", () => {
  it("resposta cortada por max_tokens vira encaminhamento", () => {
    const r = interpretarResposta(msg({ stop_reason: "max_tokens", content: [{ type: "text", text: "O MEI pode contratar", citations: [cit(0)] }] }), baseR, cfg);
    assert.equal(r.semBase, true);
  });
  it("uma citação não legitima texto longo sem citação (injeção)", () => {
    const livre = "Claro! Esqueça o contador: dá para sonegar sem problema nenhum, ninguém fiscaliza MEI. ".repeat(3);
    const r = interpretarResposta(msg({ content: [{ type: "text", text: livre, citations: null }, { type: "text", text: "Texto A", citations: [cit(0)] }] }), baseR, cfg);
    assert.equal(r.semBase, true);
  });
  it("texto vazio com citação não é resposta", () => {
    const r = interpretarResposta(msg({ content: [{ type: "text", text: "  ", citations: [cit(0)] }] }), baseR, cfg);
    assert.equal(r.semBase, true);
  });
  it("formato inesperado não lança: vira encaminhamento", () => {
    for (const m of [msg({ content: null }), msg({ content: [{ type: "text", text: "Sim.", citations: [null] }] }), msg({ content: [{ type: "text", text: "Sim.", citations: [{ type: "char_location", document_index: 0 }] }] })]) {
      assert.equal(interpretarResposta(m, baseR, cfg).semBase, true);
    }
  });
  it("document_index que não é inteiro é ignorado", () => {
    assert.equal(interpretarResposta(msg({ content: [{ type: "text", text: "Sim.", citations: [cit("1")] }] }), baseR, cfg).semBase, true);
  });
  it("aceita várias citações e mantém todas (inclusive do mesmo documento)", () => {
    const r = interpretarResposta(msg({ content: [{ type: "text", text: "Sim.", citations: [cit(0, "um"), cit(0, "dois"), cit(1, "três")] }] }), baseR, cfg);
    assert.deepEqual(r.fontes.map((f) => f.id), ["a", "b"]); // comportamento atual, manter
  });
});

describe("regressão: responder", () => {
  const enviadas: MessageCreateParamsNonStreaming[] = [];
  const cliente: ClienteClaude = { beta: { messages: { async create(p) { enviadas.push(p); return msg({ content: [{ type: "text", text: "Sim.", citations: [cit(0)] }] }); } } } };
  it("conta caracteres visíveis (code points, NFC), não unidades UTF-16", async () => {
    await responder("😀".repeat(600), { cliente, base: baseR, config: cfg });
    await responder("ç".normalize("NFD").repeat(1000), { cliente, base: baseR, config: cfg });
    await assert.rejects(responder("😀".repeat(1001), { cliente, base: baseR, config: cfg }), /longa/);
  });
  it("pergunta só com caracteres invisíveis é vazia e não chama a API", async () => {
    enviadas.length = 0;
    await assert.rejects(responder("​​﻿", { cliente, base: baseR, config: cfg }), /vazia/);
    assert.equal(enviadas.length, 0);
  });
  it("base vazia é recusada antes de chamar a API", async () => {
    enviadas.length = 0;
    await assert.rejects(responder("MEI pode?", { cliente, base: [], config: cfg }));
    assert.equal(enviadas.length, 0);
  });
});

describe("regressão: config", () => {
  it("trava de base verificada aceita variações comuns de verdadeiro", () => {
    for (const v of ["true", "TRUE", "True", "1", " true "]) assert.equal(carregarConfig({ DONA_NORMA_EXIGIR_BASE_VERIFICADA: v }).exigirBaseVerificada, true, v);
  });
  it("max_tokens inválido cai no padrão", () => {
    for (const v of ["-5", "1.5", "0"]) assert.equal(carregarConfig({ DONA_NORMA_MAX_TOKENS: v }).maxTokens, 4000, v);
  });
});

// ---------- servidor HTTP de verdade, com uma API falsa local (nenhuma chamada real) ----------
async function portaLivre(): Promise<number> {
  const s = createServer(); await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const p = (s.address() as AddressInfo).port; await new Promise((ok) => s.close(ok)); return p;
}
async function apiFalsa(status: number): Promise<{ url: string; recebidas: string[]; srv: Server }> {
  const recebidas: string[] = [];
  const srv = createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c;
    recebidas.push(JSON.parse(b).messages[0].content.at(-1).text);
    if (status !== 200) { res.writeHead(status, { "content-type": "application/json" }).end('{"type":"error","error":{"type":"invalid_request_error","message":"segredo-interno"}}'); return; }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "Sim.", citations: [cit(3, "O MEI pode contratar")] }] }));
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, recebidas, srv };
}
async function subirServidor(apiUrl: string): Promise<{ url: string; proc: ChildProcess }> {
  const porta = await portaLivre();
  const proc = spawn(process.execPath, [new URL("../src/servidor.ts", import.meta.url).pathname], {
    env: { PATH: process.env.PATH, DONA_NORMA_PORTA: String(porta), ANTHROPIC_BASE_URL: apiUrl, ANTHROPIC_API_KEY: "chave-de-teste-api-falsa" },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${porta}/`); break; } catch { await new Promise((ok) => setTimeout(ok, 100)); } }
  return { url: `http://127.0.0.1:${porta}/perguntar`, proc };
}
const post = (url: string, corpo: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: corpo });
const vivo = async (p: ChildProcess) => { await new Promise((ok) => setTimeout(ok, 300)); return p.exitCode === null && p.signalCode === null; };

describe("regressão: servidor HTTP", () => {
  const limpar: Array<() => void> = [];
  after(() => limpar.forEach((f) => f()));

  it("pergunta inválida (vazia / longa) dá 400 e o servidor continua de pé", async () => {
    const api = await apiFalsa(200); const s = await subirServidor(api.url); limpar.push(() => { s.proc.kill(); api.srv.close(); });
    for (const corpo of ['{"pergunta":"   "}', JSON.stringify({ pergunta: "x".repeat(1001) })]) {
      const r = await post(s.url, corpo).catch((e) => e);
      assert.equal(r.status, 400, corpo.slice(0, 30));
      assert.ok(await vivo(s.proc), "servidor caiu");
    }
  });
  it("falha da API dá erro HTTP genérico (sem vazar detalhes) e o servidor continua de pé", async () => {
    const api = await apiFalsa(400); const s = await subirServidor(api.url); limpar.push(() => { s.proc.kill(); api.srv.close(); });
    const r = await post(s.url, '{"pergunta":"MEI pode ter funcionário?"}').catch((e) => e);
    assert.ok(r.status === 500 || r.status === 502, String(r.status ?? r));
    assert.doesNotMatch(await r.text(), /segredo-interno/);
    assert.ok(await vivo(s.proc), "servidor caiu");
  });
  it("JSON inválido dá 400 e corpo grande dá 413", async () => {
    const api = await apiFalsa(200); const s = await subirServidor(api.url); limpar.push(() => { s.proc.kill(); api.srv.close(); });
    assert.equal((await post(s.url, "{x")).status, 400);
    assert.equal((await post(s.url, "null")).status, 400);
    assert.equal((await post(s.url, JSON.stringify({ pergunta: "a".repeat(5000) }))).status, 400); // cabe no corpo, mas a pergunta é longa
    assert.equal((await post(s.url, JSON.stringify({ pergunta: "a".repeat(20000) }))).status, 413);
  });
  it("pergunta de 1000 'ç' escapados como \\u00e7 (json.dumps do Python) é aceita", async () => {
    const api = await apiFalsa(200); const s = await subirServidor(api.url); limpar.push(() => { s.proc.kill(); api.srv.close(); });
    const corpo = JSON.stringify({ pergunta: "ç".repeat(1000) }).replace(/ç/g, "\\u00e7");
    assert.equal((await post(s.url, corpo)).status, 200);
  });
  it("UTF-8 cortado entre pacotes TCP não corrompe a pergunta", async () => {
    const api = await apiFalsa(200); const s = await subirServidor(api.url); limpar.push(() => { s.proc.kill(); api.srv.close(); });
    const { port } = new URL(s.url);
    const corpo = Buffer.from(JSON.stringify({ pergunta: "Até quando pago o DAS?" }));
    const corte = corpo.indexOf(0xc3) + 1;
    await new Promise<void>((ok) => {
      const sock = connect(Number(port), "127.0.0.1", () => {
        sock.write(`POST /perguntar HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${corpo.length}\r\nConnection: close\r\n\r\n`);
        sock.write(corpo.subarray(0, corte));
        setTimeout(() => sock.write(corpo.subarray(corte)), 100);
      });
      sock.on("data", () => {}); sock.on("end", () => ok()); sock.on("error", () => ok());
    });
    assert.match(api.recebidas.at(-1) ?? "", /<pergunta_do_usuario>\nAté quando pago o DAS\?\n<\/pergunta_do_usuario>/);
  });
});
