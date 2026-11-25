const assert = require('node:assert/strict');

global.window = global;
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = value; },
  removeItem(key) { delete this.store[key]; }
};

require('../js/data.js');
require('../js/engine.js');
require('../js/ui.js');

const D = global.TamaData;
const E = global.TamaEngine;
const U = global.TamaUI;

function fresh() {
  global.localStorage.store = {};
  const state = E.defaultState();
  E.createPet(state, 'draco', 'Teste');
  return state;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('✓ ' + name);
}

test('catálogo possui espécies, itens, fases e conquistas', () => {
  assert.equal(D.SPECIES.length, 10);
  assert.equal(D.STAGES.length, 6);
  assert.ok(D.ITEMS.length >= 54);
  assert.ok(D.ACHIEVEMENTS.length >= 15);
  assert.equal(D.WALKS.length, 5);
  assert.equal(D.ENEMIES.length, 5);
  assert.equal(D.item('apple').name, 'Maçã');
  assert.ok(D.species('panda').names.length === D.STAGES.length);
  assert.ok(D.species('nuvem').colors.length === 3);
  assert.ok(D.species('tartaruga').names.length === D.STAGES.length);
  assert.ok(D.species('raposa').colors.length === 3);
  assert.ok(D.item('bubbletea'));
  assert.ok(D.item('kite'));
  assert.ok(D.item('headphones'));
  assert.ok(D.item('bookshelf'));
  assert.ok(D.item('melon'));
  assert.ok(D.item('icecream'));
  assert.ok(D.item('sorbet'));
  assert.ok(D.item('towel'));
  assert.ok(D.item('yoyo'));
  assert.ok(D.item('bow'));
  assert.ok(D.item('terrarium'));
});

test('adoção cria ovo com atributos iniciais', () => {
  const state = fresh();
  const pet = E.activePet(state);
  assert.equal(pet.stageIndex, 0);
  assert.equal(pet.name, 'Teste');
  assert.equal(pet.health, 100);
  assert.equal(state.pets.length, 1);
  assert.ok(state.totals.adopted.includes('draco'));
});

test('persistência salva e carrega progresso', () => {
  const state = fresh();
  state.coins = 999;
  assert.equal(E.save(state), true);
  const loaded = E.load();
  assert.equal(loaded.coins, 999);
  assert.equal(loaded.pets[0].name, 'Teste');
});

test('tempo reduz necessidades e aumenta idade', () => {
  const state = fresh();
  const pet = E.activePet(state);
  const before = { hunger: pet.hunger, energy: pet.energy, age: pet.age };
  state.updatedAt = Date.now() - 10 * 60 * 1000;
  E.tick(state, Date.now());
  assert.ok(pet.hunger < before.hunger);
  assert.ok(pet.energy < before.energy);
  assert.ok(pet.age > before.age);
});

test('dormir recarrega energia e desacelera fome', () => {
  const awake = fresh();
  const awakePet = E.activePet(awake);
  awake.updatedAt = Date.now() - 10 * 60 * 1000;
  E.tick(awake, Date.now());
  const awakeHungerLoss = 70 - awakePet.hunger;

  const state = fresh();
  const pet = E.activePet(state);
  E.freeAction(state, 'sleep');
  assert.equal(pet.sleeping, true);
  const before = { hunger: pet.hunger, energy: pet.energy };
  state.updatedAt = Date.now() - 10 * 60 * 1000;
  E.tick(state, Date.now());
  assert.ok(pet.energy > before.energy);
  assert.ok(before.hunger - pet.hunger < awakeHungerLoss);
});

test('evolução exige idade e cuidados', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.age = 11;
  pet.care = 0;
  state.updatedAt = Date.now() - 1000;
  E.tick(state, Date.now());
  assert.equal(pet.stageIndex, 0);
  pet.care = 20;
  state.updatedAt = Date.now() - 1000;
  E.tick(state, Date.now());
  assert.equal(pet.stageIndex, 1);
  assert.equal(E.stageOf(pet).name, 'Bebê');
});

test('compra debita moedas e adiciona inventário', () => {
  const state = fresh();
  const before = state.coins;
  const result = E.buy(state, 'cookie', 2);
  assert.equal(result.ok, true);
  assert.equal(state.inventory.cookie, 2);
  assert.equal(state.coins, before - D.item('cookie').price * 2);
});

test('compra sem moedas é recusada', () => {
  const state = fresh();
  state.coins = 0;
  const result = E.buy(state, 'console');
  assert.equal(result.ok, false);
});

test('usar comida aumenta fome, XP e contador', () => {
  const state = fresh();
  E.buy(state, 'sushi');
  const pet = E.activePet(state);
  const hunger = pet.hunger;
  const result = E.useItem(state, 'sushi');
  assert.equal(result.ok, true);
  assert.equal(result.msg, 'Teste comeu Sushi.');
  assert.ok(pet.hunger > hunger);
  assert.equal(state.totals.feeds, 1);
  assert.ok(pet.xp > 0);
  assert.ok(state.achievements.first_feed);
});

test('item de acessório é equipado e devolvido ao desequipar', () => {
  const state = fresh();
  E.buy(state, 'hat');
  assert.equal(E.useItem(state, 'hat').ok, true);
  assert.equal(E.activePet(state).accessory, 'hat');
  assert.equal(state.inventory.hat, undefined);
  assert.equal(E.unequip(state).ok, true);
  assert.equal(E.activePet(state).accessory, null);
  assert.equal(state.inventory.hat, 1);
});

