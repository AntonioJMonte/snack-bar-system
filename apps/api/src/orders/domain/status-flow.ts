// Fluxo de status (decisão #19). A implementação vive em @lanchonete/contracts
// (decisão #24) para que o painel ofereça exatamente os passos que o servidor
// aceita. Este arquivo preserva o caminho de import histórico da API.
export { allowedNextStatus, canTransition } from '@lanchonete/contracts';
