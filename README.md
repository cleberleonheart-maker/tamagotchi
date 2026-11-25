# TamaVida 🐾

Tamagotchi completo em PWA (HTML, CSS e JavaScript puro), com cuidados em tempo real, evolução, economia, conquistas, minigames, missões diárias, sequência semanal, horta, cozinha com buffs, ranking local, mercado de trocas, cartão compartilhável, oficina, tutorial, acessibilidade avançada, estatísticas, aniversários, modo foco, álbum de figurinhas, ofertas diárias, diário ilustrado, eventos, doenças, decoração, sons do clima, atualização pelo navegador e salvamento offline.

## Como executar

Basta abrir `index.html` no navegador. Para instalar como aplicativo (PWA) e ativar o modo offline, sirva via HTTP:

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080`, clique no botão **Instalar aplicativo** do navegador (quando disponível) e pronto. No celular, use a versão publicada em `https://cleberleonheart-maker.github.io/tamagotchi/`. Quando houver nova versão, o botão ⬆️ do topo fica destacado e uma faixa oferece **Atualizar agora**; a versão atual aparece em Configurações e na Ajuda, com histórico no painel **📜 Novidades**.

## Recursos

- **10 espécies** com características, paletas e nomes diferentes por fase.
- **6 fases de evolução**: ovo → bebê → criança → adolescente → adulto → idoso. A evolução exige idade **e** cuidados.
- **6 atributos** que decaem com o tempo: fome, felicidade, energia, higiene, saúde e disciplina. A **qualidade dos cuidados** define quanto de "carinho" cada ação entrega.
- **Ações**: alimentar, brincar, banho, decorar, dormir, treinar, carinho, conversar, cuidados médicos e reviver.
- **Doenças**: má higiene/fome acumula risco; resfriado, indigestão e febre drenam saúde e podem ser curados com remédio, bandagem ou bons cuidados.
- **Missões diárias**: 3 desafios por dia com moedas de recompensa e renovação automática à meia-noite.
- **Missões semanais e calendário**: 3 desafios renovados toda segunda-feira, mais um histórico visual dos últimos 7 dias de cuidado.
- **Rotina e lembretes locais**: horários configuráveis para alimentar, banho e brincar, com avisos contextuais conforme as necessidades do bichinho (com o app aberto e permissão de notificações).
- **Personalidade**: cada bichinho nasce com um traço (curioso, manhoso, dorminhoco ou guloso) que altera frases, humor e como certas necessidades.
- **Caminho adulto**: ao chegar na fase adulta, escolha entre **Sábio** e **Guardião**, com bônus, nome especial e selo no sprite.
- **Visitantes**: amigos aparecem com o app aberto ou garantem uma visita ao voltar (respeitando 6h de cooldown), deixando moedas, itens, pó de figurinha ou uma figurinha nova.
- **Foco com tarefa**: nomeie a sessão; ao concluir ela vira memória no diário e conta minutos focados do dia.
- **Eventos do dia**: feira, chuva, festival, lua cheia e neve alteram comida, higiene, energia, sono e moedas dos minigames. Em dias chuvosos chovem gotas na tela e batalhas causam 15% menos dano; em dias nevados caem flocos, a energia gasta 30% mais rápido e passeios rendem 25% menos, mas acessórios de frio reduzem esse gasto e aparecem no sprite (respeitando "reduzir movimento"). O painel de desafios traz uma missão climática por dia e a previsão dos próximos 3 dias.
- **Visuais de evento**: o cenário ganha decorações e brilho próprios para feira, chuva, festival, lua cheia e neve, com aura de humor no sprite, balões de fala com cauda, plantas da horta em estágios de crescimento e pódio no ranking.
- **Economia**: moedas, loja com 54 itens, 3 ofertas diárias com desconto e estoque limitado, venda de itens, recompensas por nível/evolução/minigames/missões/foco. Compras pedem confirmação e mostram o saldo restante; o elixir exibe o nome do bichinho antes de reanimar.
- **Inventário e loja filtráveis**: chips rápidos por categoria e busca por nome na loja.
- **4 minigames**: Pega comida, Tap Tap, Memória e Pesca do clima (pontuação → moedas + XP; a pesca também rende peixes), todos jogáveis por teclado.
- **30 conquistas** que rendem +50 moedas cada.
- **Sequência diária (streak)**: voltar todos os dias aumenta o contador e rende moedas extras em marcos de 3, 5 e 7 dias.
- **Check-in diário**: faça check-in uma vez por dia no painel de desafios e ganhe 1 item surpresa; o prêmio do dia é fixo para todos e o check-in fica salvo no progresso.
- **Horta**: 4 vagas para plantar 6 tipos de cultivo, regar para acelerar o crescimento e colher itens; chuva rega a horta automaticamente e colheitas sobrevivem ao save.
- **Cozinha com buffs**: 5 pratos feitos com colheitas e itens da loja; comer um prato ativa bônus temporários (fome/energia/humor mais lentas, +25% de moedas em jogos ou +25% de XP), visíveis no painel do pet.
- **Mercado de trocas**: use pó de figurinha e duplicatas do álbum para pegar cenouras, energéticos, bolos, elixires ou o laço de festa sem perder figurinhas únicas.
- **Cartão compartilhável**: exporte um PNG com espécie, fase, nível, humor, streak, moedas, conquistas e figurinhas.
- **Ranking semanal local**: pontos por alimentar, banhos, minigames, passeios, batalhas, foco e check-ins, com categoria líder, faixa de rank e recordes que permanecem entre semanas.
- **Oficina**: 10 receitas para combinar itens do inventário (bolo, bandagem, perfume, tapete, caixa de música, elixir, chá com bolhas, pipeta colorida, salada de melão e laço artesanal) e ganhar XP.
- **Tutorial interativo** de 5 passos no primeiro acesso, com dicas contextuais e opção de rever quando quiser.
- **Aniversário do bichinho**: no dia da adoção (uma vez por ano) ele ganha bolo, moedas, felicidade e uma comemoração.
- **Modo foco Pomodoro**: sessões de 25/15 minutos e pausas de 5 minutos, com timer persistente, moedas e XP ao concluir.
- **Álbum de figurinhas**: 60 figurinhas por espécie/fase, duplicatas viram pó e 3 pó trocam por uma figurinha que falta. O pó e as repetições também alimentam o mercado de trocas.
- **Aventura**: 5 passeios (parque, floresta, praia, cidade e jardim botânico) com custo de energia, moedas, XP e itens; e 5 batalhas RPG por turnos (atacar, defender, usar item, fugir; atalhos 1-4) com chefes, derrotas críticas e recompensas. O clima do dia reduz recompensas de passeio na neve e dano em batalha na chuva.
- **Até 4 bichinhos** simultâneos, com troca rápida pelo painel lateral.
- **Estado crítico e revive**: se a saúde chegar a zero, use um Elixir da vida para trazer o bichinho de volta.
- **Histórico em gráfico** com recordes e médias por atributo, exportação CSV, diário de eventos, metas de progresso e resumo do que aconteceu enquanto você esteve fora.
- **Diário ilustrado**: registre momentos com legenda e emoção, veja as miniaturas e exporte tudo como PNG.
- **Acessórios** com bônus passivos, incluindo cachecol, luvas, botas de neve e casaco pesado (proteção extra no frio e visualmente equipados no sprite). Trocar de acessório devolve o anterior para a bolsa; **decorações** (tapete, aquário, mural galáxia, lanterna, estante e mini jardim) mudam o visual do quarto.
- **Persistência automática** em `localStorage`, **3 slots de save**, sanitização de saves corrompidos, exportação/importação de save em Base64 e funcionamento offline via service worker.
- **Notificações** opcionais quando uma necessidade fica baixa.
- **Tema dia/noite automático** que acompanha o relógio (06h-18h dia, 18h-06h noite), com opção manual, alto contraste, tamanho de fonte ampliado, modo reduzir movimento e avisos visuais para efeitos sonoros.
- **Efeitos sonoros via WebAudio**, música ambiente, **sons do clima** (chuva, neve e noite), velocidade do tempo (1x/3x/10x) e layout responsivo com navegação inferior no celular.