test('trocar de acessório devolve o anterior para o inventário', () => {
  const state = fresh();
  state.coins = 1000;
  E.buy(state, 'coat');
  E.buy(state, 'gloves');
  assert.equal(E.useItem(state, 'coat').ok, true);
  assert.equal(E.activePet(state).accessory, 'coat');
  assert.equal(state.inventory.coat, undefined);

  const swapped = E.useItem(state, 'gloves');
  assert.equal(swapped.ok, true);
  assert.equal(E.activePet(state).accessory, 'gloves');
  assert.equal(state.inventory.gloves, undefined);
  assert.equal(state.inventory.coat, 1);
  assert.match(swapped.msg, /Casaco pesado voltou para a bolsa/);

  const repeated = E.useItem(state, 'gloves');
  assert.match(repeated.msg, /já está com Luvas/);
  assert.equal(state.inventory.gloves, undefined);
  assert.equal(E.activePet(state).accessory, 'gloves');
});

test('itens de cuidado não exibem mensagem de item inválido', () => {
  const state = fresh();
  E.buy(state, 'soap');
  const result = E.useItem(state, 'soap');
  assert.equal(result.ok, true);
  assert.equal(result.msg, 'Teste usou Sabão.');
  assert.notEqual(result.msg, 'Item inválido.');
});

test('cooldown impede ações gratuitas repetidas', () => {
  const state = fresh();
  assert.equal(E.freeAction(state, 'train').ok, true);
  assert.equal(E.freeAction(state, 'train').ok, false);
});

test('elixir não é gasto em bichinho que não está crítico', () => {
  const state = fresh();
  state.inventory.elixir = 2;
  const pet = E.activePet(state);
  const result = E.useItem(state, 'elixir');
  assert.equal(result.ok, false);
  assert.equal(state.inventory.elixir, 2);
  assert.equal(pet.status, 'alive');
});

test('estado crítico pode ser reanimado com elixir', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.health = 0;
  pet.hunger = 0;
  state.updatedAt = Date.now() - 1000;
  E.tick(state, Date.now());
  assert.equal(pet.status, 'critical');
  assert.equal(E.useItem(state, 'apple').ok, false);
  state.coins = 300;
  assert.equal(E.buy(state, 'elixir').ok, true);
  assert.equal(E.revive(state).ok, true);
  assert.equal(pet.status, 'alive');
  assert.ok(pet.health >= 60);
  assert.ok(state.achievements.revive);
});

test('minigame recompensa com moedas e XP', () => {
  const state = fresh();
  const before = state.coins;
  const reward = E.gameReward(state, 'catch', 12, 16);
  assert.equal(reward.ok, true);
  assert.equal(reward.gameId, 'catch');
  assert.ok(state.coins > before);
  assert.ok(reward.coins >= 8);
  assert.ok(reward.ratio > 0.5);
  assert.equal(state.totals.games, 1);
});

test('exportar e importar progresso preserva estado', () => {
  const state = fresh();
  state.coins = 777;
  const code = E.exportSave(state);
  const imported = E.importSave(code);
  assert.equal(imported.coins, 777);
  assert.equal(imported.pets[0].name, 'Teste');
  assert.equal(E.importSave('codigo-invalido'), null);
});

test('alertas apontam necessidades baixas', () => {
  const state = fresh();
  const pet = E.activePet(state);
  assert.deepEqual(E.getAlerts(pet), []);
  pet.hunger = 5;
  pet.energy = 8;
  assert.equal(E.getAlerts(pet).length, 2);
});

test('humor e nível são calculados a partir dos atributos', () => {
  const state = fresh();
  const pet = E.activePet(state);
  assert.equal(E.calculateMood(pet) > 60, true);
  assert.equal(E.levelFromXp(0), 1);
  assert.ok(E.levelFromXp(1000) > 5);
});

test('missões diárias são geradas, concluídas e recompensadas', () => {
  const state = fresh();
  const daily = E.ensureDaily(state);
  assert.equal(daily.quests.length, 3);
  const quest = daily.quests[0];
  assert.ok(quest.key);
  const coins = state.coins;
  const completed = E.bumpQuest(state, quest.key, quest.target);
  assert.equal(completed.length, 1);
  assert.equal(quest.claimed, true);
  assert.equal(state.coins, coins + quest.reward);
  assert.equal(E.bumpQuest(state, quest.key, 1).length, 0);
});

test('missões diárias mudam no dia seguinte', () => {
  const state = fresh();
  const today = E.ensureDaily(state, new Date('2026-01-01T12:00:00')).date;
  assert.equal(today, '2026-01-01');
  const quests = E.ensureDaily(state, new Date('2026-01-02T12:00:00'));
  assert.equal(quests.date, '2026-01-02');
  assert.equal(quests.quests.length, 3);
  assert.equal(quests.quests.some((quest) => quest.claimed), false);
});

test('doença aparece com risco acumulado e é curada por bandagem', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.hygiene = 0;
  pet.risk = 19.5;
  state.updatedAt = Date.now() - 60 * 1000;
  const events = E.tick(state, Date.now());
  assert.equal(events.sick, true);
  assert.ok(pet.illness);
  assert.ok(E.getAlerts(pet).some((alert) => alert.includes('doente')));
  state.coins = 300;
  assert.equal(E.buy(state, 'bandage').ok, true);
  assert.equal(E.useItem(state, 'bandage').ok, true);
  assert.equal(pet.illness, null);
});

test('decoração é aplicada, removida e devolvida ao inventário', () => {
  const state = fresh();
  state.coins = 500;
  assert.equal(E.buy(state, 'rug').ok, true);
  assert.equal(E.useItem(state, 'rug').ok, true);
  assert.equal(state.activeDecor, 'cozy');
  assert.equal(E.removeDecor(state).ok, true);
  assert.equal(state.activeDecor, null);
  assert.equal(state.inventory.rug, 1);
});

test('decorações sobrevivem ao save e voltam ao trocar', () => {
  const state = fresh();
  state.coins = 1000;
  assert.equal(E.buy(state, 'terrarium').ok, true);
  assert.equal(E.useItem(state, 'terrarium').ok, true);
  assert.equal(state.activeDecor, 'garden');
  E.save(state);
  assert.equal(E.load().activeDecor, 'garden');
  assert.equal(E.buy(state, 'rug').ok, true);
  assert.equal(E.useItem(state, 'rug').ok, true);
  assert.equal(state.activeDecor, 'cozy');
  assert.equal(state.inventory.terrarium, 1);
});

