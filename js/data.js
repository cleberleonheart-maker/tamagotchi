(function (global) {
  'use strict';

  var STAGES = [
    { id: 'egg', name: 'Ovo', min: 0, care: 0, size: 0.7 },
    { id: 'baby', name: 'Bebê', min: 1, care: 5, size: 0.82 },
    { id: 'child', name: 'Criança', min: 10, care: 15, size: 0.92 },
    { id: 'teen', name: 'Adolescente', min: 30, care: 30, size: 1 },
    { id: 'adult', name: 'Adulto', min: 75, care: 50, size: 1.06 },
    { id: 'elder', name: 'Idoso', min: 180, care: 75, size: 1.02 }
  ];

  var SPECIES = [
    {
      id: 'draco',
      name: 'Dragozinho',
      emoji: '🐉',
      colors: ['#7cf0b8', '#41c98f', '#1f8f68'],
      rate: { hunger: 1.05, happiness: 1, energy: 0.95, hygiene: 1 },
      names: ['Ovo de dragão', 'Pequeno dragão', 'Dragonzinho', 'Dragão jovem', 'Dragão majestoso', 'Dragão sábio'],
      description: 'Curioso e corajoso. Adora brincar de voar.'
    },
    {
      id: 'mimi',
      name: 'Mimoso',
      emoji: '🐱',
      colors: ['#ffd6a5', '#ffac7d', '#e27657'],
      rate: { hunger: 1, happiness: 1.2, energy: 1.1, hygiene: 1.1 },
      names: ['Ovo fofinho', 'Gatinho', 'Mimoso', 'Gato esperto', 'Gato elegante', 'Gato ancião'],
      description: 'Muito carinhoso, mas se irrita se for ignorado.'
    },
    {
      id: 'robo',
      name: 'Robozinho',
      emoji: '🤖',
      colors: ['#a9c7ff', '#6f95f5', '#4568c4'],
      rate: { hunger: 0.9, happiness: 0.9, energy: 1.35, hygiene: 0.85 },
      names: ['Cápsula', 'Mini bot', 'Robôzinho', 'Robô adolescente', 'Robô de estimação', 'Robô clássico'],
      description: 'Precisa de recargas frequentes. Nunca fica sujo.'
    },
    {
      id: 'fada',
      name: 'Fadinha',
      emoji: '🧚',
      colors: ['#f7b8ff', '#d987f0', '#a152c7'],
      rate: { hunger: 1, happiness: 1.1, energy: 1, hygiene: 1.35 },
      names: ['Ovo brilhante', 'Pequena fada', 'Fadinha', 'Fada adolescente', 'Fada encantadora', 'Fada imortal'],
      description: 'Delicada e brilhante. Ama banhos e bugigangas.'
    },
    {
      id: 'bunu',
      name: 'Buninho',
      emoji: '🐰',
      colors: ['#ffe6f2', '#ffb0ce', '#d26498'],
      rate: { hunger: 1.1, happiness: 1.25, energy: 1, hygiene: 1.1 },
      names: ['Ovo algodão', 'Coelhinho', 'Buninho', 'Coelho esperto', 'Coelho elegante', 'Coelho ancião'],
      description: 'Muito sensível: fica triste com facilidade, mas adora carinho.'
    },
    {
      id: 'urso',
      name: 'Ursinho',
      emoji: '🐻',
      colors: ['#f2cfaa', '#c99263', '#8b5b3c'],
      rate: { hunger: 1.25, happiness: 0.9, energy: 0.85, hygiene: 1.05 },
      names: ['Ovo mel', 'Ursinho', 'Urso gordinho', 'Urso jovem', 'Urso imponente', 'Urso sábio'],
      description: 'Comilão e dorminhoco. Precisa de comida constante.'
    },
    {
      id: 'panda',
      name: 'Pandinha',
      emoji: '🐼',
      colors: ['#f7f7f7', '#2b2b35', '#7ecb9c'],
      rate: { hunger: 1.1, happiness: 1.05, energy: 0.9, hygiene: 1.1 },
      names: ['Ovo de panda', 'Pandinha', 'Panda travesso', 'Panda jovem', 'Panda elegante', 'Panda ancião'],
      description: 'Calmo e guloso. Adora folhas frescas e sonecas longas.'
    },
    {
      id: 'nuvem',
      name: 'Nuvem',
      emoji: '🌈',
      colors: ['#a8e6ff', '#f6c1ff', '#fff3a6'],
      rate: { hunger: 0.9, happiness: 1.2, energy: 1.1, hygiene: 0.95 },
      names: ['Ovo de arco-íris', 'Nuvenzinha', 'Nuvem fofinha', 'Nuvem saltitante', 'Nuvem guardiã', 'Nuvem serena'],
      description: 'Alegre e leve. Seu humor melhora até em dias chuvosos.'
    },
    {
      id: 'tartaruga',
      name: 'Tartaruga',
      emoji: '🐢',
      colors: ['#8fd6a0', '#4b8f6b', '#e6d27a'],
      rate: { hunger: 0.8, happiness: 0.95, energy: 0.7, hygiene: 1.15 },
      names: ['Ovo de tartaruga', 'Tartaruguinha', 'Tartaruga ágil', 'Tartaruga jovem', 'Tartaruga sábia', 'Tartaruga anciã'],
      description: 'Lenta e serena. Economiza energia e envelhece com sabedoria.'
    },
    {
      id: 'raposa',
      name: 'Raposinha',
      emoji: '🦊',
      colors: ['#ff9a55', '#e2632f', '#ffe8c9'],
      rate: { hunger: 1.15, happiness: 1.1, energy: 1.05, hygiene: 0.9 },
      names: ['Ovo de raposa', 'Raposinha', 'Raposa esperta', 'Raposa jovem', 'Raposa elegante', 'Raposa lendária'],
      description: 'Esperta e brincalhona. Adora passeios e pequenas surpresas.'
    }
  ];

  var ITEMS = [
    { id: 'apple', name: 'Maçã', emoji: '🍎', type: 'food', price: 12, hunger: 14, weight: 1, xp: 3, desc: 'Um lanche saudável e simples.' },
    { id: 'carrot', name: 'Cenoura', emoji: '🥕', type: 'food', price: 18, hunger: 18, weight: 0, xp: 4, desc: 'Snack leve que não engorda.' },
    { id: 'milk', name: 'Leite', emoji: '🥛', type: 'food', price: 34, hunger: 26, health: 4, weight: 2, xp: 6, desc: 'Fortalece e mata a fome.' },
    { id: 'cookie', name: 'Biscoito', emoji: '🍪', type: 'food', price: 26, hunger: 24, happiness: 4, weight: 3, xp: 5, desc: 'Crocante e delicioso.' },
    { id: 'sushi', name: 'Sushi', emoji: '🍣', type: 'food', price: 48, hunger: 38, happiness: 6, weight: 3, xp: 9, desc: 'Uma refeição completa.' },
    { id: 'cake', name: 'Bolo', emoji: '🍰', type: 'food', price: 72, hunger: 48, happiness: 14, weight: 6, xp: 14, desc: 'Festa instantânea, mas engorda.' },
    { id: 'energy', name: 'Energético', emoji: '⚡', type: 'food', price: 65, hunger: 18, energy: 32, weight: 1, xp: 8, desc: 'Recarrega as baterias.' },
    { id: 'soup', name: 'Sopa da horta', emoji: '🍲', type: 'food', price: 88, hunger: 42, happiness: 6, weight: 4, xp: 12, buff: 'soup', buffMinutes: 30, desc: 'Fome mais lenta por 30 min.' },
    { id: 'juice', name: 'Suco energético', emoji: '🧃', type: 'food', price: 92, hunger: 28, energy: 20, weight: 2, xp: 12, buff: 'juice', buffMinutes: 30, desc: 'Energia mais lenta por 30 min.' },
    { id: 'luckpie', name: 'Torta da sorte', emoji: '🥧', type: 'food', price: 105, hunger: 36, happiness: 10, weight: 5, xp: 14, buff: 'luck', buffMinutes: 20, desc: '+25% de moedas em jogos por 20 min.' },
    { id: 'shineTea', name: 'Chá brilhante', emoji: '🍵', type: 'food', price: 110, hunger: 20, happiness: 12, weight: 1, xp: 14, buff: 'tea', buffMinutes: 20, desc: '+25% de XP por 20 min.' },
    { id: 'fish', name: 'Peixe prateado', emoji: '🐟', type: 'food', price: 34, hunger: 20, happiness: 3, weight: 2, xp: 7, desc: 'Pescado comum, rico em proteína.' },
    { id: 'tropicalfish', name: 'Peixe tropical', emoji: '🐠', type: 'food', price: 58, hunger: 24, happiness: 6, weight: 2, xp: 10, desc: 'Um peixe colorido dos dias de festa.' },
    { id: 'pufferfish', name: 'Baiacu', emoji: '🐡', type: 'food', price: 66, hunger: 28, happiness: 8, weight: 3, xp: 12, desc: 'Pescado esperto, encontrado na chuva e na neve.' },
    { id: 'bubbletea', name: 'Chá com bolhas', emoji: '🧋', type: 'food', price: 95, hunger: 26, happiness: 16, energy: 10, weight: 3, xp: 12, desc: 'Doce e refrescante. Anima até o bichinho mais tímido.' },
    { id: 'mooncake', name: 'Bolo da lua', emoji: '🥮', type: 'food', price: 120, hunger: 34, happiness: 20, health: 4, weight: 4, xp: 16, desc: 'Um bolinho dourado que alegra e fortalece.' },
    { id: 'soap', name: 'Sabão', emoji: '🧼', type: 'care', price: 22, hygiene: 38, happiness: 2, xp: 4, desc: 'Tira a sujeira do dia.' },
    { id: 'shampoo', name: 'Shampoo', emoji: '🫧', type: 'care', price: 46, hygiene: 65, happiness: 8, xp: 7, desc: 'Banho completo e cheiroso.' },
    { id: 'brush', name: 'Escova', emoji: '🪥', type: 'care', price: 38, hygiene: 18, discipline: 14, xp: 6, desc: 'Higiene e disciplina em um só item.' },
    { id: 'medicine', name: 'Remédio', emoji: '💊', type: 'care', price: 58, health: 38, cures: true, xp: 6, desc: 'Cura doenças e fortalece a saúde.' },
    { id: 'bandage', name: 'Bandagem', emoji: '🩹', type: 'care', price: 44, health: 28, cures: true, xp: 8, desc: 'Cura doenças rapidamente.' },
    { id: 'perfume', name: 'Perfume', emoji: '🌸', type: 'care', price: 55, hygiene: 30, happiness: 12, xp: 8, desc: 'Cheiroso e animado.' },
    { id: 'elixir', name: 'Elixir da vida', emoji: '🧪', type: 'care', price: 160, health: 100, energy: 40, xp: 30, desc: 'Reanima um bichinho em estado crítico.' },
    { id: 'sponge', name: 'Esponja mágica', emoji: '🧽', type: 'care', price: 40, hygiene: 30, happiness: 4, xp: 6, desc: 'Remove sujeira teimosa sem gastar muito.' },
    { id: 'vitamin', name: 'Vitamina', emoji: '🍊', type: 'care', price: 70, health: 20, energy: 12, xp: 8, desc: 'Um reforço diário de saúde e disposição.' },
    { id: 'ball', name: 'Bola', emoji: '⚽', type: 'toy', price: 42, happiness: 22, energy: 8, xp: 8, desc: 'Brincadeira clássica.' },
    { id: 'piano', name: 'Pianinho', emoji: '🎹', type: 'toy', price: 96, happiness: 38, energy: 10, xp: 15, desc: 'Seu bichinho vai amar fazer música.' },
    { id: 'console', name: 'Videogame', emoji: '🎮', type: 'toy', price: 185, happiness: 58, energy: 14, xp: 24, desc: 'Diversão garantida por horas.' },
    { id: 'musicbox', name: 'Caixa de música', emoji: '🎵', type: 'toy', price: 110, happiness: 42, energy: 6, xp: 18, desc: 'Uma melodia que acalma e diverte.' },
    { id: 'gift', name: 'Presente surpresa', emoji: '🎁', type: 'toy', price: 100, happiness: 50, health: 10, xp: 20, desc: 'Uma caixa misteriosa. Perfeita para aniversários.' },
    { id: 'kite', name: 'Pipeta colorida', emoji: '🪁', type: 'toy', price: 80, happiness: 32, energy: 12, xp: 12, desc: 'Correr atrás do vento nunca foi tão divertido.' },
    { id: 'puzzle', name: 'Quebra-cabeça', emoji: '🧩', type: 'toy', price: 120, happiness: 40, discipline: 10, xp: 16, desc: 'Diversão que também exercita a paciência.' },
    { id: 'hat', name: 'Boné', emoji: '🧢', type: 'accessory', price: 120, bonus: { happiness: 0.18 }, desc: 'Estilo despojado. Reduz a tristeza.' },
    { id: 'glasses', name: 'Óculos', emoji: '👓', type: 'accessory', price: 150, bonus: { hunger: 0.16 }, desc: 'Parece inteligente. Fica com fome mais devagar.' },
    { id: 'crown', name: 'Coroa', emoji: '👑', type: 'accessory', price: 320, bonus: { hygiene: 0.25, happiness: 0.15 }, desc: 'Realeza absoluta. Sujeira e tristeza mais lentas.' },
    { id: 'wings', name: 'Asas', emoji: '🪽', type: 'accessory', price: 280, bonus: { energy: 0.22 }, desc: 'Voar cansa menos.' },
    { id: 'scarf', name: 'Cachecol', emoji: '🧣', type: 'accessory', price: 130, warmth: 0.1, bonus: { happiness: 0.08 }, desc: 'Aquece o pescoço e anima em dias frios.' },
    { id: 'gloves', name: 'Luvas', emoji: '🧤', type: 'accessory', price: 150, warmth: 0.12, bonus: { hygiene: 0.08 }, desc: 'Protege as patinhas e evita sujeira na neve.' },
    { id: 'boots', name: 'Botas de neve', emoji: '🥾', type: 'accessory', price: 190, warmth: 0.15, bonus: { energy: 0.08 }, desc: 'Caminha na neve sem cansar tanto.' },
    { id: 'coat', name: 'Casaco pesado', emoji: '🧥', type: 'accessory', price: 260, warmth: 0.2, bonus: { happiness: 0.12 }, desc: 'O melhor abrigo para o Dia nevado.' },
    { id: 'headphones', name: 'Fones de ouvido', emoji: '🎧', type: 'accessory', price: 210, bonus: { happiness: 0.14, energy: 0.08 }, desc: 'Música o dia todo. Menos tédio e menos cansaço.' },
    { id: 'cape', name: 'Capa de herói', emoji: '🦸', type: 'accessory', price: 240, warmth: 0.08, bonus: { hygiene: 0.12, happiness: 0.1 }, desc: 'Visual de herói com um pouco de proteção extra.' },
    { id: 'rug', name: 'Tapete feliz', emoji: '🧶', type: 'decor', decor: 'cozy', price: 90, xp: 5, desc: 'Deixa o quarto aconchegante.' },
    { id: 'aquarium', name: 'Aquário', emoji: '🐠', type: 'decor', decor: 'ocean', price: 180, xp: 10, desc: 'Peixes coloridos para relaxar.' },
    { id: 'galaxy', name: 'Mural galáxia', emoji: '🌌', type: 'decor', decor: 'space', price: 260, xp: 15, desc: 'Um céu estrelado dentro de casa.' },
    { id: 'lantern', name: 'Lanterna de papel', emoji: '🏮', type: 'decor', decor: 'lantern', price: 140, xp: 8, desc: 'Uma luz quentinha para o quarto à noite.' },
    { id: 'bookshelf', name: 'Estante de livros', emoji: '📚', type: 'decor', decor: 'library', price: 220, xp: 12, desc: 'Histórias e conforto em cada prateleira.' },
    { id: 'melon', name: 'Melão doce', emoji: '🍈', type: 'food', price: 88, hunger: 30, happiness: 10, weight: 3, xp: 11, desc: 'Doce e suculento. Acalma a fome sem pesar.' },
    { id: 'icecream', name: 'Sorvete', emoji: '🍦', type: 'food', price: 105, hunger: 18, happiness: 26, energy: 6, weight: 3, xp: 12, desc: 'Um refresco cremoso que alegra qualquer dia.' },
    { id: 'sorbet', name: 'Sorbete refrescante', emoji: '🍧', type: 'food', price: 150, hunger: 22, happiness: 30, health: 3, weight: 4, xp: 16, desc: 'Feito na cozinha. Fome e humor ficam mais lentos.' },
    { id: 'towel', name: 'Toalha quente', emoji: '🧺', type: 'care', price: 36, hygiene: 34, happiness: 6, xp: 7, desc: 'Seca e aqueca depois do banho.' },
    { id: 'yoyo', name: 'Ioiô colorido', emoji: '🪀', type: 'toy', price: 65, happiness: 28, discipline: 8, xp: 10, desc: 'Brincadeira simples que exercita a paciência.' },
    { id: 'bow', name: 'Laço de festa', emoji: '🎀', type: 'accessory', price: 170, bonus: { happiness: 0.12, hygiene: 0.06 }, desc: 'Charme extra com menos tristeza e sujeira.' },
    { id: 'terrarium', name: 'Mini jardim', emoji: '🪴', type: 'decor', decor: 'garden', price: 200, xp: 11, desc: 'Um cantinho verde dentro de casa.' }
  ];

  var QUESTS = [
    { id: 'feed3', key: 'feed', target: 3, reward: 60, emoji: '🍎', name: 'Alimente 3 vezes' },
    { id: 'games2', key: 'game', target: 2, reward: 80, emoji: '🎮', name: 'Jogue 2 minigames' },
    { id: 'bath1', key: 'bath', target: 1, reward: 50, emoji: '🛁', name: 'Dê 1 banho' },
    { id: 'sleep1', key: 'sleep', target: 1, reward: 45, emoji: '😴', name: 'Deixe dormir 1 vez' },
    { id: 'train2', key: 'train', target: 2, reward: 55, emoji: '💪', name: 'Treine 2 vezes' },
    { id: 'pet5', key: 'pet', target: 5, reward: 40, emoji: '🤗', name: 'Faça 5 carinhos' },
    { id: 'earn150', key: 'earn', target: 150, reward: 70, emoji: '🪙', name: 'Ganhe 150 moedas' },
    { id: 'walks2', key: 'walk', target: 2, reward: 65, emoji: '🌳', name: 'Vá passear 2 vezes' },
    { id: 'battles2', key: 'battle', target: 2, reward: 75, emoji: '⚔️', name: 'Enfrente 2 batalhas' }
  ];

  var WEATHER_QUESTS = {
    feira: { id: 'q-feira', key: 'feed', target: 3, reward: 70, emoji: '🍎', name: 'Banquete da feira' },
    chuva: { id: 'q-chuva', key: 'bath', target: 2, reward: 80, emoji: '🛁', name: 'Banhos na chuva' },
    festival: { id: 'q-festival', key: 'game', target: 2, reward: 90, emoji: '🎮', name: 'Diversão do festival' },
    lua: { id: 'q-lua', key: 'sleep', target: 1, reward: 85, emoji: '🌕', name: 'Sonho sob a lua' },
    neve: { id: 'q-neve', key: 'walk', target: 1, reward: 95, emoji: '🥾', name: 'Passeio na neve' }
  };

  var CROPS = [
    { id: 'carrot', name: 'Cenoura', emoji: '🥕', cost: 20, minutes: 15, itemId: 'carrot', amount: 2 },
    { id: 'apple', name: 'Maçã', emoji: '🍎', cost: 25, minutes: 18, itemId: 'apple', amount: 2 },
    { id: 'cookie', name: 'Biscoito', emoji: '🍪', cost: 35, minutes: 22, itemId: 'cookie', amount: 2 },
    { id: 'soap', name: 'Sabão', emoji: '🧼', cost: 40, minutes: 26, itemId: 'soap', amount: 1 },
    { id: 'milk', name: 'Leite', emoji: '🥛', cost: 55, minutes: 32, itemId: 'milk', amount: 1 },
    { id: 'ball', name: 'Bola', emoji: '⚽', cost: 80, minutes: 45, itemId: 'ball', amount: 1 }
  ];

  var ROUTINE_OPTIONS = [
    { key: 'feed', label: 'Alimentar', emoji: '🍗', default: '08:00' },
    { key: 'bath', label: 'Banho', emoji: '🛁', default: '20:00' },
    { key: 'play', label: 'Brincar', emoji: '🎮', default: '15:00' }
  ];

  var RANKING_KEYS = ['feed', 'game', 'bath', 'sleep', 'train', 'pet', 'walk', 'battle', 'focus', 'checkin'];

  var WEEKLY_QUESTS = [
    { id: 'wfeed20', key: 'feed', target: 20, reward: 240, emoji: '🍎', name: 'Banquete da semana' },
    { id: 'wgame7', key: 'game', target: 7, reward: 220, emoji: '🎮', name: 'Semana jogando' },
    { id: 'wbath5', key: 'bath', target: 5, reward: 180, emoji: '🛁', name: 'Banhos da semana' },
    { id: 'wsleep5', key: 'sleep', target: 5, reward: 180, emoji: '😴', name: 'Sonhos da semana' },
    { id: 'wtrain7', key: 'train', target: 7, reward: 200, emoji: '💪', name: 'Treinos da semana' },
    { id: 'wpet15', key: 'pet', target: 15, reward: 160, emoji: '🤗', name: 'Carinhos da semana' },
    { id: 'wwalk5', key: 'walk', target: 5, reward: 210, emoji: '🌳', name: 'Passeios da semana' },
    { id: 'wbattle5', key: 'battle', target: 5, reward: 230, emoji: '⚔️', name: 'Batalhas da semana' }
  ];

  var PERSONALITIES = [
    {
      id: 'curioso', name: 'Curioso', emoji: '🔎', desc: 'Fica mais feliz brincando e conversando.',
      rates: { happiness: 0.88, energy: 1.05 }, moodBonus: 3,
      lines: { play: ['Qual foi o truque? 🤔', 'De novo! Quero ver!'], talk: ['Me conta mais!', 'O que tem ali?'] }
    },
    {
      id: 'manhoso', name: 'Manhoso', emoji: '💜', desc: 'Adora carinho, mas sente falta dele mais rápido.',
      rates: { happiness: 1.12, hygiene: 1.03 }, moodBonus: 0,
      lines: { pet: ['Hummm, não pare! 💜', 'Só mais um carinho...'], talk: ['Atenção aqui!', 'Você me ignorou?'] }
    },
    {
      id: 'dorminhoco', name: 'Dorminhoco', emoji: '😴', desc: 'Gasta energia devagar e dorme profundamente.',
      rates: { energy: 0.75, hunger: 1.08 }, moodBonus: 2,
      lines: { sleep: ['Zzz... finalmente...', 'Sonhando com nuvens ☁️'] }
    },
    {
      id: 'guloso', name: 'Guloso', emoji: '🍽️', desc: 'Fica faminto mais rápido, mas agradece com carinho.',
      rates: { hunger: 1.25, happiness: 0.92 }, moodBonus: 1,
      lines: { feed: ['Hmm, tem mais? 😋', 'Meu prato favorito!'] }
    }
  ];

  var PATHS = [
    {
      id: 'sabio', name: 'Sábio', emoji: '🧠', desc: 'Feliz e descansado: felicidade e energia caem mais devagar.',
      bonus: { happiness: 0.85, energy: 0.85 }, stats: { happiness: 15, energy: 15 }, xp: 40, coins: 80
    },
    {
      id: 'guardiao', name: 'Guardião', emoji: '🛡️', desc: 'Resiliente: saúde e higiene caem mais devagar.',
      bonus: { health: 0.8, hygiene: 0.85 }, stats: { health: 20, hygiene: 15 }, xp: 40, coins: 80
    }
  ];

  var VISITORS = [
    { id: 'vovo', name: 'Vovó Biju', emoji: '👵', msg: 'trouxe biscoitos e moedas', gift: { coins: 35, item: 'cookie', qty: 2 } },
    { id: 'fada', name: 'Fada madrinha', emoji: '✨', msg: 'deixou pó de figurinha', gift: { dust: 3 } },
    { id: 'amigo', name: 'Amigo da escola', emoji: '🧑‍🤝‍🧑', msg: 'veio brincar e trouxe uma figurinha', gift: { coins: 10, sticker: true } }
  ];

  var EVENTS = [
    { id: 'feira', name: 'Feira de comidas', emoji: '🍎', desc: 'Comidas recuperam +25% de fome.', effect: { food: 1.25 } },
    { id: 'chuva', name: 'Dia chuvoso', emoji: '🌧️', desc: 'A higiene cai 30% mais rápido e batalhas causam 15% menos dano.', effect: { hygiene: 1.3, battle: 0.85 } },
    { id: 'festival', name: 'Festival de jogos', emoji: '🎪', desc: 'Minigames pagam +25% de moedas.', effect: { coins: 1.25 } },
    { id: 'lua', name: 'Lua cheia', emoji: '🌕', desc: 'Dormir recupera 30% mais energia.', effect: { sleep: 1.3 } },
    { id: 'neve', name: 'Dia nevado', emoji: '❄️', desc: 'A energia cai 30% mais rápido e passeios rendem 25% menos.', effect: { energy: 1.3, walk: 0.75 } }
  ];

  function dayIndex(date) {
    var value = date || new Date();
    return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000);
  }

  var CHECKIN_ITEMS = ['apple', 'carrot', 'milk', 'soap', 'brush', 'bandage', 'ball', 'musicbox', 'cookie', 'energy'];

  function checkinItemForDay(date) {
    return CHECKIN_ITEMS[dayIndex(date) % CHECKIN_ITEMS.length];
  }

  function questsForDay(date) {
    var index = dayIndex(date);
    var weather = WEATHER_QUESTS[eventForDay(date).id];
    var pool = QUESTS.filter(function (quest) { return quest.key !== weather.key; });
    var templates = [weather, pool[index % pool.length], pool[(index + 3) % pool.length]];
    return templates.map(function (template) {
      return {
        id: template.id + '-' + index,
        key: template.key,
        target: template.target,
        reward: template.reward,
        emoji: template.emoji,
        name: template.name,
        weather: template === weather ? eventForDay(date).id : null,
        progress: 0,
        claimed: false
      };
    });
  }

  function weekKey(date) {
    var value = date || new Date();
    var monday = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
  }

  function questsForWeek(date) {
    var key = weekKey(date);
    var index = Math.floor(dayIndex(new Date(key + 'T12:00:00')) / 7);
    return [0, 1, 2].map(function (offset) {
      var template = WEEKLY_QUESTS[(index + offset * 3 + Math.floor(index / 5)) % WEEKLY_QUESTS.length];
      return {
        id: template.id + '-' + key,
        key: template.key,
        target: template.target,
        reward: template.reward,
        emoji: template.emoji,
        name: template.name,
        progress: 0,
        claimed: false
      };
    });
  }

  function eventForDay(date) {
    return EVENTS[dayIndex(date) % EVENTS.length];
  }

  function fishForDay(date) {
    var weather = eventForDay(date).id;
    var available = FISH.filter(function (fish) { return fish.weather.indexOf(weather) !== -1; });
    return available.length ? available : FISH.slice(0, 1);
  }

  var ACHIEVEMENTS = [
    { id: 'first_feed', name: 'Primeira mordida', emoji: '🍎', desc: 'Alimente seu bichinho pela primeira vez.' },
    { id: 'first_play', name: 'Diversão começa', emoji: '🎈', desc: 'Brinque com seu bichinho.' },
    { id: 'first_bath', name: 'Cheiroso!', emoji: '🛁', desc: 'Dê o primeiro banho.' },
    { id: 'feeds_25', name: 'Bem alimentado', emoji: '🍽️', desc: 'Alimente 25 vezes.' },
    { id: 'feeds_100', name: 'Mestre da cozinha', emoji: '👨‍🍳', desc: 'Alimente 100 vezes.' },
    { id: 'games_10', name: 'Campeão', emoji: '🏆', desc: 'Jogue 10 minigames.' },
    { id: 'games_50', name: 'Lenda dos minigames', emoji: '🥇', desc: 'Jogue 50 minigames.' },
    { id: 'level_5', name: 'Crescendo', emoji: '⭐', desc: 'Alcance o nível 5.' },
    { id: 'level_10', name: 'Experiente', emoji: '🌟', desc: 'Alcance o nível 10.' },
    { id: 'stage_adult', name: 'Maturidade', emoji: '🎓', desc: 'Cuidados até a fase adulta.' },
    { id: 'stage_elder', name: 'Sabedoria', emoji: '🕊️', desc: 'Cuidados até a fase idosa.' },
    { id: 'rich', name: 'Coin stack', emoji: '💰', desc: 'Tenha 1000 moedas de uma vez.' },
    { id: 'perfect', name: 'Cuidado perfeito', emoji: '💯', desc: 'Deixe todos os stats acima de 90.' },
    { id: 'revive', name: 'Segunda chance', emoji: '✨', desc: 'Reanime um bichinho crítico.' },
    { id: 'collector', name: 'Colecionador', emoji: '🐾', desc: 'Adote todas as 6 espécies.' },
    { id: 'accessory', name: 'Estiloso', emoji: '😎', desc: 'Equipe um acessório.' },
    { id: 'sleep', name: 'Boa noite', emoji: '🌙', desc: 'Deixe seu bichinho dormir.' },
    { id: 'discipline_100', name: 'Muito obediente', emoji: '🎖️', desc: 'Chegue a 100 de disciplina.' },
    { id: 'streak_7', name: 'Sete dias seguidos', emoji: '🔥', desc: 'Volte ao TamaVida por 7 dias seguidos.' },
    { id: 'crafter', name: 'Mãos de fada', emoji: '🛠️', desc: 'Crie seu primeiro item na oficina.' },
    { id: 'birthday', name: 'Feliz aniversário!', emoji: '🎂', desc: 'Celebre o aniversário do seu bichinho.' },
    { id: 'focus_5', name: 'Mente focada', emoji: '🧠', desc: 'Conclua 5 sessões de foco.' },
    { id: 'sticker_10', name: 'Álbum crescendo', emoji: '📔', desc: 'Colecione 10 figurinhas.' },
    { id: 'deals_5', name: 'Caçador de ofertas', emoji: '🏷️', desc: 'Compre 5 itens em ofertas do dia.' },
    { id: 'moment_5', name: 'Memórias felizes', emoji: '📸', desc: 'Registre 5 momentos no diário ilustrado.' },
    { id: 'walk_5', name: 'Passeio longo', emoji: '🌳', desc: 'Vá passear 5 vezes.' },
    { id: 'battle_10', name: 'Aventureiro', emoji: '⚔️', desc: 'Enfrente 10 batalhas.' },
    { id: 'boss', name: 'Campeão do reino', emoji: '🗿', desc: 'Derrote o golem de pedra.' },
    { id: 'path_chosen', name: 'Destino traçado', emoji: '🌟', desc: 'Escolha o caminho do seu bichinho na fase adulta.' },
    { id: 'visitor_1', name: 'Boa visita', emoji: '🎁', desc: 'Receba a visita de um amigo.' }
  ];

  var MOODS = [
    { id: 'happy', label: 'Feliz', emoji: '😄', min: 80 },
    { id: 'ok', label: 'Bem', emoji: '🙂', min: 60 },
    { id: 'meh', label: 'Mais ou menos', emoji: '😐', min: 40 },
    { id: 'sad', label: 'Triste', emoji: '🙁', min: 20 },
    { id: 'bad', label: 'Muito triste', emoji: '😢', min: 0 }
  ];

  var GAMES = [
    { id: 'catch', name: 'Pega comida', emoji: '🍕', desc: 'Clique nas comidas antes que caiam.', color: '#ffb86b' },
    { id: 'tap', name: 'Tap Tap', emoji: '💥', desc: 'Toque nos corações que aparecem.', color: '#ff7ba9' },
    { id: 'memory', name: 'Memória', emoji: '🧠', desc: 'Repita a sequência de cores.', color: '#8b7bff' },
    { id: 'fish', name: 'Pesca do clima', emoji: '🎣', desc: 'Pesque peixes que aparecem conforme o tempo.', color: '#6cc6ff' }
  ];

  var SPEED_LABELS = { 1: 'Normal', 3: 'Rápida', 10: 'Turbo' };

  var CONTRAST_LABELS = { normal: 'Padrão', high: 'Alto contraste' };
  var FONT_LABELS = { normal: 'Normal', large: 'Ampliada' };

  var TUTORIAL = [
    { emoji: '👋', title: 'Bem-vindo ao TamaVida!', text: 'Seu bichinho nasceu de um ovo. Cuide dele para vê-lo crescer e evoluir.' },
    { emoji: '🍎', title: 'Alimente', text: 'Use Alimentar para abrir a bolsa. Comida recupera a fome, mas suja um pouco.' },
    { emoji: '🎮', title: 'Brinque', text: 'Minigames dão moedas, XP e diversão. Dá para jogar com o teclado também.' },
    { emoji: '💊', title: 'Cuide da saúde', text: 'Banho e remédio evitam doenças. Fique de olho nos alertas e nas missões diárias.' },
    { emoji: '🔥', title: 'Volte todo dia', text: 'Cada dia seguido aumenta sua sequência e rende moedas extras. Bons cuidados!' }
  ];

  var RECIPES = [
    { id: 'cake', name: 'Bolo caseiro', emoji: '🍰', ingredients: { apple: 2, carrot: 1 }, result: 'cake', amount: 1, xp: 10, desc: 'Um bolo fofo para comemorar.' },
    { id: 'bandage', name: 'Bandagem', emoji: '🩹', ingredients: { soap: 1, brush: 1 }, result: 'bandage', amount: 1, xp: 8, desc: 'Cura doenças e limpa o pelo.' },
    { id: 'perfume', name: 'Perfume', emoji: '🌸', ingredients: { soap: 1, apple: 1, milk: 1 }, result: 'perfume', amount: 1, xp: 12, desc: 'Higiene e humor em um frasco.' },
    { id: 'rug', name: 'Tapete feliz', emoji: '🧶', ingredients: { ball: 1, brush: 2 }, result: 'rug', amount: 1, xp: 14, desc: 'Decora o quarto com estilo.' },
    { id: 'musicbox', name: 'Caixa de música', emoji: '🎵', ingredients: { ball: 1, piano: 1 }, result: 'musicbox', amount: 1, xp: 18, desc: 'Une brincadeira e música.' },
    { id: 'elixir', name: 'Elixir da vida', emoji: '🧪', ingredients: { medicine: 1, milk: 2, energy: 1 }, result: 'elixir', amount: 1, xp: 30, desc: 'Reanima um bichinho crítico.' },
    { id: 'bubbleRecipe', name: 'Chá com bolhas', emoji: '🧋', ingredients: { milk: 1, juice: 1, cookie: 1 }, result: 'bubbletea', amount: 2, xp: 16, desc: 'Um refresco doce feito em casa.' },
    { id: 'kiteRecipe', name: 'Pipeta colorida', emoji: '🪁', ingredients: { ball: 1, brush: 1, carrot: 1 }, result: 'kite', amount: 1, xp: 14, desc: 'Junta papel, linha e muita diversão.' },
    { id: 'melonRecipe', name: 'Salada de melão', emoji: '🍈', ingredients: { apple: 1, milk: 1, carrot: 1 }, result: 'melon', amount: 2, xp: 18, desc: 'Um lanche fresco feito com a horta.' },
    { id: 'bowRecipe', name: 'Laço artesanal', emoji: '🎀', ingredients: { ball: 1, brush: 1, cookie: 1 }, result: 'bow', amount: 1, xp: 16, desc: 'Um enfeite novo para o bichinho.' }
  ];

  var BUFFS = {
    soup: { name: 'Sopa da horta', emoji: '🍲', minutes: 30, desc: 'A fome diminui 25% mais devagar.' },
    juice: { name: 'Suco energético', emoji: '🧃', minutes: 30, desc: 'A energia diminui 25% mais devagar.' },
    luck: { name: 'Torta da sorte', emoji: '🥧', minutes: 20, desc: 'Minigames rendem 25% mais moedas.' },
    tea: { name: 'Chá brilhante', emoji: '🍵', minutes: 20, desc: 'Todas as atividades rendem 25% mais XP.' },
    sorbet: { name: 'Sorbete refrescante', emoji: '🍧', minutes: 25, desc: 'Fome e humor diminuem 25% mais devagar.' }
  };

  var DISHES = [
    { id: 'soup', name: 'Sopa da horta', emoji: '🍲', ingredients: { carrot: 2, milk: 1 }, result: 'soup', amount: 2, xp: 14, desc: 'Fome lenta por 30 min.' },
    { id: 'juice', name: 'Suco energético', emoji: '🧃', ingredients: { apple: 2, energy: 1 }, result: 'juice', amount: 2, xp: 14, desc: 'Energia lenta por 30 min.' },
    { id: 'luckpie', name: 'Torta da sorte', emoji: '🥧', ingredients: { milk: 1, apple: 1, cake: 1 }, result: 'luckpie', amount: 1, xp: 18, desc: 'Mais moedas em jogos por 20 min.' },
    { id: 'shineTea', name: 'Chá brilhante', emoji: '🍵', ingredients: { carrot: 1, milk: 1, cookie: 1 }, result: 'shineTea', amount: 2, xp: 18, desc: 'Mais XP por 20 min.' },
    { id: 'sorbetDish', name: 'Sorbete de frutas', emoji: '🍧', ingredients: { icecream: 1, milk: 1, apple: 1 }, result: 'sorbet', amount: 2, xp: 20, desc: 'Fome e humor lentos por 25 min.' }
  ];

  var TRADES = [
    { id: 'tradeCarrot', name: 'Cesta de cenouras', emoji: '🥕', dust: 2, duplicates: 2, result: 'carrot', amount: 5, desc: 'Ótimo para plantar e cozinhar.' },
    { id: 'tradeEnergy', name: 'Kit energético', emoji: '⚡', dust: 3, duplicates: 2, result: 'energy', amount: 2, desc: 'Recupera energia para novas aventuras.' },
    { id: 'tradeCake', name: 'Festa em caixa', emoji: '🍰', dust: 4, duplicates: 3, result: 'cake', amount: 2, desc: 'Dois bolos para comemorar.' },
    { id: 'tradeElixir', name: 'Reserva de emergência', emoji: '🧪', dust: 8, duplicates: 6, result: 'elixir', amount: 1, desc: 'Um elixir para salvar um bichinho crítico.' },
    { id: 'tradeBow', name: 'Enfeite de festa', emoji: '🎀', dust: 5, duplicates: 4, result: 'bow', amount: 1, desc: 'Um laço novo para enfeitar o bichinho.' }
  ];

  var FISH = [
    { id: 'silver', name: 'Peixe prateado', emoji: '🐟', itemId: 'fish', weather: ['feira', 'lua', 'calmo', 'festival'] },
    { id: 'tropical', name: 'Peixe tropical', emoji: '🐠', itemId: 'tropicalfish', weather: ['feira', 'festival', 'lua'] },
    { id: 'puffer', name: 'Baiacu', emoji: '🐡', itemId: 'pufferfish', weather: ['chuva', 'neve'] }
  ];

  var WALKS = [
    { id: 'park', name: 'Parque', emoji: '🌳', desc: 'Um passeio tranquilo, cheio de folhas e borboletas.', cost: 8, minLevel: 1, coins: [4, 10], xp: [4, 9], loot: ['apple', 'ball'], hint: 'Fácil • 8 ⚡' },
    { id: 'forest', name: 'Floresta', emoji: '🌲', desc: 'Trilhas sombrias com cogumelos e surpresas.', cost: 12, minLevel: 3, coins: [8, 16], xp: [8, 14], loot: ['milk', 'carrot', 'soap'], hint: 'Médio • 12 ⚡' },
    { id: 'beach', name: 'Praia', emoji: '🏖️', desc: 'Areia, conchas e um mergulho revigorante.', cost: 16, minLevel: 5, coins: [12, 22], xp: [12, 20], loot: ['sushi', 'cake', 'perfume'], hint: 'Médio • 16 ⚡' },
    { id: 'city', name: 'Cidade', emoji: '🏙️', desc: 'Vitrines, praças e o cheiro de padaria.', cost: 20, minLevel: 8, coins: [18, 30], xp: [18, 28], loot: ['cake', 'piano', 'musicbox'], hint: 'Difícil • 20 ⚡' },
    { id: 'botanic', name: 'Jardim botânico', emoji: '🌷', desc: 'Estufas, borboletas e um cheiro de terra molhada.', cost: 18, minLevel: 6, coins: [14, 24], xp: [14, 22], loot: ['melon', 'icecream', 'towel'], hint: 'Médio • 18 ⚡' }
  ];

  var ENEMIES = [
    { id: 'slime', name: 'Slime', emoji: '🟢', desc: 'Gelatinoso e atrapalhado, mas persistente.', hp: 18, atk: 4, def: 1, coins: 8, xp: 8, minLevel: 1, loot: 'apple' },
    { id: 'rato', name: 'Rato fominha', emoji: '🐀', desc: 'Rápido e faminto. Cuidado com a mordida!', hp: 26, atk: 6, def: 2, coins: 12, xp: 12, minLevel: 3, loot: 'carrot' },
    { id: 'morcego', name: 'Morcego', emoji: '🦇', desc: 'Ataca no escuro e desvia com facilidade.', hp: 34, atk: 8, def: 3, coins: 17, xp: 17, minLevel: 5, loot: 'medicine' },
    { id: 'raposinha', name: 'Raposa travessa', emoji: '🦊', desc: 'Rápida e esperta. Tenta roubar seu laço!', hp: 40, atk: 9, def: 4, coins: 22, xp: 22, minLevel: 6, loot: 'bow' },
    { id: 'golem', name: 'Golem de pedra', emoji: '🗿', desc: 'Lento, mas muito resistente. O chefe da floresta!', hp: 48, atk: 11, def: 5, coins: 28, xp: 30, minLevel: 8, loot: 'elixir', boss: true }
  ];

  function stickerKey(speciesId, stageIndex) {
    return speciesId + ':' + stageIndex;
  }

  var STAGE_STICKER_EMOJIS = ['🥚', '🐣', '🐾', '🌟', '👑', '🕊️'];

  var STICKERS = [];
  SPECIES.forEach(function (species) {
    STAGES.forEach(function (stage, index) {
      STICKERS.push({
        id: stickerKey(species.id, index),
        speciesId: species.id,
        stageIndex: index,
        name: species.name + ' ' + stage.name,
        emoji: species.emoji,
        stageEmoji: STAGE_STICKER_EMOJIS[index],
        stageName: stage.name,
        rare: index >= STAGES.length - 2
      });
    });
  });

  function dealsForDay(date) {
    var index = dayIndex(date);
    return [0, 1, 2].map(function (offset) {
      var item = ITEMS[(index * 3 + offset * 7 + Math.floor(index / 5)) % ITEMS.length];
      var discount = [20, 30, 40][(index + offset) % 3];
      return {
        itemId: item.id,
        discount: discount,
        price: Math.max(1, Math.ceil(item.price * (100 - discount) / 100)),
        stock: 5
      };
    });
  }

  var CHANGES = [
    {
      version: 'v40',
      title: 'Mais amigos e descobertas',
      items: [
        'Duas espécies novas: tartaruga e raposinha.',
        'Sete itens novos, dois pratos, receitas, troca, passeio e batalha inéditos.',
        'Busca na loja, painel de novidades e aviso ao concluir uma atualização.'
      ]
    },
    {
      version: 'v39',
      title: 'Atualização mais esperta',
      items: [
        'Checagem automática ao abrir, voltar ou a cada 10 minutos.',
        'Botão ⬆️ fixo no topo, com destaque quando há nova versão.',
        'Versão exibida em Configurações e Ajuda.'
      ]
    },
    {
      version: 'v38',
      title: 'Aviso de nova versão',
      items: [
        'Faixa de atualização com “Atualizar agora” e “Depois”.',
        'Aplicação da nova versão sem fechar o app.'
      ]
    }
  ];

  global.TamaData = {
    VERSION: 'v40',
    CHANGES: CHANGES,
    STAGES: STAGES,
    SPECIES: SPECIES,
    PERSONALITIES: PERSONALITIES,
    PATHS: PATHS,
    VISITORS: VISITORS,
    ITEMS: ITEMS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    MOODS: MOODS,
    GAMES: GAMES,
    QUESTS: QUESTS,
    WEEKLY_QUESTS: WEEKLY_QUESTS,
    EVENTS: EVENTS,
    RECIPES: RECIPES,
    BUFFS: BUFFS,
    DISHES: DISHES,
    TRADES: TRADES,
    FISH: FISH,
    WALKS: WALKS,
    ENEMIES: ENEMIES,
    STICKERS: STICKERS,
    STAGE_STICKER_EMOJIS: STAGE_STICKER_EMOJIS,
    stickerKey: stickerKey,
    dealsForDay: dealsForDay,
    TUTORIAL: TUTORIAL,
    SPEED_LABELS: SPEED_LABELS,
    CONTRAST_LABELS: CONTRAST_LABELS,
    FONT_LABELS: FONT_LABELS,
    dayIndex: dayIndex,
    CHECKIN_ITEMS: CHECKIN_ITEMS,
    checkinItemForDay: checkinItemForDay,
    WEATHER_QUESTS: WEATHER_QUESTS,
    CROPS: CROPS,
    ROUTINE_OPTIONS: ROUTINE_OPTIONS,
    RANKING_KEYS: RANKING_KEYS,
    questsForDay: questsForDay,
    weekKey: weekKey,
    questsForWeek: questsForWeek,
    eventForDay: eventForDay,
    fishForDay: fishForDay,
    item: function (id) {
      return ITEMS.find(function (item) { return item.id === id; }) || null;
    },
    crop: function (id) {
      return CROPS.find(function (crop) { return crop.id === id; }) || null;
    },
    species: function (id) {
      return SPECIES.find(function (species) { return species.id === id; }) || SPECIES[0];
    },
    personality: function (id) {
      return PERSONALITIES.find(function (personality) { return personality.id === id; }) || PERSONALITIES[0];
    },
    path: function (id) {
      return PATHS.find(function (path) { return path.id === id; }) || null;
    },
    visitor: function (id) {
      return VISITORS.find(function (visitor) { return visitor.id === id; }) || null;
    },
    stage: function (index) {
      return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))];
    },
    walk: function (id) {
      return WALKS.find(function (item) { return item.id === id; }) || null;
    },
    enemy: function (id) {
      return ENEMIES.find(function (item) { return item.id === id; }) || null;
    }
  };
})(window);
