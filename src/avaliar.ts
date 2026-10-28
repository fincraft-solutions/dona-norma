import { readFileSync } from "node:fs";
import { responder } from "./dona-norma.ts";
import { iniciar } from "./iniciar.ts";

interface CasoDeTeste {
  pergunta: string;
  /** id do documento que deve ser citado, ou null quando a resposta certa é "procure um contador". */
  fonteEsperada: string | null;
}

// Cada caso faz uma chamada paga à API. Exige --confirmar para não rodar por engano.
if (!process.argv.includes("--confirmar")) {
  console.error("Isto chama a API uma vez por pergunta (custo real). Rode: npm run avaliar -- --confirmar");
  process.exit(1);
}

const casos = JSON.parse(readFileSync(new URL("../avaliacao/perguntas.json", import.meta.url), "utf8")) as CasoDeTeste[];
const donaNorma = iniciar();

let acertos = 0;
let falhas = 0;
for (const caso of casos) {
  // Um erro da API num caso não derruba a rodada: conta como erro e segue para o placar.
  try {
    const resposta = await responder(caso.pergunta, donaNorma);
    const citadas = resposta.fontes.map((fonte) => fonte.id);
    const acertou = caso.fonteEsperada === null ? resposta.semBase : citadas.includes(caso.fonteEsperada);
    if (acertou) acertos += 1;
    console.log(`${acertou ? "OK  " : "ERRO"} ${caso.pergunta}`);
    if (!acertou) console.log(`     esperado: ${caso.fonteEsperada ?? "sem base"} | citou: ${citadas.join(", ") || "nada"}`);
  } catch (erro) {
    falhas += 1;
    console.log(`FALHA ${caso.pergunta}\n     ${((erro as Error)?.message ?? String(erro)).split("\n")[0]}`);
  }
}

console.log(`\n${acertos}/${casos.length} corretas (${Math.round((acertos / casos.length) * 100)}%)${falhas ? `, ${falhas} com falha de chamada` : ""}.`);
if (falhas > 0) process.exitCode = 1;