test('slots salvam, listam, carregam e apagam progresso separado', () => {
  const state = fresh();
  state.coins = 4321;
  assert.equal(E.saveSlot(state, 1), true);
  assert.equal(E.listSlots()[0].name, 'Teste');
  state.coins = 1;
  const loaded = E.loadSlot(1);
  assert.equal(loaded.coins, 4321);
  assert.equal(E.deleteSlot(1), true);
  assert.equal(E.loadSlot(1), null);
});

test('sanitização corrige saves corrompidos e rejeita lixo', () => {
  const raw = {
    version: 1,
    coins: -99,
    activeDecor: 'apple',
    inventory: { apple: 'abc', nope: 10 },
    pets: [{
      speciesId: 'inexistente',
      name: 'X'.repeat(80),
      hunger: -50,
      stageIndex: 99,
      illness: { type: 'febre' }
    }]
  };
  const state = E.sanitizeSave(raw);
  assert.equal(state.coins, 0);
  assert.equal(state.pets[0].speciesId, 'draco');
  assert.equal(state.pets[0].name.length, 18);
  assert.equal(state.pets[0].hunger, 0);
  assert.equal(state.pets[0].stageIndex, D.STAGES.length - 1);
  assert.equal(state.activeDecor, null);
  assert.equal(state.inventory.apple, 3);
  assert.equal(state.inventory.nope, undefined);
  assert.equal(E.sanitizeSave({ version: 2, pets: [] }), null);
  assert.equal(E.sanitizeSave(null), null);
});

test('save crítico sem criticalAt recebe timestamp válido', () => {
  const state = E.sanitizeSave({
    version: 1,
    pets: [{ speciesId: 'draco', status: 'critical' }]
  });
  assert.ok(state.pets[0].criticalAt > 0);
  assert.equal(E.sanitizeSave({
    version: 1,
    pets: [{ speciesId: 'draco', status: 'alive' }]
  }).pets[0].criticalAt, null);
});

test('qualidade de cuidado recompensa mais quando todos os status estão altos', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.hunger = 90;
  assert.equal(E.careQuality(pet), 2);
  pet.hunger = 30;
  assert.equal(E.careQuality(pet), 0.5);
  const before = pet.care;
  E.freeAction(state, 'pet');
  assert.equal(pet.care - before, 0.5);
});

test('evento do dia altera recompensa de minigame', () => {
  const state = fresh();
  const reward = E.gameReward(state, 'catch', 16, 16);
  const event = D.eventForDay(new Date());
  const expected = Math.round(50 * ((event.effect && event.effect.coins) || 1));
  assert.equal(reward.coins, expected);
});

test('dia nevado acelera a queda de energia', () => {
  const original = D.eventForDay;
  const cold = { id: 'neve', name: 'Dia nevado', emoji: '❄️', desc: '', effect: { energy: 1.3 } };
  const calm = { id: 'calmo', name: 'Dia calmo', emoji: '☀️', desc: '', effect: {} };
  try {
    D.eventForDay = () => cold;
    const coldState = fresh();
    D.eventForDay = () => calm;
    const calmState = fresh();
    const personalityId = D.PERSONALITIES[0].id;
    E.activePet(coldState).personalityId = personalityId;
    E.activePet(calmState).personalityId = personalityId;
    const now = Date.now();
    coldState.updatedAt = now - 10 * 60 * 1000;
    calmState.updatedAt = now - 10 * 60 * 1000;
    D.eventForDay = () => cold;
    E.tick(coldState, now);
    D.eventForDay = () => calm;
    E.tick(calmState, now);
    assert.ok(D.EVENTS.some((event) => event.id === 'neve' && event.effect.energy > 1));
    assert.ok(E.activePet(coldState).energy < E.activePet(calmState).energy);
  } finally {
    D.eventForDay = original;
  }
});

test('acessórios de frio reduzem o gasto de energia na neve', () => {
  const original = D.eventForDay;
  const snow = { id: 'neve', name: 'Dia nevado', emoji: '❄️', desc: '', effect: { energy: 1.3 } };
  try {
    assert.ok(['scarf', 'gloves', 'boots', 'coat'].every((id) => D.item(id) && D.item(id).warmth > 0));
    D.eventForDay = () => snow;
    const warmState = fresh();
    const warmPet = E.activePet(warmState);
    warmPet.accessory = 'scarf';
    warmState.inventory.scarf = 1;
    const plainState = fresh();
    const plainPet = E.activePet(plainState);
    plainPet.speciesId = warmPet.speciesId;
    plainPet.personalityId = warmPet.personalityId;
    plainPet.path = warmPet.path;
    const now = Date.now();
    warmState.updatedAt = now - 10 * 60 * 1000;
    plainState.updatedAt = now - 10 * 60 * 1000;
    E.tick(warmState, now);
    E.tick(plainState, now);
    assert.ok(warmPet.energy > E.activePet(plainState).energy);
  } finally {
    D.eventForDay = original;
  }
});

test('pet na última fase continua evoluindo sem erro', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.stageIndex = D.STAGES.length - 1;
  pet.age = 1000;
  pet.care = 1000;
  state.updatedAt = Date.now() - 1000;
  const events = E.tick(state, Date.now());
  assert.equal(events.evolved, false);
  assert.equal(pet.stageIndex, D.STAGES.length - 1);
});

test('catálogo possui receitas, tutorial e novas conquistas', () => {
  assert.ok(D.RECIPES.length >= 5);
  assert.ok(D.TUTORIAL.length >= 4);
  assert.equal(D.RECIPES[0].id, 'cake');
  assert.ok(D.ACHIEVEMENTS.length >= 20);
  assert.ok(D.ACHIEVEMENTS.some((item) => item.id === 'streak_7'));
  assert.ok(D.ACHIEVEMENTS.some((item) => item.id === 'crafter'));
});

