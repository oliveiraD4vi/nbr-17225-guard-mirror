# Guardião Lab 0.1

Extensão experimental separada do Guardião principal para explorar a árvore de acessibilidade exposta pelo Chromium.

## O que o Lab apresenta

- árvore de acessibilidade, inclusive nós ignorados e seus motivos;
- nome, papel, descrição, valor e estados do nó selecionado;
- landmarks, cabeçalhos, links e controles;
- ordem estrutural e ordem de foco como leituras distintas;
- relação entre o nó acessível e o elemento visual;
- atualizações de regiões vivas;
- prévia opcional de leitura sintetizada.

O Lab não é um leitor de tela. A prévia não reproduz cursor virtual, modos de navegação, Braille, comandos, pronúncia nem as diferenças de NVDA, JAWS e VoiceOver.

## Instalação local

1. Abra `chrome://extensions` em um navegador Chromium.
2. Ative o modo do desenvolvedor.
3. Escolha **Carregar sem compactação** e selecione esta pasta `lab`.
4. Abra o DevTools de uma página e selecione **Guardião Lab**.
5. Use **Conectar ao Chromium** somente na página que deseja inspecionar.

A permissão `debugger` gera um aviso amplo do navegador. Por isso o Lab tem manifesto, pacote e identidade próprios e não integra o produto principal.

## Privacidade e ciclo da sessão

O conteúdo observado não é enviado para serviços externos nem persistido. O depurador é desconectado ao fechar o painel, recarregar ou navegar. O manifesto solicita somente `debugger`.

## Validação antes de divulgação

Qualquer alegação pública deve comparar o resultado com:

1. a árvore exibida pelo painel Accessibility do Chrome DevTools;
2. a navegação real por teclado;
3. sessões reais com NVDA e Chrome.

Diferenças devem ser registradas como limites do experimento, não normalizadas como comportamento de um leitor de tela.
