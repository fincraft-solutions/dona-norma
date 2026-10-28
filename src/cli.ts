import { temCredencial } from "./config.ts";
import { ErroDePergunta, formatarParaTerminal, responder } from "./dona-norma.ts";
import { iniciar } from "./iniciar.ts";

const pergunta = process.argv.slice(2).join(" ");
if (!pergunta.trim()) {
  console.error('Uso: npm run perguntar -- "MEI pode ter funcionário?"');
  process.exit(1);
}

if (!temCredencial()) {
  console.error("Falta a chave da API. Copie .env.example para .env e preencha ANTHROPIC_API_KEY.");
  process.exit(2);
}

try {
  const resposta = await responder(pergunta, iniciar());
  console.log(formatarParaTerminal(resposta));
} catch (erro) {
  if (erro instanceof ErroDePergunta) {
    console.error(erro.message);
    process.exit(1);
  }
  const mensagem = (erro as Error)?.message ?? String(erro);
  if (/authentication|401|invalid x-api-key/i.test(mensagem)) {
    console.error("A API recusou a credencial. Confira ANTHROPIC_API_KEY no .env.");
    process.exit(2);
  }
  console.error(`Não consegui responder: ${mensagem.split("\n")[0]}`);
  process.exit(1);
}