test('novas receitas e itens entram no inventário e podem ser usados', () => {
  const state = fresh();
  Object.assign(state.inventory, { milk: 2, juice: 2, cookie: 2 });
  const crafted = E.craft(state, 'bubbleRecipe');
  assert.equal(crafted.ok, true);
  assert.ok(state.inventory.bubbletea >= 2);
  const pet = E.activePet(state);
  pet.happiness = 10;
  const used = E.useItem(state, 'bubbletea');
  assert.equal(used.ok, true);
  assert.ok(pet.happiness > 10);
  assert.ok(D.RECIPES.some((recipe) => recipe.id === 'kiteRecipe'));
});

test('conteúdo das versões 40 e 41 está disponível', () => {
  assert.ok(D.RECIPES.some((recipe) => recipe.id === 'melonRecipe'));
  assert.ok(D.RECIPES.some((recipe) => recipe.id === 'bowRecipe'));
  assert.ok(D.DISHES.some((dish) => dish.id === 'sorbetDish'));
  assert.ok(D.BUFFS.sorbet);
  assert.ok(D.TRADES.some((trade) => trade.id === 'tradeBow'));
  assert.ok(D.WALKS.some((walk) => walk.id === 'botanic'));
  assert.ok(D.ENEMIES.some((enemy) => enemy.id === 'raposinha'));
  assert.ok(D.CHANGES.some((change) => change.version === D.VERSION));
});

test('eventos do tick identificam o pet correto', () => {
  const evolving = fresh();
  evolving.pets[0].age = 2;
  evolving.pets[0].care = 10;
  const evolved = E.tick(evolving, Date.now() + 60000);
  assert.equal(evolved.evolvedName, 'Teste');

  const critical = fresh();
  critical.pets[0].hunger = 0;
  critical.pets[0].hygiene = 0;
  critical.pets[0].health = 1;
  const died = E.tick(critical, Date.now() + 60000);
  assert.equal(died.criticalName, 'Teste');
});

test('configurações de acessibilidade e tutorial sobrevivem ao save', () => {
  const state = fresh();
  Object.assign(state.settings, {
    contrast: 'high', fontSize: 'large', reduceMotion: true, visualCues: false
  });
  state.tutorial.done = true;
  state.tutorial.step = 2;
  E.save(state);
  const loaded = E.load();
  assert.equal(loaded.settings.contrast, 'high');
  assert.equal(loaded.settings.fontSize, 'large');
  assert.equal(loaded.settings.reduceMotion, true);
  assert.equal(loaded.settings.visualCues, false);
  assert.equal(loaded.tutorial.done, true);
  assert.equal(loaded.tutorial.step, 2);
});

test('streak diário conta dias seguidos e recompensa sem duplicar', () => {
  const state = fresh();
  const today = Date.now();
  const first = E.checkStreak(state, today);
  assert.equal(first.count, 1);
  assert.equal(first.reward, 20);
  const again = E.checkStreak(state, today);
  assert.equal(again.count, 1);
  assert.equal(again.reward, 0);
  const next = E.checkStreak(state, today + 86400000);
  assert.equal(next.count, 2);
  assert.equal(state.streak.best, 2);
  assert.equal(state.streak.lastDay, D.dayIndex(new Date(today + 86400000)));
});

test('oficina consome ingredientes, cria item e desbloqueia conquista', () => {
  const state = fresh();
  state.inventory = { soap: 1, brush: 1 };
  const result = E.craft(state, 'bandage');
  assert.equal(result.ok, true);
  assert.equal(state.inventory.bandage, 1);
  assert.equal(state.inventory.soap, undefined);
  assert.equal(state.inventory.brush, undefined);
  assert.equal(state.totals.crafted, 1);
  assert.ok(state.achievements.crafter);
  const failed = E.craft(state, 'cake');
  assert.equal(failed.ok, false);
});

test('resumo de estatísticas calcula recordes, médias e sequência', () => {
  const state = fresh();
  const pet = E.activePet(state);
  state.history[pet.id] = [
    { t: 1, hunger: 80, happiness: 60, energy: 90, hygiene: 70, health: 100 },
    { t: 2, hunger: 60, happiness: 40, energy: 70, hygiene: 50, health: 80 }
  ];
  state.streak.best = 5;
  const summary = E.statsSummary(state);
  assert.equal(summary.samples, 2);
  assert.equal(summary.bestStreak, 5);
  assert.equal(summary.records.hunger.max, 80);
  assert.equal(summary.records.hunger.min, 60);
  assert.equal(summary.records.hunger.avg, 70);
});

test('catálogo possui figurinhas, presentes e novas conquistas', () => {
  assert.equal(D.STICKERS.length, D.SPECIES.length * D.STAGES.length);
  assert.equal(D.stickerKey('draco', 0), 'draco:0');
  assert.notEqual(D.STICKERS[0].stageEmoji, D.STICKERS[1].stageEmoji);
  assert.equal(D.STICKERS[0].stageEmoji, '🥚');
  assert.equal(D.item('gift').name, 'Presente surpresa');
  assert.equal(D.dealsForDay().length, 3);
  assert.ok(D.ACHIEVEMENTS.length >= 25);
});

test('aniversário dá bolo, moedas e conquista uma vez por ano', () => {
  const state = fresh();
  const pet = E.activePet(state);
  const today = new Date();
  pet.bornAt = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), 12).getTime();
  const coins = state.coins;
  const names = E.checkBirthdays(state, Date.now());
  assert.deepEqual(names, ['Teste']);
  assert.equal(state.inventory.cake, 1);
  assert.ok(state.coins >= coins + 80);
  assert.ok(state.achievements.birthday);
  assert.equal(E.checkBirthdays(state, Date.now()).length, 0);
});

