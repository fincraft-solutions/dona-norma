import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { carregarBase } from "./base.ts";

// Monta a skill portátil da Dona Norma (padrão Agent Skills: pasta com SKILL.md e references/)
// a partir de skill/SKILL.md e da base-legal/, e gera dist/dona-norma.zip para Claude.ai, Codex, Gemini CLI etc.
const raiz = new URL("../", import.meta.url);
const dist = fileURLToPath(new URL("dist/", raiz));
const pasta = `${dist}dona-norma/`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(`${pasta}references`, { recursive: true });

const base = carregarBase();
for (const documento of base) {
  const cabecalho = [
    `# ${documento.titulo}`,
    "",
    `**Fonte:** ${documento.fonte}`,
    `**Link:** ${documento.url}`,
    `**Verificado em:** ${documento.verificadoEm ?? "ainda não verificado"}`,
    "",
  ];
  writeFileSync(`${pasta}references/${documento.id}.md`, `${cabecalho.join("\n")}${documento.texto}\n`);
}

const indice = base.map((documento) => `- \`references/${documento.id}.md\`: ${documento.titulo} (${documento.fonte})`).join("\n");
const skill = readFileSync(new URL("skill/SKILL.md", raiz), "utf8").trimEnd();
writeFileSync(`${pasta}SKILL.md`, `${skill}\n\n## Índice da base legal\n\n${indice}\n`);

// O ZIP precisa ter a pasta da skill no topo (dona-norma/SKILL.md), como exige o Claude.ai.
execFileSync("zip", ["-qr", "dona-norma.zip", "dona-norma"], { cwd: dist });

const pendentes = base.filter((documento) => !documento.verificadoEm).length;
console.log(`Skill gerada em dist/dona-norma/ e dist/dona-norma.zip (${base.length} documentos).`);
if (pendentes > 0) console.warn(`Aviso: ${pendentes} documento(s) ainda não verificados. Confira antes de distribuir.`);