## Atalhos

| Tecla | Ação |
| --- | --- |
| `Espaço` | Fazer carinho |
| `C` | Abrir a loja |
| `J` | Iniciar um minigame aleatório |
| `Esc` | Fechar janela ou minigame |
| `←` / `→` + `Espaço` | Pega comida: mover e capturar |
| `1`–`9` | Tap Tap: escolher a casa |
| `1`–`4` | Memória: escolher a cor |
| `1`–`5` | Pesca: escolher o peixe |

## Estrutura

```
tamagotchi/
├── index.html              Interface principal
├── styles.css              Tema, layout e sprite pixel art
├── js/
│   ├── data.js             Espécies, fases, itens, pratos, trocas, peixes, missões, eventos, receitas, tutorial, conquistas
│   ├── engine.js           Regras do jogo, tempo, economia, save
│   ├── audio.js            Efeitos e música com WebAudio
│   ├── games.js            Minigames
│   ├── ui.js               Renderização, modais, gráfico
│   └── app.js              Eventos, loop, notificações, PWA
├── icons/                  Ícones PNG gerados por tools/generate_icons.py
├── tests/engine.test.js    Testes de lógica (Node)
├── manifest.json
├── service-worker.js
└── tools/generate_icons.py
```

## Testes

```bash
npm test
# ou
node tests/engine.test.js
```

Suíte atual: 78 testes cobrindo tempo, evolução, economia, itens, troca de acessórios e decorações, elixir protegido, missões diárias/semanais e climáticas, check-in diário, calendário de cuidados, lembretes, foco com tarefa, personalidade, caminhos adultos, visitantes, streak, oficina, cozinha, buffs, mercado de trocas, pesca, estatísticas, acessibilidade, aniversário, figurinhas, ofertas, momentos, passeios, batalhas, doenças, slots, sanitização, eventos climáticos, acessórios de frio, efeitos do clima em aventuras, tema dia/noite automático, horta, rotina, ranking semanal e correções de robustez.

## Salvamento

O progresso fica no `localStorage` do navegador (`tamavida.save.v1`). Use **Exportar** e **Importar** no painel "Seu progresso" para migrar entre dispositivos. Em **Configurações → Slots de salvamento** você pode guardar e carregar até 3 progressos separados. Ao importar ou carregar, o save passa por validação e campos inválidos são corrigidos. O botão **Recomeçar** apaga o progresso atual e inicia uma nova adoção.