test('figurinhas duplicadas viram pó e troca revela nova', () => {
  const state = fresh();
  const pet = E.activePet(state);
  assert.ok(state.stickers[D.stickerKey(pet.speciesId, 0)]);
  const first = E.unlockSticker(state, pet.speciesId, 1);
  assert.equal(first.duplicate, false);
  const duplicate = E.unlockSticker(state, pet.speciesId, 1);
  assert.equal(duplicate.duplicate, true);
  assert.equal(state.stickerDust, 1);
  state.stickerDust = 3;
  const exchanged = E.exchangeSticker(state);
  assert.equal(exchanged.ok, true);
  assert.equal(state.stickerDust, 0);
  assert.ok(state.stickers[exchanged.sticker.id]);
});

test('modo foco conclui sessão, recompensa e alterna para pausa', () => {
  const state = fresh();
  const coins = state.coins;
  const start = E.focusStart(state, 1, 'focus');
  assert.equal(start.ok, true);
  const done = E.focusTick(state, state.focus.endsAt + 1000);
  assert.equal(done.completed, true);
  assert.equal(done.coins, 60);
  assert.equal(state.coins, coins + 60);
  assert.equal(state.totals.focus, 1);
  assert.equal(state.focus.mode, 'break');
  E.focusStart(state, 1, 'break');
  const breakDone = E.focusTick(state, state.focus.endsAt + 1000);
  assert.equal(breakDone.coins, 10);
  assert.equal(state.totals.focus, 1);
});

test('ofertas do dia aplicam desconto, estoque e contador', () => {
  const state = fresh();
  state.coins = 1000;
  const deal = D.dealsForDay()[0];
  const item = D.item(deal.itemId);
  assert.ok(deal.price < item.price);
  const result = E.buyDeal(state, deal.itemId, 2);
  assert.equal(result.ok, true);
  assert.equal(state.inventory[deal.itemId], 2);
  assert.equal(state.totals.deals, 2);
  assert.equal(state.deals.bought[deal.itemId], 2);
  const tooMany = E.buyDeal(state, deal.itemId, 6);
  assert.equal(tooMany.ok, false);
});

test('diário ilustrado registra momentos e sobrevive ao save', () => {
  const state = fresh();
  const result = E.addMoment(state, 'Primeiro pulo', 'O ovo começou a chocar!');
  assert.equal(result.ok, true);
  assert.equal(state.moments.length, 1);
  assert.equal(state.moments[0].title, 'Primeiro pulo');
  assert.equal(state.totals.moments, 1);
  E.save(state);
  const loaded = E.load();
  assert.equal(loaded.moments[0].note, 'O ovo começou a chocar!');
  assert.equal(loaded.totals.moments, 1);
});

test('saves antigos recebem figurinhas das fases já alcançadas', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.stageIndex = 2;
  E.save(state);
  const raw = JSON.parse(global.localStorage.getItem(E.STORAGE_KEY));
  delete raw.stickers;
  global.localStorage.setItem(E.STORAGE_KEY, JSON.stringify(raw));
  const loaded = E.load();
  assert.ok(loaded.stickers[D.stickerKey(pet.speciesId, 0)]);
  assert.ok(loaded.stickers[D.stickerKey(pet.speciesId, 1)]);
  assert.ok(loaded.stickers[D.stickerKey(pet.speciesId, 2)]);
  assert.equal(loaded.stickers[D.stickerKey(pet.speciesId, 3)], undefined);
});

test('figurinhas fracionadas são arredondadas ao carregar', () => {
  const state = fresh();
  E.save(state);
  const raw = JSON.parse(global.localStorage.getItem(E.STORAGE_KEY));
  const key = D.stickerKey(E.activePet(state).speciesId, 0);
  raw.stickers[key] = 3.7;
  global.localStorage.setItem(E.STORAGE_KEY, JSON.stringify(raw));
  assert.equal(E.load().stickers[key], 3);
});

test('passeios rendem moedas, XP e sobrevivem ao save', () => {
  const state = fresh();
  const pet = E.activePet(state);
  const coins = state.coins;
  const energy = pet.energy;
  const result = E.goWalk(state, 'park');
  assert.equal(result.ok, true);
  assert.ok(state.coins > coins);
  assert.ok(pet.energy < energy);
  assert.equal(state.totals.walks, 1);
  assert.equal(state.adventure.walks, 1);
  assert.equal(state.adventure.lastWalk, 'park');
  E.save(state);
  assert.equal(E.load().adventure.walks, 1);
});

test('passeio bloqueia nível e energia insuficientes', () => {
  const state = fresh();
  assert.equal(E.goWalk(state, 'city').ok, false);
  const pet = E.activePet(state);
  pet.energy = 1;
  assert.equal(E.goWalk(state, 'park').ok, false);
});

test('batalha termina em vitória com recompensas', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.xp = 2000;
  pet.level = 10;
  pet.discipline = 100;
  const coins = state.coins;
  assert.equal(E.startBattle(state, 'slime').ok, true);
  assert.ok(state.adventure.battle);
  const result = E.battleMove(state, 'attack');
  assert.equal(result.ok, true);
  assert.equal(result.won, true);
  assert.equal(state.adventure.battle, null);
  assert.equal(state.totals.battles, 1);
  assert.equal(state.totals.wins, 1);
  assert.ok(state.coins > coins);
  E.save(state);
  assert.equal(E.load().adventure.wins, 1);
});

test('defender reduz dano e fugir encerra a batalha', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.xp = 200;
  pet.level = 4;
  assert.equal(E.startBattle(state, 'slime').ok, true);
  const hp = state.adventure.battle.hp;
  const defended = E.battleMove(state, 'defend');
  assert.equal(defended.ok, true);
  assert.ok(state.adventure.battle.hp >= hp - 2);
  const fled = E.battleMove(state, 'flee');
  assert.equal(fled.fled, true);
  assert.equal(state.adventure.battle, null);
});

