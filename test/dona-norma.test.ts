import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { carregarBase, lerDocumento, type DocumentoLegal } from "../src/base.ts";
import { carregarConfig } from "../src/config.ts";
import { type ClienteClaude, montarRequisicao, responder } from "../src/dona-norma.ts";

const config = carregarConfig({});

const base: DocumentoLegal[] = [
  { id: "a", titulo: "A", fonte: "Lei A, art. 1º", url: "https://a", verificadoEm: null, texto: "Texto A." },
  { id: "b", titulo: "B", fonte: "Lei B, art. 2º", url: "https://b", verificadoEm: "2026-10-01", texto: "Texto B." },
];

function mensagem(parcial: Partial<BetaMessage>): BetaMessage {
  return { model: "claude-opus-5-5", stop_reason: "end_turn", content: [], ...parcial } as BetaMessage;
}

function clienteQueDevolve(resposta: BetaMessage, enviadas: MessageCreateParamsNonStreaming[] = []): ClienteClaude {
  return {
    beta: {
      messages: {
        async create(params) {
          enviadas.push(params);
          return resposta;
        },
      },
    },
  };
}

describe("base legal", () => {
  it("lê cabeçalho e texto", () => {
    const documento = lerDocumento("---\nid: x\ntitulo: T\nfonte: F\nurl: https://u\nverificado_em:\n---\nCorpo.\n", "x.md");
    assert.equal(documento.id, "x");
    assert.equal(documento.verificadoEm, null);
    assert.equal(documento.texto, "Corpo.");
  });

  it("recusa documento sem fonte", () => {
    assert.throws(() => lerDocumento("---\nid: x\ntitulo: T\nurl: u\n---\nCorpo.", "x.md"), /fonte/);
  });

  it("carrega a base do repositório sem erro e com ids únicos", () => {
    const real = carregarBase();
    assert.ok(real.length >= 10);
  });
});

describe("requisição", () => {
  it("envia um documento citável por item da base e cacheia só o último", () => {
    const requisicao = montarRequisicao("Pergunta?", base, config);
    const conteudo = requisicao.messages[0].content as unknown as Array<Record<string, unknown>>;
    assert.equal(conteudo.length, 3);
    assert.deepEqual(conteudo[0].citations, { enabled: true });
    assert.equal(conteudo[0].cache_control, undefined);
    assert.deepEqual(conteudo[1].cache_control, { type: "ephemeral" });
    assert.equal(conteudo[2].type, "text");
  });

  it("liga o fallback só nos modelos que aceitam", () => {
    assert.equal(montarRequisicao("?", base, config).fallbacks, "default");
    const haiku = montarRequisicao("?", base, { ...config, modelo: "claude-haiku-5-5" });
    assert.equal(haiku.fallbacks, undefined);
    assert.equal(haiku.betas, undefined);
  });
});

describe("resposta", () => {
  it("devolve texto e fontes citadas", async () => {
    const cliente = clienteQueDevolve(
      mensagem({
        content: [
          {
            type: "text",
            text: "Sim.",
            citations: [
              {
                type: "char_location",
                cited_text: "Texto B.",
                document_index: 1,
                document_title: "Lei B, art. 2º",
                start_char_index: 0,
                end_char_index: 8,
                file_id: null,
              },
            ],
          },
        ],
      } as Partial<BetaMessage>),
    );
    const resposta = await responder("MEI pode?", { cliente, base, config });
    assert.equal(resposta.semBase, false);
    assert.equal(resposta.texto, "Sim.");
    assert.deepEqual(resposta.fontes.map((fonte) => fonte.id), ["b"]);
  });

  it("sem citação, troca a resposta pelo encaminhamento ao contador", async () => {
    const cliente = clienteQueDevolve(
      mensagem({ content: [{ type: "text", text: "Acho que sim.", citations: null }] } as Partial<BetaMessage>),
    );
    const resposta = await responder("Pergunta fora da base", { cliente, base, config });
    assert.equal(resposta.semBase, true);
    assert.match(resposta.texto, /contador/);
  });

  it("trata recusa do modelo como sem base", async () => {
    const cliente = clienteQueDevolve(mensagem({ stop_reason: "refusal" }));
    const resposta = await responder("?", { cliente, base, config });
    assert.equal(resposta.semBase, true);
  });

  it("valida a pergunta antes de chamar a API", async () => {
    const enviadas: MessageCreateParamsNonStreaming[] = [];
    const cliente = clienteQueDevolve(mensagem({}), enviadas);
    await assert.rejects(responder("   ", { cliente, base, config }), /vazia/);
    await assert.rejects(responder("x".repeat(1001), { cliente, base, config }), /longa/);
    assert.equal(enviadas.length, 0);
  });
});
