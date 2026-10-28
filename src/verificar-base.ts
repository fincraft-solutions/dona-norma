import { carregarBase, documentosNaoVerificados } from "./base.ts";

// Lista a base legal e o status de verificação. Com --estrito, sai com erro se houver pendência (útil no CI).
const base = carregarBase();
for (const documento of base) {
  const status = documento.verificadoEm ? `verificado em ${documento.verificadoEm}` : "NÃO VERIFICADO";
  console.log(`${documento.id.padEnd(32)} ${documento.fonte.padEnd(40)} ${status}`);
}

const pendentes = documentosNaoVerificados(base);
console.log(`\n${base.length} documento(s), ${pendentes.length} pendente(s) de verificação.`);
if (pendentes.length > 0 && process.argv.includes("--estrito")) process.exit(1);