test('sanitização recupera nível e contadores de saves com NaN', () => {
  const state = fresh();
  state.achievements.level_5 = Date.now();
  E.save(state);
  const raw = JSON.parse(global.localStorage.getItem(E.STORAGE_KEY));
  raw.pets[0].xp = null;
  raw.pets[0].level = null;
  raw.totals.earned = null;
  raw.adventure.walks = null;
  global.localStorage.setItem(E.STORAGE_KEY, JSON.stringify(raw));
  const loaded = E.load();
  assert.equal(E.activePet(loaded).level, 5);
  assert.ok(Number.isFinite(loaded.totals.earned));
  assert.equal(loaded.adventure.walks, 0);
  const walked = E.goWalk(loaded, 'park');
  assert.ok(Number.isFinite(walked.coins));
  assert.equal(loaded.adventure.walks, 1);
});

test('usar item em batalha consome cura e mantém o turno', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.xp = 200;
  pet.level = 4;
  state.inventory.apple = 1;
  assert.equal(E.startBattle(state, 'slime').ok, true);
  state.adventure.battle.hp = 10;
  const result = E.battleMove(state, 'item');
  assert.equal(result.ok, true);
  assert.equal(state.inventory.apple, undefined);
  assert.ok(state.adventure.battle && state.adventure.battle.hp > 10);
});

test('contadores de aventura nulos herdam os totais do save', () => {
  const state = fresh();
  state.totals.walks = 3;
  E.save(state);
  const raw = JSON.parse(global.localStorage.getItem(E.STORAGE_KEY));
  raw.adventure.walks = null;
  global.localStorage.setItem(E.STORAGE_KEY, JSON.stringify(raw));
  assert.equal(E.load().adventure.walks, 3);
});

test('missões semanais são geradas e renovadas na nova semana', () => {
  const state = fresh();
  const monday = new Date(2026, 10, 23, 12, 0, 0);
  E.tick(state, monday.getTime());
  assert.equal(state.weekly.week, D.weekKey(monday));
  assert.equal(state.weekly.quests.length, 3);
  const first = state.weekly.quests.map((quest) => quest.id).join(',');
  assert.equal(D.questsForWeek(monday).map((quest) => quest.id).join(','), first);
  const nextMonday = new Date(monday.getTime());
  nextMonday.setDate(nextMonday.getDate() + 7);
  E.tick(state, nextMonday.getTime());
  assert.equal(state.weekly.week, D.weekKey(nextMonday));
  assert.equal(state.weekly.quests[0].progress, 0);
});

test('missão semanal conclui, recompensa e registra cuidados no calendário', () => {
  const state = fresh();
  state.weekly = {
    week: D.weekKey(new Date()),
    quests: [{ id: 'w-test', key: 'feed', target: 2, reward: 100, emoji: '🍎', name: 'Teste semanal', progress: 0, claimed: false }]
  };
  const before = state.coins;
  E.bumpQuest(state, 'feed', 2);
  assert.equal(state.weekly.quests[0].claimed, true);
  assert.equal(state.coins, before + 100);
  const today = new Date();
  const key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  assert.equal(state.careCalendar[key].feed, 2);
  E.save(state);
  assert.equal(E.load().careCalendar[key].feed, 2);
});

test('horários de lembrete sobrevivem ao save e validam formato', () => {
  const state = fresh();
  state.settings.notifications = true;
  state.settings.reminderMorning = '07:30';
  state.settings.reminderEvening = '25:99';
  E.save(state);
  const loaded = E.load();
  assert.equal(loaded.settings.notifications, true);
  assert.equal(loaded.settings.reminderMorning, '07:30');
  assert.equal(loaded.settings.reminderEvening, '20:00');
});

test('foco com tarefa registra minuto diário e momento no diário', () => {
  const state = fresh();
  E.focusStart(state, 25, 'focus', 'estudar português');
  const result = E.focusTick(state, state.focus.endsAt + 1000);
  assert.equal(result.completed, true);
  assert.equal(result.task, 'estudar português');
  const today = new Date();
  const key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  assert.equal(state.focusLog[key], 25);
  assert.match(state.moments[0].title, /estudar português/);
  assert.equal(state.totals.focus, 1);
});

test('personalidade altera humor e velocidade de necessidades', () => {
  const curious = fresh();
  const sleepy = fresh();
  E.activePet(curious).personalityId = 'curioso';
  E.activePet(sleepy).personalityId = 'dorminhoco';
  assert.ok(E.calculateMood(E.activePet(curious)) > E.calculateMood(E.activePet(sleepy)) + 0);
  const timestamp = Date.now() + 20 * 60000;
  E.tick(sleepy, timestamp);
  E.tick(curious, timestamp);
  assert.ok(E.activePet(sleepy).energy > E.activePet(curious).energy);
});

test('caminho adulto dá bônus, conquista e nome especial', () => {
  const state = fresh();
  const pet = E.activePet(state);
  pet.stageIndex = 4;
  const result = E.choosePath(state, 'sabio');
  assert.equal(result.ok, true);
  assert.equal(pet.path, 'sabio');
  assert.match(E.displayName(pet), /Sábio/);
  assert.ok(state.achievements.path_chosen);
  assert.equal(E.choosePath(state, 'guardiao').ok, false);
});

test('visitantes aleatórios deixam recompensa e viram memória', () => {
  const state = fresh();
  state.createdAt = Date.now() - 2 * 60 * 60000;
  state.lastVisitAt = Date.now() - 8 * 60 * 60000;
  const result = E.checkVisitors(state, Date.now(), 0);
  assert.ok(result);
  assert.ok(D.VISITORS.some((visitor) => visitor.id === result.visitor.id));
  assert.equal(state.totals.visits, 1);
  assert.ok(result.notes.length > 0);
  assert.match(state.moments[0].title, /Visita/);
  assert.ok(state.achievements.visitor_1);
});

test('neve reduz recompensas de passeio', () => {
  const original = D.eventForDay;
  try {
    const snow = fresh();
    const normal = fresh();
    [snow, normal].forEach((state) => {
      const pet = E.activePet(state);
      pet.level = 5;
      pet.energy = 100;
    });
    D.eventForDay = () => ({ id: 'neve', effect: { walk: 0.75 } });
    const snowResult = E.goWalk(snow, 'park');
    D.eventForDay = () => ({ id: 'feira', effect: {} });
    const normalResult = E.goWalk(normal, 'park');
    assert.equal(snowResult.ok, true);
    assert.equal(normalResult.ok, true);
    assert.ok(snowResult.coins < normalResult.coins);
    assert.ok(snowResult.xp < normalResult.xp);
  } finally {
    D.eventForDay = original;
  }
});

test('chuva reduz dano em batalhas', () => {
  const original = D.eventForDay;
  const fair = () => ({ id: 'feira', effect: {} });
  const rainy = () => ({ id: 'chuva', effect: { battle: 0.85 } });
  try {
    const prepare = () => {
      const state = fresh();
      const pet = E.activePet(state);
      pet.level = 5;
      pet.energy = 100;
      pet.discipline = 60;
      return state;
    };
    const normal = prepare();
    const rain = prepare();
    D.eventForDay = fair;
    assert.equal(E.startBattle(normal, 'morcego').ok, true);
    D.eventForDay = rainy;
    assert.equal(E.startBattle(rain, 'morcego').ok, true);
    const normalHp = normal.adventure.battle.enemyHp;
    const rainHp = rain.adventure.battle.enemyHp;
    D.eventForDay = fair;
    E.battleMove(normal, 'attack');
    D.eventForDay = rainy;
    E.battleMove(rain, 'attack');
    assert.ok(rainHp - rain.adventure.battle.enemyHp < normalHp - normal.adventure.battle.enemyHp);
  } finally {
    D.eventForDay = original;
  }
});

test('missão diária acompanha o clima do dia', () => {
  const original = D.eventForDay;
  try {
    D.eventForDay = () => ({ id: 'neve', name: 'Dia nevado', emoji: '❄️', desc: 'Neve', effect: { energy: 1.3 } });
    const quests = D.questsForDay(new Date('2026-01-01T12:00:00'));
    assert.equal(quests.length, 3);
    assert.match(quests[0].id, /^q-neve-/);
    assert.equal(quests[0].key, 'walk');
    assert.equal(quests[0].weather, 'neve');
    assert.equal(new Set(quests.map((quest) => quest.key)).size, 3);
  } finally {
    D.eventForDay = original;
  }
});

test('save antigo recebe missão climática sem trocar de dia', () => {
  const original = D.eventForDay;
  try {
    D.eventForDay = () => ({ id: 'neve', name: 'Dia nevado', emoji: '❄️', desc: '', effect: { energy: 1.3 } });
    const state = fresh();
    state.daily = {
      date: '2026-01-01',
      quests: [{ id: 'legado', key: 'feed', target: 3, reward: 60, emoji: '🍎', name: 'Missão antiga', progress: 1, claimed: false }]
    };
    const daily = E.ensureDaily(state, new Date('2026-01-01T12:00:00'));
    assert.equal(daily.date, '2026-01-01');
    assert.equal(daily.quests[0].weather, 'neve');
    assert.equal(daily.quests[0].key, 'walk');
  } finally {
    D.eventForDay = original;
  }
});

test('tema automático alterna entre dia e noite conforme a hora', () => {
  const state = { settings: { theme: 'auto' } };
  assert.equal(U.themeInfo(state, new Date(2026, 0, 1, 12, 0)).night, false);
  assert.equal(U.themeInfo(state, new Date(2026, 0, 1, 18, 0)).night, true);
  assert.equal(U.themeInfo(state, new Date(2026, 0, 1, 5, 59)).night, true);
  assert.equal(U.themeInfo(state, new Date(2026, 0, 1, 6, 0)).night, false);
  assert.equal(U.themeInfo({ settings: { theme: 'day' } }, new Date(2026, 0, 1, 23, 0)).night, false);
  assert.equal(U.themeInfo({ settings: { theme: 'night' } }, new Date(2026, 0, 1, 12, 0)).night, true);
});

test('check-in diário entrega um item uma vez por dia', () => {
  const state = fresh();
  const day = new Date(2026, 1, 10, 12, 0);
  const expected = D.checkinItemForDay(day);
  const before = state.inventory[expected] || 0;
  const first = E.dailyCheckin(state, day);
  assert.equal(first.ok, true);
  assert.equal(first.itemId, expected);
  assert.equal(state.inventory[expected], before + 1);
  assert.equal(state.totals.checkins, 1);
  assert.equal(E.dailyCheckin(state, day).ok, false);
  assert.equal(state.inventory[expected], before + 1);
  assert.equal(E.dailyCheckin(state, new Date(2026, 1, 11, 12, 0)).ok, true);
  assert.equal(state.totals.checkins, 2);
});

test('check-in do dia sobrevive ao save', () => {
  const state = fresh();
  const day = new Date(2026, 1, 10, 12, 0);
  E.dailyCheckin(state, day);
  const loaded = E.importSave(E.exportSave(state));
  assert.equal(loaded.daily.checkin.itemId, D.checkinItemForDay(day));
  assert.equal(E.dailyCheckin(loaded, day).ok, false);
});

test('horta planta, rega e colhe com tempo reduzido', () => {
  const state = fresh();
  const start = new Date(2026, 2, 1, 8, 0).getTime();
  const crop = D.crop('carrot');
  const coins = state.coins;
  assert.equal(E.plantCrop(state, 'carrot', 0, start).ok, true);
  assert.equal(state.coins, coins - crop.cost);
  assert.equal(E.cropStatus(state.garden.plots[0], start).ready, false);
  assert.equal(E.waterCrop(state, 0, start).ok, true);
  const readyAt = state.garden.plots[0].readyAt;
  assert.equal(readyAt, start + Math.round(crop.minutes * 30000));
  assert.equal(E.harvestCrop(state, 0, readyAt - 1).ok, false);
  const before = state.inventory.carrot || 0;
  const harvest = E.harvestCrop(state, 0, readyAt);
  assert.equal(harvest.ok, true);
  assert.equal(state.inventory.carrot, before + crop.amount);
  assert.equal(state.garden.plots[0], null);
  assert.equal(state.garden.harvested, 1);
});

test('horta e rotina sobrevivem ao save', () => {
  const state = fresh();
  const start = new Date(2026, 2, 1, 8, 0).getTime();
  E.plantCrop(state, 'apple', 1, start);
  state.routine.feed = '07:30';
  const loaded = E.importSave(E.exportSave(state));
  assert.equal(loaded.garden.plots[1].cropId, 'apple');
  assert.equal(loaded.routine.feed, '07:30');
  assert.equal(E.nextRoutine(loaded, new Date(2026, 2, 1, 6, 0)).time, '07:30');
});

test('ranking semanal pontua ações e mantém recordes entre semanas', () => {
  const state = fresh();
  const thisWeek = new Date(2026, 2, 2, 12, 0).getTime();
  const nextWeek = new Date(2026, 2, 9, 12, 0).getTime();
  E.bumpQuest(state, 'feed', 3);
  assert.equal(E.ensureRanking(state).scores.feed, 3);
  E.bumpRanking(state, 'feed', 3, thisWeek);
  E.bumpRanking(state, 'checkin', 1, thisWeek);
  const ranking = E.ensureRanking(state, thisWeek);
  assert.equal(ranking.scores.feed, 3);
  assert.equal(ranking.scores.checkin, 1);
  assert.equal(ranking.best.feed, 3);
  E.ensureRanking(state, nextWeek);
  assert.equal(state.ranking.scores.feed, 0);
  assert.equal(state.ranking.best.feed, 3);
});

test('cozinha cria pratos e comer ativa buff por tempo limitado', () => {
  const state = fresh();
  const pet = E.activePet(state);
  state.inventory.carrot = 2;
  state.inventory.milk = 1;
  const cooked = E.cook(state, 'soup');
  assert.equal(cooked.ok, true);
  assert.equal(state.inventory.soup, 2);
  assert.equal(state.inventory.carrot, undefined);
  assert.equal(state.totals.cooked, 2);
  const used = E.useItem(state, 'soup');
  assert.equal(used.ok, true);
  assert.match(used.msg, /Sopa da horta ativo/);
  assert.equal(E.activeBuffs(state).length, 1);
  assert.equal(E.buffFactor(state, 'hunger'), 0.75);
  assert.equal(E.buffFactor(state, 'energy'), 1);
  assert.ok(pet.care >= 0);
});

test('sorbete ativa buff de fome e humor', () => {
  const state = fresh();
  state.inventory.icecream = 1;
  state.inventory.milk = 1;
  state.inventory.apple = 1;
  const cooked = E.cook(state, 'sorbetDish');
  assert.equal(cooked.ok, true);
  assert.equal(state.inventory.sorbet, 2);
  const used = E.useItem(state, 'sorbet');
  assert.equal(used.ok, true);
  assert.ok(state.buffs.sorbet > Date.now());
  assert.equal(E.buffFactor(state, 'hunger'), 0.75);
  assert.equal(E.buffFactor(state, 'happiness'), 0.75);
});

test('chá amplifica XP e torta da sorte amplifica moedas de minigame', () => {
  const plainXp = fresh();
  const tea = fresh();
  tea.buffs.tea = Date.now() + 60000;
  const plainPet = E.activePet(plainXp);
  const teaPet = E.activePet(tea);
  E.addXp(plainXp, plainPet, 20);
  E.addXp(tea, teaPet, 20);
  assert.equal(plainPet.xp, 20);
  assert.equal(teaPet.xp, 25);

  const plainCoins = fresh();
  const lucky = fresh();
  lucky.buffs.luck = Date.now() + 60000;
  const normalReward = E.gameReward(plainCoins, 'catch', 16, 16);
  const luckyReward = E.gameReward(lucky, 'catch', 16, 16);
  assert.ok(luckyReward.coins > normalReward.coins);
});

test('mercado troca pó e duplicatas por itens sem perder figurinhas únicas', () => {
  const state = fresh();
  const pet = E.activePet(state);
  const key = D.stickerKey(pet.speciesId, 0);
  state.stickers[key] = 4;
  state.stickerDust = 2;
  assert.equal(E.duplicateStickers(state), 3);
  const traded = E.tradeItem(state, 'tradeCarrot');
  assert.equal(traded.ok, true);
  assert.equal(state.inventory.carrot, 5);
  assert.equal(state.stickerDust, 0);
  assert.equal(state.stickers[key], 2);
  assert.equal(E.duplicateStickers(state), 1);
  assert.equal(state.totals.trades, 1);
});

test('pesca rende peixes do clima e conta nos totais', () => {
  const state = fresh();
  const reward = E.gameReward(state, 'fish', 16, 18);
  assert.equal(reward.ok, true);
  assert.ok(reward.loot);
  assert.equal(state.totals.fished, reward.loot.amount);
  assert.ok(state.inventory[reward.loot.itemId] >= reward.loot.amount);
  const available = D.fishForDay(new Date());
  assert.ok(available.some((fish) => fish.itemId === reward.loot.itemId));
});

test('buffs e novos contadores sobrevivem ao save', () => {
  const state = fresh();
  const endsAt = Date.now() + 60000;
  state.buffs.soup = endsAt;
  state.totals.cooked = 3;
  state.totals.trades = 2;
  state.totals.fished = 4;
  const loaded = E.importSave(E.exportSave(state));
  assert.equal(loaded.buffs.soup, endsAt);
  assert.equal(loaded.totals.cooked, 3);
  assert.equal(loaded.totals.trades, 2);
  assert.equal(loaded.totals.fished, 4);
  assert.equal(E.activeBuffs(loaded).length, 1);
});

console.log('\n' + passed + ' testes passaram.');
