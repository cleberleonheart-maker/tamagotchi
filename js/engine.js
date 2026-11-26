(function (global) {
  'use strict';

  var DATA = global.TamaData;
  var STORAGE_KEY = 'tamavida.save.v1';
  var AUTO_BACKUP_KEY = 'tamavida.autoBackup.v1';
  var MAX_AGE_MINUTES_PER_TICK = 720;
  var MAX_PETS = 4;

  function now() { return Date.now(); }
  function clamp(value, min, max) {
    var parsed = Number(value);
    if (!isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
  }
  function uid() { return 'p' + now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function decorItemFor(key) {
    if (!key) return null;
    return DATA.ITEMS.find(function (item) { return item.type === 'decor' && item.decor === key; }) || null;
  }

  function ensureDaily(state, timestamp) {
    var key = dateKey(new Date(timestamp || now()));
    if (!state.daily || state.daily.date !== key) {
      state.daily = { date: key, quests: DATA.questsForDay(new Date(timestamp || now())), checkin: null };
    } else if (state.daily.quests.some(function (quest) { return typeof quest.weather === 'undefined'; })) {
      state.daily.quests.forEach(function (quest) {
        if (typeof quest.weather === 'undefined') quest.weather = null;
      });
      if (!state.daily.quests.some(function (quest) { return quest.weather; })) {
        var index = state.daily.quests.findIndex(function (quest) { return !quest.claimed; });
        if (index < 0) index = 0;
        state.daily.quests[index] = DATA.questsForDay(new Date(timestamp || now()))[0];
      }
    }
    return state.daily;
  }

  function ensureWeekly(state, timestamp) {
    var key = DATA.weekKey(new Date(timestamp || now()));
    if (!state.weekly || state.weekly.week !== key) {
      state.weekly = { week: key, quests: DATA.questsForWeek(new Date(timestamp || now())) };
    }
    return state.weekly;
  }

  function checkStreak(state, timestamp) {
    if (!state.streak) state.streak = { count: 0, best: 0, lastDay: 0, claimed: [] };
    var streak = state.streak;
    var day = DATA.dayIndex(new Date(timestamp || now()));
    if (streak.lastDay === day) return { count: streak.count, reward: 0 };
    streak.count = streak.lastDay === day - 1 ? streak.count + 1 : 1;
    streak.lastDay = day;
    streak.best = Math.max(streak.best, streak.count);
    var reward = streak.count % 7 === 0 ? 150 : streak.count % 5 === 0 ? 100 : streak.count % 3 === 0 ? 60 : 20;
    var key = day + ':' + streak.count;
    if (streak.claimed.indexOf(key) !== -1) return { count: streak.count, reward: 0 };
    streak.claimed.push(key);
    if (streak.claimed.length > 40) streak.claimed.shift();
    state.coins += reward;
    state.totals.earned += reward;
    addLog(state, 'Sequência de ' + streak.count + ' dia(s)! +' + reward + ' 🪙', 'good');
    return { count: streak.count, reward: reward };
  }

  function dailyCheckin(state, timestamp) {
    var daily = ensureDaily(state, timestamp);
    if (daily.checkin) return { ok: false, msg: 'Você já fez check-in hoje. Volte amanhã! 🎁', item: null };
    var itemId = DATA.checkinItemForDay(new Date(timestamp || now()));
    var item = DATA.item(itemId);
    if (!item) return { ok: false, msg: 'Item de check-in indisponível.', item: null };
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    state.totals.checkins = (state.totals.checkins || 0) + 1;
    bumpRanking(state, 'checkin', 1);
    daily.checkin = { itemId: itemId, at: now() };
    addLog(state, '🎁 Check-in diário: ganhou ' + item.emoji + ' ' + item.name + '.', 'good');
    return { ok: true, msg: '🎁 Check-in: +1 ' + item.name + ' ' + item.emoji, item: item, itemId: itemId };
  }

  function ensureGarden(state, timestamp) {
    var time = timestamp || now();
    if (!state.garden || !Array.isArray(state.garden.plots)) {
      state.garden = { plots: [null, null, null, null], harvested: 0, rainedOn: '' };
    }
    while (state.garden.plots.length < 4) state.garden.plots.push(null);
    state.garden.plots = state.garden.plots.slice(0, 4).map(function (plot) {
      if (!plot || !DATA.crop(plot.cropId)) return null;
      return {
        cropId: String(plot.cropId).slice(0, 20),
        plantedAt: num(plot.plantedAt, time, 0, Date.now() + 86400000),
        wateredAt: plot.wateredAt ? num(plot.wateredAt, time, 0, Date.now() + 86400000) : null,
        readyAt: num(plot.readyAt, time, 0, Date.now() + 86400000 + 86400000)
      };
    });
    state.garden.harvested = Math.floor(num(state.garden.harvested, 0, 0, 1000000000));
    if (typeof state.garden.rainedOn !== 'string') state.garden.rainedOn = '';
    return state.garden;
  }

  function ensureRoutine(state) {
    if (!state.routine || typeof state.routine !== 'object' || Array.isArray(state.routine)) state.routine = {};
    DATA.ROUTINE_OPTIONS.forEach(function (option) {
      state.routine[option.key] = validTime(state.routine[option.key], option.default);
    });
    return state.routine;
  }

  function ensureRanking(state, timestamp) {
    var key = DATA.weekKey(new Date(timestamp || now()));
    if (!state.ranking || state.ranking.week !== key) {
      var best = state.ranking && state.ranking.best && typeof state.ranking.best === 'object' ? state.ranking.best : {};
      state.ranking = { week: key, scores: {}, best: best };
    }
    if (!state.ranking.scores || typeof state.ranking.scores !== 'object') state.ranking.scores = {};
    if (!state.ranking.best || typeof state.ranking.best !== 'object') state.ranking.best = {};
    DATA.RANKING_KEYS.forEach(function (key2) {
      state.ranking.scores[key2] = Math.floor(num(state.ranking.scores[key2], 0, 0, 1000000000));
      state.ranking.best[key2] = Math.floor(num(state.ranking.best[key2], 0, 0, 1000000000));
    });
    return state.ranking;
  }

  function bumpRanking(state, key, amount, timestamp) {
    var ranking = ensureRanking(state, timestamp);
    if (DATA.RANKING_KEYS.indexOf(key) === -1) return;
    var value = Math.floor(num(amount, 0, 0, 1000000));
    if (!value) return;
    ranking.scores[key] += value;
    ranking.best[key] = Math.max(ranking.best[key], ranking.scores[key]);
  }

  function cropStatus(plot, time) {
    if (!plot) return null;
    var crop = DATA.crop(plot.cropId);
    if (!crop) return null;
    var ready = time >= plot.readyAt;
    var total = Math.max(1, plot.readyAt - plot.plantedAt);
    var progress = ready ? 1 : clamp((time - plot.plantedAt) / total, 0, 1);
    return { crop: crop, ready: ready, progress: progress, remaining: Math.max(0, plot.readyAt - time), watered: !!plot.wateredAt };
  }

  function plantCrop(state, cropId, plotIndex, timestamp) {
    var crop = DATA.crop(cropId);
    var garden = ensureGarden(state, timestamp);
    var index = Number(plotIndex);
    var time = timestamp || now();
    if (!crop) return { ok: false, msg: 'Semente desconhecida.', crop: null };
    if (index < 0 || index >= garden.plots.length || Math.floor(index) !== index) return { ok: false, msg: 'Vaga inválida na horta.', crop: crop };
    if (garden.plots[index]) return { ok: false, msg: 'Essa vaga já está plantada.', crop: crop };
    if (state.coins < crop.cost) return { ok: false, msg: 'Faltam moedas para plantar ' + crop.name + ' 🪙', crop: crop };
    state.coins -= crop.cost;
    garden.plots[index] = {
      cropId: crop.id,
      plantedAt: time,
      wateredAt: null,
      readyAt: time + crop.minutes * 60000
    };
    addLog(state, '🌱 Plantou ' + crop.name + ' na horta. Colhe em ' + crop.minutes + ' min.', 'good');
    return { ok: true, msg: '🌱 ' + crop.name + ' plantada! Colhe em ' + crop.minutes + ' min.', crop: crop };
  }

  function waterCrop(state, plotIndex, timestamp) {
    var garden = ensureGarden(state, timestamp);
    var index = Number(plotIndex);
    var time = timestamp || now();
    var plot = garden.plots[index];
    if (!plot) return { ok: false, msg: 'Não há nada para regar aqui.' };
    var crop = DATA.crop(plot.cropId);
    if (time >= plot.readyAt) return { ok: false, msg: 'Já está na hora de colher!' };
    if (plot.wateredAt) return { ok: false, msg: 'Essa planta já foi regada.' };
    plot.wateredAt = time;
    plot.readyAt = Math.max(time, plot.readyAt - Math.round(crop.minutes * 30000));
    addLog(state, '💧 Regou ' + crop.name + ' na horta.', 'good');
    return { ok: true, msg: '💧 ' + crop.name + ' regada! Cresceu mais rápido.', crop: crop };
  }

  function harvestCrop(state, plotIndex, timestamp) {
    var garden = ensureGarden(state, timestamp);
    var index = Number(plotIndex);
    var time = timestamp || now();
    var plot = garden.plots[index];
    if (!plot) return { ok: false, msg: 'Essa vaga está vazia.', item: null };
    var crop = DATA.crop(plot.cropId);
    if (time < plot.readyAt) return { ok: false, msg: 'Ainda não está na hora de colher.', item: null };
    state.inventory[crop.itemId] = (state.inventory[crop.itemId] || 0) + crop.amount;
    garden.harvested += 1;
    garden.plots[index] = null;
    var item = DATA.item(crop.itemId);
    addLog(state, '🌾 Colheu ' + crop.amount + 'x ' + item.name + ' ' + item.emoji + ' da horta.', 'good');
    return { ok: true, msg: '🌾 Colheu ' + crop.amount + 'x ' + item.name + ' ' + item.emoji, item: item, itemId: crop.itemId, amount: crop.amount };
  }

  function rainGarden(state, timestamp, event) {
    if (!event || event.id !== 'chuva') return false;
    var garden = ensureGarden(state, timestamp);
    var key = dateKey(new Date(timestamp || now()));
    if (garden.rainedOn === key) return false;
    garden.rainedOn = key;
    var time = timestamp || now();
    var changed = false;
    garden.plots.forEach(function (plot) {
      if (!plot || plot.wateredAt || time >= plot.readyAt) return;
      var crop = DATA.crop(plot.cropId);
      plot.wateredAt = time;
      plot.readyAt = Math.max(time, plot.readyAt - Math.round(crop.minutes * 30000));
      changed = true;
    });
    return changed;
  }

  function routineEntries(state, timestamp) {
    var routine = ensureRoutine(state);
    var base = new Date(timestamp || now());
    return DATA.ROUTINE_OPTIONS.map(function (option) {
      var match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(routine[option.key] || '');
      if (!match) return null;
      return {
        key: option.key,
        label: option.label,
        emoji: option.emoji,
        time: routine[option.key],
        at: new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(match[1]), Number(match[2]), 0, 0).getTime()
      };
    }).filter(Boolean);
  }

  function nextRoutine(state, timestamp) {
    var time = timestamp || now();
    var entries = routineEntries(state, time).map(function (entry) {
      if (entry.at <= time) entry.at += 86400000;
      return entry;
    });
    entries.sort(function (a, b) { return a.at - b.at; });
    return entries[0] || null;
  }

  function checkBirthdays(state, timestamp) {
    var time = timestamp || now();
    var date = new Date(time);
    var celebrating = [];
    state.pets.forEach(function (pet) {
      if (pet.status === 'gone' || !pet.bornAt) return;
      var born = new Date(pet.bornAt);
      if (born.getMonth() !== date.getMonth() || born.getDate() !== date.getDate()) return;
      if (pet.lastBirthday === date.getFullYear()) return;
      if (time - pet.bornAt < 20 * 60 * 60 * 1000) return;
      pet.lastBirthday = date.getFullYear();
      state.inventory.cake = (state.inventory.cake || 0) + 1;
      state.coins += 80;
      state.totals.earned += 80;
      state.totals.gifts += 1;
      pet.happiness = clamp(pet.happiness + 18, 0, 100);
      pet.message = 'É o meu aniversário! 🎂';
      addLog(state, '🎂 Feliz aniversário, ' + pet.name + '! Ganhou bolo e +80 🪙.', 'achievement');
      celebrating.push(pet.name);
    });
    if (celebrating.length) checkAchievements(state, activePet(state));
    return celebrating;
  }

  function activeBuffs(state, timestamp) {
    var time = timestamp || now();
    var result = [];
    Object.keys(state.buffs || {}).forEach(function (id) {
      var buff = DATA.BUFFS[id];
      var endsAt = state.buffs[id];
      if (buff && endsAt > time) {
        result.push({
          id: id,
          name: buff.name,
          emoji: buff.emoji,
          endsAt: endsAt,
          remaining: Math.ceil((endsAt - time) / 60000)
        });
      }
    });
    return result;
  }

  function applyBuff(state, buffId, minutes, timestamp) {
    var buff = DATA.BUFFS[buffId];
    if (!buff || !state) return null;
    var endsAt = (timestamp || now()) + Math.max(1, minutes || buff.minutes) * 60000;
    state.buffs[buffId] = endsAt;
    return { id: buffId, name: buff.name, emoji: buff.emoji, endsAt: endsAt };
  }

  function buffFactor(state, key, timestamp) {
    var time = timestamp || now();
    var buffs = state.buffs || {};
    if (key === 'hunger' && buffs.soup > time && buffs.sorbet > time) return 0.5625;
    if (key === 'hunger' && (buffs.soup > time || buffs.sorbet > time)) return 0.75;
    if (key === 'happiness' && buffs.sorbet > time) return 0.75;
    if (key === 'energy' && buffs.juice > time) return 0.75;
    return 1;
  }

  function duplicateStickers(state) {
    return Object.keys(state.stickers || {}).reduce(function (total, id) {
      return total + Math.max(0, state.stickers[id] - 1);
    }, 0);
  }

  function unlockSticker(state, speciesId, stageIndex) {
    var sticker = DATA.STICKERS.find(function (item) {
      return item.id === DATA.stickerKey(speciesId, stageIndex);
    });
    if (!sticker) return { ok: false, msg: 'Figurinha inválida.' };
    if (state.stickers[sticker.id]) {
      state.stickers[sticker.id] += 1;
      state.stickerDust += 1;
      return { ok: true, duplicate: true, sticker: sticker, msg: 'Figurinha repetida! +1 pó de figurinha.' };
    }
    state.stickers[sticker.id] = 1;
    checkAchievements(state, activePet(state));
    return { ok: true, duplicate: false, sticker: sticker, msg: 'Nova figurinha: ' + sticker.name + '!' };
  }

  function exchangeSticker(state) {
    if (state.stickerDust < 3) return { ok: false, msg: 'Você precisa de 3 pó de figurinha.' };
    var missing = DATA.STICKERS.filter(function (sticker) { return !state.stickers[sticker.id]; });
    if (!missing.length) return { ok: false, msg: 'Álbum completo. Parabéns!' };
    state.stickerDust -= 3;
    var sticker = missing[Math.floor(Math.random() * missing.length)];
    state.stickers[sticker.id] = 1;
    checkAchievements(state, activePet(state));
    addLog(state, 'Trocou pó por figurinha: ' + sticker.name + '.', 'good');
    return { ok: true, sticker: sticker, msg: 'Figurinha trocada: ' + sticker.name + '!' };
  }

  function tradeItem(state, offerId) {
    var offer = DATA.TRADES.find(function (entry) { return entry.id === offerId; });
    if (!offer) return { ok: false, msg: 'Oferta inválida.' };
    var duplicates = duplicateStickers(state);
    if (state.stickerDust < offer.dust || duplicates < offer.duplicates) {
      return { ok: false, msg: 'Faltam recursos: ' + offer.dust + '✨ e ' + offer.duplicates + ' duplicatas.' };
    }
    state.stickerDust -= offer.dust;
    var needed = offer.duplicates;
    Object.keys(state.stickers || {}).sort(function (a, b) {
      return state.stickers[b] - state.stickers[a];
    }).forEach(function (id) {
      if (needed <= 0) return;
      var spend = Math.min(needed, state.stickers[id] - 1);
      if (spend <= 0) return;
      state.stickers[id] -= spend;
      needed -= spend;
    });
    state.inventory[offer.result] = (state.inventory[offer.result] || 0) + offer.amount;
    state.totals.trades += 1;
    var item = DATA.item(offer.result);
    addLog(state, 'Mercado: trocou duplicatas por ' + offer.amount + 'x ' + item.name + '.', 'good');
    checkAchievements(state, activePet(state));
    return { ok: true, msg: 'Trocado por ' + offer.amount + 'x ' + item.name + ' ' + item.emoji + '!' };
  }

  function choosePath(state, pathId) {
    var path = DATA.path(pathId);
    var pet = activePet(state);
    if (!path || !pet || !petStageAllowsPath(pet.stageIndex)) return { ok: false, msg: 'Escolha o caminho só na fase adulta.' };
    if (pet.path) return { ok: false, msg: 'Este bichinho já escolheu seu caminho.' };
    pet.path = path.id;
    Object.keys(path.stats || {}).forEach(function (key) {
      pet[key] = clamp(pet[key] + path.stats[key], 0, 100);
    });
    state.coins += path.coins;
    state.totals.earned += path.coins;
    addXp(state, pet, path.xp);
    pet.message = 'Agora eu sou ' + displayName(pet) + '! ' + path.emoji;
    addMoment(state, 'Caminho: ' + path.name, 'Você escolheu o caminho ' + path.name + ' para ' + pet.name + '.');
    addLog(state, pet.name + ' escolheu o caminho ' + path.name + '! +' + path.coins + ' 🪙', 'achievement');
    unlock(state, 'path_chosen');
    checkAchievements(state, pet);
    return { ok: true, msg: 'Caminho escolhido: ' + path.name + '! +' + path.coins + ' 🪙 e +' + path.xp + ' XP.' };
  }

  function focusStart(state, minutes, mode, task) {
    var kind = mode === 'break' ? 'break' : 'focus';
    var duration = Math.floor(num(minutes, kind === 'break' ? 5 : 25, 1, 120));
    var label = String(task || '').trim().slice(0, 60);
    state.focus = {
      running: true,
      mode: kind,
      minutes: duration,
      task: label,
      endsAt: now() + duration * 60000,
      remaining: duration * 60000
    };
    return { ok: true, msg: kind === 'break' ? 'Pausa iniciada!' : label ? 'Foco em "' + label + '" iniciado!' : 'Foco iniciado! Mãos à obra.' };
  }

  function focusStop(state, timestamp) {
    var focus = state.focus;
    if (!focus || !focus.running) return { ok: false, msg: 'Nenhum foco ativo.' };
    focus.remaining = Math.max(0, focus.endsAt - (timestamp || now()));
    focus.running = false;
    focus.endsAt = 0;
    return { ok: true, msg: 'Foco pausado.' };
  }

  function focusTick(state, timestamp) {
    var focus = state.focus;
    if (!focus || !focus.running) return { completed: false };
    var time = timestamp || now();
    focus.remaining = Math.max(0, focus.endsAt - time);
    if (time < focus.endsAt) return { completed: false };
    var wasBreak = focus.mode === 'break';
    var task = focus.task || '';
    var minutesDone = focus.minutes;
    var coins = wasBreak ? 10 : 60;
    var xp = wasBreak ? 3 : 15;
    focus.running = false;
    focus.endsAt = 0;
    focus.mode = wasBreak ? 'focus' : 'break';
    focus.minutes = wasBreak ? 25 : 5;
    focus.task = '';
    focus.remaining = focus.minutes * 60000;
    state.coins += coins;
    state.totals.earned += coins;
    if (!wasBreak) {
      state.totals.focus += 1;
      bumpQuest(state, 'focus', minutesDone, time);
      if (!state.focusLog || typeof state.focusLog !== 'object') state.focusLog = {};
      var key = dateKey(new Date(time));
      state.focusLog[key] = Math.floor(num(state.focusLog[key], 0, 0, 100000) + minutesDone);
      if (task) addMoment(state, 'Foco: ' + task, 'Sessão de ' + minutesDone + ' minutos concluída. +' + coins + ' 🪙 e +' + xp + ' XP.');
    }
    var pet = activePet(state);
    if (pet) addXp(state, pet, xp);
    addLog(state, (wasBreak ? 'Pausa concluída' : 'Sessão de foco' + (task ? ': ' + task : '') + ' concluída') + '! +' + coins + ' 🪙', 'good');
    checkAchievements(state, pet);
    return { completed: true, mode: wasBreak ? 'break' : 'focus', coins: coins, xp: xp, task: task };
  }

  function buyDeal(state, itemId, quantity) {
    var key = dateKey(new Date());
    if (!state.deals || state.deals.date !== key) {
      state.deals = { date: key, bought: {} };
    }
    var deal = DATA.dealsForDay().find(function (entry) { return entry.itemId === itemId; });
    if (!deal) return { ok: false, msg: 'Oferta inválida.' };
    var qty = Math.max(1, Math.min(99, Number(quantity) || 1));
    var bought = state.deals.bought[itemId] || 0;
    if (bought + qty > deal.stock) return { ok: false, msg: 'Estoque esgotado por hoje.' };
    var cost = deal.price * qty;
    if (state.coins < cost) return { ok: false, msg: 'Moedas insuficientes para esta oferta.' };
    state.coins -= cost;
    state.deals.bought[itemId] = bought + qty;
    state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
    state.totals.deals += qty;
    addLog(state, 'Comprou ' + qty + 'x ' + DATA.item(itemId).name + ' na oferta (-' + cost + ' 🪙).', 'info');
    checkAchievements(state, activePet(state));
    return { ok: true, msg: 'Oferta comprada: ' + qty + 'x ' + DATA.item(itemId).name + '!' };
  }

  function addMoment(state, title, note) {
    var pet = activePet(state);
    if (!pet) return { ok: false, msg: 'Adote um bichinho primeiro.' };
    state.moments.unshift({
      t: now(),
      petId: pet.id,
      name: pet.name,
      title: String(title || 'Momento especial').slice(0, 40),
      note: String(note || '').slice(0, 160),
      mood: E_MOOD(pet)
    });
    if (state.moments.length > 30) state.moments.pop();
    state.totals.moments += 1;
    addLog(state, 'Momento registrado: ' + state.moments[0].title + '.', 'info');
    checkAchievements(state, pet);
    return { ok: true, msg: 'Momento salvo no diário ilustrado!' };
  }

  function E_MOOD(pet) {
    return moodOf ? moodOf(pet).emoji : '✨';
  }

  function traitLines(pet, kind) {
    var personality = DATA.personality(pet.personalityId);
    return personality && personality.lines && personality.lines[kind] ? personality.lines[kind] : [];
  }

  function logCareDay(state, key, amount, timestamp) {
    var careKeys = ['feed', 'bath', 'sleep', 'game', 'train', 'pet'];
    if (careKeys.indexOf(key) === -1) return;
    if (!state.careCalendar || typeof state.careCalendar !== 'object') state.careCalendar = {};
    var day = dateKey(new Date(timestamp || now()));
    var entry = state.careCalendar[day] || { feed: 0, bath: 0, sleep: 0, game: 0, train: 0, pet: 0 };
    entry[key] = Math.min(9999, savedCounter(entry[key], 0) + Math.max(0, clamp(amount, 0, 99)));
    state.careCalendar[day] = entry;
    var days = Object.keys(state.careCalendar).sort();
    while (days.length > 60) delete state.careCalendar[days.shift()];
  }

  function bumpWeeklyQuest(state, key, amount, timestamp) {
    var weekly = ensureWeekly(state, timestamp);
    weekly.quests.forEach(function (quest) {
      if (quest.key !== key || quest.claimed) return;
      quest.progress = Math.min(quest.target, quest.progress + amount);
      if (quest.progress >= quest.target) {
        quest.claimed = true;
        state.coins += quest.reward;
        state.totals.earned += quest.reward;
        addLog(state, 'Missão semanal concluída: ' + quest.name + ' (+' + quest.reward + ' 🪙)', 'achievement');
      }
    });
  }

  function bumpQuest(state, key, amount, timestamp) {
    var daily = ensureDaily(state, timestamp);
    var completed = [];
    logCareDay(state, key, amount, timestamp);
    bumpCompanionRequests(state, key, amount, timestamp);
    bumpRanking(state, key, amount);
    bumpWeeklyQuest(state, key, amount, timestamp);
    daily.quests.forEach(function (quest) {
      if (quest.key !== key || quest.claimed) return;
      quest.progress = Math.min(quest.target, quest.progress + amount);
      if (quest.progress >= quest.target) {
        quest.claimed = true;
        state.coins += quest.reward;
        state.totals.earned += quest.reward;
        addLog(state, 'Missão diária concluída: ' + quest.name + ' (+' + quest.reward + ' 🪙)', 'achievement');
        completed.push(quest);
      }
    });
    return completed;
  }

  function careQuality(pet) {
    var values = [pet.hunger, pet.happiness, pet.energy, pet.hygiene, pet.health];
    if (values.every(function (value) { return value > 70; })) return 2;
    if (values.every(function (value) { return value > 40; })) return 1;
    return 0.5;
  }

  function defaultState() {
    return {
      version: 1,
      createdAt: now(),
      updatedAt: now(),
      settings: {
        sound: true, music: false, ambientSound: true, notifications: false, reminderMorning: '08:00', reminderEvening: '20:00',
        speed: 3, theme: 'auto', contrast: 'normal', fontSize: 'normal', reduceMotion: false, visualCues: true, vibration: true,
        narration: false, shortcuts: { feed: 'Space', shop: 'KeyC', games: 'KeyJ', help: 'Slash' }
      },
      lastExportAt: 0,
      coins: 150,
      inventory: { apple: 3, soap: 1 },
      totals: {
        feeds: 0, plays: 0, games: 0, baths: 0, trains: 0, crafted: 0, cooked: 0, trades: 0, fished: 0,
        gifts: 0, focus: 0, deals: 0, moments: 0, walks: 0, battles: 0, wins: 0, bosses: 0, visits: 0, earned: 0, checkins: 0,
        companionRequests: 0, companionStories: 0, adopted: []
      },
      achievements: {},
      daily: { date: '', quests: [], checkin: null },
      weekly: { week: '', quests: [] },
      garden: { plots: [null, null, null, null], harvested: 0, rainedOn: '' },
      routine: { feed: '08:00', bath: '20:00', play: '15:00' },
      ranking: { week: '', scores: {}, best: {} },
      buffs: {},
      careCalendar: {},
      streak: { count: 0, best: 0, lastDay: 0, claimed: [] },
      tutorial: { done: false, step: 0 },
      stickers: {},
      stickerDust: 0,
      deals: { date: '', bought: {} },
      focus: { running: false, mode: 'focus', minutes: 25, task: '', endsAt: 0, remaining: 25 * 60000 },
      focusLog: {},
      moments: [],
      companions: { day: '', friends: {} },
      adventure: { walks: 0, battles: 0, wins: 0, bosses: 0, lastWalk: null, battle: null },
      activeDecor: null,
      pets: [],
      activePetId: null,
      history: {},
      log: [],
      lastHistoryAt: 0,
      lastAlertAt: {},
      lastVisitAt: now()
    };
  }

  function num(value, fallback, min, max) {
    var parsed = Number(value);
    if (!isFinite(parsed)) return fallback;
    return clamp(parsed, min, max);
  }

  function savedCounter(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    return Math.floor(num(value, fallback, 0, 1000000000));
  }

  function petStageAllowsPath(stageIndex) {
    return Number(stageIndex) >= 4;
  }

  function validTime(value, fallback) {
    var text = String(value || '');
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
  }

  function validDay(value) {
    var text = String(value || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function sanitizePet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var species = DATA.species(raw.speciesId);
    var status = ['alive', 'critical', 'gone'].indexOf(raw.status) !== -1 ? raw.status : 'alive';
    var accessory = DATA.item(raw.accessory);
    var illness = raw.illness && typeof raw.illness === 'object'
      ? {
          type: String(raw.illness.type || 'enfermidade').slice(0, 30),
          since: num(raw.illness.since, now(), 0, Date.now() + 86400000),
          care: num(raw.illness.care, 0, 0, 1000)
        }
      : null;
    var pet = {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : uid(),
      name: String(raw.name || species.name).slice(0, 18),
      speciesId: species.id,
      personalityId: DATA.PERSONALITIES.some(function (item) { return item.id === raw.personalityId; }) ? raw.personalityId : pick(DATA.PERSONALITIES).id,
      path: DATA.path(raw.path) && petStageAllowsPath(raw.stageIndex) ? raw.path : null,
      color: Math.floor(num(raw.color, 0, 0, 2)),
      bornAt: num(raw.bornAt, now(), 0, Date.now() + 86400000),
      updatedAt: num(raw.updatedAt, now(), 0, Date.now() + 86400000),
      age: num(raw.age, 0, 0, 1000000),
      care: num(raw.care, 0, 0, 1000000),
      risk: num(raw.risk, 0, 0, 40),
      illness: illness,
      stageIndex: Math.floor(num(raw.stageIndex, 0, 0, DATA.STAGES.length - 1)),
      hunger: num(raw.hunger, 70, 0, 100),
      happiness: num(raw.happiness, 75, 0, 100),
      energy: num(raw.energy, 85, 0, 100),
      hygiene: num(raw.hygiene, 80, 0, 100),
      health: num(raw.health, 100, 0, 100),
      discipline: num(raw.discipline, 10, 0, 100),
      weight: num(raw.weight, 30, 10, 200),
      xp: num(raw.xp, 0, 0, 100000000),
      level: 1,
      affection: num(raw.affection, 0, 0, 1000000),
      status: status,
      sleeping: !!raw.sleeping,
      accessory: accessory && accessory.type === 'accessory' ? accessory.id : null,
      criticalAt: status === 'critical' ? num(raw.criticalAt, now(), 0, Date.now() + 86400000) : null,
      lastBirthday: Math.floor(num(raw.lastBirthday, 0, 0, 100000)),
      lastActionAt: num(raw.lastActionAt, 0, 0, Date.now() + 86400000),
      lastTrainAt: num(raw.lastTrainAt, 0, 0, Date.now() + 86400000),
      lastTalkAt: num(raw.lastTalkAt, 0, 0, Date.now() + 86400000),
      lastPetAt: num(raw.lastPetAt, 0, 0, Date.now() + 86400000),
      lastMessageAt: num(raw.lastMessageAt, 0, 0, Date.now() + 86400000),
      message: String(raw.message || '').slice(0, 140)
    };
    pet.level = levelFromXp(pet.xp);
    return pet;
  }

  function sanitizeSave(raw) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.pets)) return null;
    var pets = raw.pets.map(sanitizePet).filter(Boolean).slice(0, MAX_PETS);
    if (!pets.length) return null;
    var state = defaultState();
    var settings = raw.settings || {};
    state.settings = {
      sound: settings.sound !== false,
      music: !!settings.music,
      ambientSound: settings.ambientSound !== false,
      notifications: !!settings.notifications,
      reminderMorning: validTime(settings.reminderMorning, '08:00'),
      reminderEvening: validTime(settings.reminderEvening, '20:00'),
      speed: [1, 3, 10].indexOf(Number(settings.speed)) !== -1 ? Number(settings.speed) : 3,
      theme: ['auto', 'day', 'night'].indexOf(settings.theme) !== -1 ? settings.theme : 'auto',
      contrast: ['normal', 'high', 'max'].indexOf(settings.contrast) !== -1 ? settings.contrast : 'normal',
      fontSize: ['normal', 'large'].indexOf(settings.fontSize) !== -1 ? settings.fontSize : 'normal',
      reduceMotion: settings.reduceMotion === true,
      visualCues: settings.visualCues !== false,
      vibration: settings.vibration !== false,
      narration: settings.narration === true,
      shortcuts: {}
    };
    var shortcuts = settings.shortcuts || {};
    DATA.SHORTCUT_OPTIONS.forEach(function (option) {
      state.settings.shortcuts[option.key] = DATA.SHORTCUT_LABELS[shortcuts[option.key]] ? shortcuts[option.key] : option.default;
    });
    state.lastExportAt = num(raw.lastExportAt, 0, 0, Date.now() + 86400000);
    state.createdAt = num(raw.createdAt, now(), 0, Date.now() + 86400000);
    state.updatedAt = num(raw.updatedAt, now(), 0, Date.now() + 86400000);
    state.coins = Math.floor(num(raw.coins, 150, 0, 1000000000));

    Object.keys(raw.inventory || {}).forEach(function (id) {
      var item = DATA.item(id);
      var quantity = Math.floor(num(raw.inventory[id], 0, 0, 999));
      if (item && quantity > 0) state.inventory[id] = quantity;
    });
    var totals = raw.totals || {};
    ['feeds', 'plays', 'games', 'baths', 'trains', 'crafted', 'cooked', 'trades', 'fished', 'gifts', 'focus', 'deals', 'moments', 'walks', 'battles', 'wins', 'bosses', 'visits', 'earned', 'checkins', 'companionRequests', 'companionStories'].forEach(function (key) {
      state.totals[key] = Math.floor(num(totals[key], 0, 0, 1000000000));
    });
    state.totals.adopted = (Array.isArray(totals.adopted) ? totals.adopted : []).filter(function (id) {
      return DATA.SPECIES.some(function (species) { return species.id === id; });
    }).slice(0, DATA.SPECIES.length);

    Object.keys(raw.achievements || {}).forEach(function (id) {
      if (DATA.ACHIEVEMENTS.some(function (item) { return item.id === id; })) {
        state.achievements[id] = num(raw.achievements[id], now(), 0, Date.now() + 86400000);
      }
    });
    var decor = decorItemFor(raw.activeDecor) || DATA.item(raw.activeDecor);
    state.activeDecor = decor && decor.type === 'decor' ? (decor.decor || decor.id) : null;
    state.pets = pets;
    state.activePetId = pets.some(function (pet) { return pet.id === raw.activePetId; }) ? raw.activePetId : pets[0].id;

    state.pets.forEach(function (pet) {
      var minXp = state.achievements.level_10 ? 20 * 81 : state.achievements.level_5 ? 20 * 16 : 0;
      if ((!isFinite(pet.xp) || pet.xp <= 0) && minXp > 0) pet.xp = minXp;
      pet.level = levelFromXp(pet.xp);
    });

    pets.forEach(function (pet) {
      var points = Array.isArray(raw.history && raw.history[pet.id]) ? raw.history[pet.id].slice(-150) : [];
      state.history[pet.id] = points.filter(function (point) { return point && typeof point === 'object'; }).map(function (point) {
        return {
          t: num(point.t, now(), 0, Date.now() + 86400000),
          hunger: num(point.hunger, 0, 0, 100),
          happiness: num(point.happiness, 0, 0, 100),
          energy: num(point.energy, 0, 0, 100),
          hygiene: num(point.hygiene, 0, 0, 100),
          health: num(point.health, 0, 0, 100),
          mood: num(point.mood, 0, 0, 100)
        };
      });
    });

    state.log = (Array.isArray(raw.log) ? raw.log : []).slice(0, 80).map(function (entry) {
      return {
        t: num(entry && entry.t, now(), 0, Date.now() + 86400000),
        text: String((entry && entry.text) || '').slice(0, 220),
        type: ['info', 'good', 'bad', 'achievement'].indexOf(entry && entry.type) !== -1 ? entry.type : 'info'
      };
    });
    state.lastHistoryAt = num(raw.lastHistoryAt, 0, 0, Date.now() + 86400000);
    state.lastVisitAt = num(raw.lastVisitAt, now(), 0, Date.now() + 86400000);
    state.lastAlertAt = {};
    Object.keys(raw.lastAlertAt || {}).forEach(function (key) {
      state.lastAlertAt[String(key).slice(0, 80)] = num(raw.lastAlertAt[key], 0, 0, Date.now() + 86400000);
    });
    if (raw.daily && typeof raw.daily.date === 'string') {
      state.daily = { date: raw.daily.date.slice(0, 10), quests: [], checkin: null };
      var validQuests = DATA.QUESTS;
      (Array.isArray(raw.daily.quests) ? raw.daily.quests : []).slice(0, 10).forEach(function (quest) {
        var weatherId = typeof quest.weather === 'string' ? quest.weather.slice(0, 20) : null;
        var weatherTemplate = weatherId && DATA.WEATHER_QUESTS[weatherId];
        var template = weatherTemplate ||
          validQuests.find(function (item) { return item.id === quest.id && item.key === quest.key; }) ||
          validQuests.find(function (item) { return item.key === quest.key; });
        if (template) {
          state.daily.quests.push({
            id: String(quest.id || template.id).slice(0, 40),
            key: template.key,
            target: template.target,
            reward: template.reward,
            emoji: template.emoji,
            name: template.name,
            weather: weatherTemplate ? weatherId : null,
            progress: num(quest.progress, 0, 0, template.target),
            claimed: !!quest.claimed
          });
        }
      });
      var rawCheckin = raw.daily.checkin;
      if (rawCheckin && DATA.item(rawCheckin.itemId)) {
        state.daily.checkin = { itemId: rawCheckin.itemId, at: num(rawCheckin.at, now(), 0, Date.now() + 86400000) };
      }
    }
    if (raw.weekly && typeof raw.weekly.week === 'string') {
      state.weekly = { week: raw.weekly.week.slice(0, 10), quests: [] };
      var validWeekly = DATA.WEEKLY_QUESTS;
      (Array.isArray(raw.weekly.quests) ? raw.weekly.quests : []).slice(0, 10).forEach(function (quest) {
        var template = validWeekly.find(function (item) { return item.id === quest.id && item.key === quest.key; }) ||
          validWeekly.find(function (item) { return item.key === quest.key; });
        if (template) {
          state.weekly.quests.push({
            id: String(quest.id || template.id).slice(0, 48),
            key: template.key,
            target: template.target,
            reward: template.reward,
            emoji: template.emoji,
            name: template.name,
            progress: num(quest.progress, 0, 0, template.target),
            claimed: !!quest.claimed
          });
        }
      });
    }
    if (raw.garden && typeof raw.garden === 'object') state.garden = raw.garden;
    if (raw.routine && typeof raw.routine === 'object' && !Array.isArray(raw.routine)) state.routine = raw.routine;
    if (raw.ranking && typeof raw.ranking === 'object' && !Array.isArray(raw.ranking)) state.ranking = raw.ranking;
    state.buffs = {};
    Object.keys(raw.buffs || {}).forEach(function (id) {
      if (DATA.BUFFS[id]) state.buffs[id] = Math.floor(num(raw.buffs[id], 0, 0, Date.now() + 86400000 * 7));
    });
    ensureGarden(state, now());
    ensureRoutine(state);
    ensureRanking(state, now());

    state.careCalendar = {};
    Object.keys(raw.careCalendar || {}).sort().slice(-60).forEach(function (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      var entry = raw.careCalendar[day] || {};
      state.careCalendar[day] = {};
      ['feed', 'bath', 'sleep', 'game', 'train', 'pet'].forEach(function (key) {
        state.careCalendar[day][key] = Math.floor(num(entry[key], 0, 0, 9999));
      });
    });
    var rawStreak = raw.streak || {};
    state.streak = {
      count: Math.floor(num(rawStreak.count, 0, 0, 100000)),
      best: Math.floor(num(rawStreak.best, 0, 0, 100000)),
      lastDay: Math.floor(num(rawStreak.lastDay, 0, 0, 100000)),
      claimed: Array.isArray(rawStreak.claimed)
        ? rawStreak.claimed.slice(0, 40).map(function (key) { return String(key).slice(0, 30); })
        : []
    };
    state.tutorial = {
      done: !!(raw.tutorial && raw.tutorial.done),
      step: Math.floor(num(raw.tutorial && raw.tutorial.step, 0, 0, DATA.TUTORIAL.length))
    };
    state.stickers = {};
    Object.keys(raw.stickers || {}).forEach(function (key) {
      if (DATA.STICKERS.some(function (sticker) { return sticker.id === key; })) {
        state.stickers[key] = Math.floor(num(raw.stickers[key], 1, 1, 9999));
      }
    });
    state.pets.forEach(function (pet) {
      for (var stage = 0; stage <= pet.stageIndex; stage += 1) {
        var key = DATA.stickerKey(pet.speciesId, stage);
        if (!state.stickers[key]) state.stickers[key] = 1;
      }
    });
    state.stickerDust = Math.floor(num(raw.stickerDust, 0, 0, 9999));
    var rawDeals = raw.deals || {};
    state.deals = { date: String(rawDeals.date || '').slice(0, 10), bought: {} };
    Object.keys(rawDeals.bought || {}).forEach(function (key) {
      state.deals.bought[String(key).slice(0, 30)] = Math.floor(num(rawDeals.bought[key], 0, 0, 99));
    });
    var rawFocus = raw.focus || {};
    state.focus = {
      running: !!rawFocus.running,
      mode: rawFocus.mode === 'break' ? 'break' : 'focus',
      minutes: Math.floor(num(rawFocus.minutes, 25, 1, 120)),
      task: String(rawFocus.task || '').slice(0, 60),
      endsAt: Math.floor(num(rawFocus.endsAt, 0, 0, Date.now() + 86400000 * 7)),
      remaining: Math.floor(num(rawFocus.remaining, 0, 0, 120 * 60000))
    };
    state.focusLog = {};
    Object.keys(raw.focusLog || {}).forEach(function (key) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) state.focusLog[key] = Math.floor(num(raw.focusLog[key], 0, 0, 100000));
    });
    state.moments = (Array.isArray(raw.moments) ? raw.moments : []).slice(0, 30).map(function (moment) {
      var pet = state.pets.find(function (item) { return item.id === moment.petId; });
      return {
        t: num(moment.t, now(), 0, Date.now() + 86400000),
        petId: pet ? pet.id : '',
        name: String((pet && pet.name) || moment.name || 'Bichinho').slice(0, 18),
        title: String(moment.title || 'Momento').slice(0, 40),
        note: String(moment.note || '').slice(0, 160),
        mood: String(moment.mood || '✨').slice(0, 4)
      };
    });
    var rawAdventure = raw.adventure || {};
    var rawBattle = rawAdventure.battle;
    var enemy = rawBattle && DATA.enemy(rawBattle.enemyId);
    state.adventure = {
      walks: savedCounter(rawAdventure.walks, totals.walks),
      battles: savedCounter(rawAdventure.battles, totals.battles),
      wins: savedCounter(rawAdventure.wins, totals.wins),
      bosses: savedCounter(rawAdventure.bosses, totals.bosses),
      lastWalk: DATA.walk(rawAdventure.lastWalk) ? rawAdventure.lastWalk : null,
      battle: null
    };
    if (enemy && rawBattle.hp > 0 && rawBattle.enemyHp > 0) {
      state.adventure.battle = {
        enemyId: enemy.id,
        hp: Math.floor(num(rawBattle.hp, 100, 1, 500)),
        maxHp: Math.floor(num(rawBattle.maxHp, 100, 1, 500)),
        enemyHp: Math.floor(num(rawBattle.enemyHp, enemy.hp, 1, 500)),
        turn: Math.floor(num(rawBattle.turn, 1, 1, 500)),
        log: (Array.isArray(rawBattle.log) ? rawBattle.log : []).slice(-8).map(function (line) {
          return String(line).slice(0, 120);
        })
      };
    }
    var rawCompanions = raw.companions || {};
    state.companions = { day: validDay(rawCompanions.day), friends: {} };
    Object.keys(rawCompanions.friends || {}).forEach(function (id) {
      var companion = DATA.companion(id);
      if (!companion) return;
      var rawFriend = rawCompanions.friends[id] || {};
      var friend = {
        affinity: Math.floor(num(rawFriend.affinity, 0, 0, 100000)),
        visits: savedCounter(rawFriend.visits, 0),
        lastDay: validDay(rawFriend.lastDay),
        request: null,
        stories: {}
      };
      var rawRequest = rawFriend.request;
      var request = rawRequest && companion.requests.find(function (item) { return item.id === rawRequest.id; });
      if (request) {
        friend.request = {
          id: request.id,
          day: validDay(rawRequest.day),
          progress: Math.floor(num(rawRequest.progress, 0, 0, request.target)),
          claimed: rawRequest.claimed === true
        };
      }
      companion.stories.forEach(function (story) {
        var rawStory = rawFriend.stories && rawFriend.stories[story.id];
        if (!rawStory) return;
        friend.stories[story.id] = {
          unlockedAt: num(rawStory.unlockedAt || rawStory, now(), 0, Date.now() + 86400000),
          readAt: num(rawStory.readAt, 0, 0, Date.now() + 86400000)
        };
      });
      state.companions.friends[id] = friend;
    });
    ensureCompanions(state, state.updatedAt);
    return state;
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return sanitizeSave(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function save(state) {
    state.updatedAt = now();
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function slotKey(index) {
    return STORAGE_KEY + '.slot' + num(index, 1, 1, 3);
  }

  function saveSlot(state, index) {
    state.updatedAt = now();
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(slotKey(index), JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadSlot(index) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(slotKey(index));
      return raw ? sanitizeSave(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function deleteSlot(index) {
    try {
      if (global.localStorage) global.localStorage.removeItem(slotKey(index));
      return true;
    } catch (error) {
      return false;
    }
  }

  function listSlots() {
    return [1, 2, 3].map(function (index) {
      var loaded = loadSlot(index);
      return {
        index: index,
        name: loaded && loaded.pets.length ? loaded.pets[0].name : 'Vazio',
        pets: loaded ? loaded.pets.length : 0,
        coins: loaded ? loaded.coins : 0,
        savedAt: loaded ? loaded.updatedAt : null
      };
    });
  }

  function activePet(state) {
    if (!state || !state.pets.length) return null;
    var pet = state.pets.find(function (item) { return item.id === state.activePetId; });
    return pet || state.pets[0];
  }

  function levelFromXp(xp) {
    return clamp(Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1, 1, 99);
  }

  function xpToNext(level) {
    return 20 * level * level;
  }

  function calculateMood(pet) {
    var score = pet.hunger * 0.25 + pet.happiness * 0.3 + pet.energy * 0.15 +
      pet.hygiene * 0.15 + pet.health * 0.15;
    if (pet.status === 'critical' || pet.status === 'gone') return 0;
    if (pet.health < 40) score -= 15;
    if (pet.illness) score -= 12;
    if (pet.sleeping) score += 5;
    var personality = DATA.personality(pet.personalityId);
    if (personality) score += personality.moodBonus || 0;
    return clamp(Math.round(score), 0, 100);
  }

  function moodOf(pet) {
    var score = calculateMood(pet);
    return DATA.MOODS.find(function (mood) { return score >= mood.min; }) || DATA.MOODS[DATA.MOODS.length - 1];
  }

  function stageOf(pet) {
    return DATA.stage(pet.stageIndex);
  }

  function speciesOf(pet) {
    return DATA.species(pet.speciesId);
  }

  function displayName(pet) {
    var species = speciesOf(pet);
    var name = species.names[pet.stageIndex] || species.name;
    var path = DATA.path(pet.path);
    if (path && petStageAllowsPath(pet.stageIndex)) return name + ' ' + path.name;
    return name;
  }

  function addLog(state, text, type) {
    state.log.unshift({ t: now(), text: text, type: type || 'info' });
    if (state.log.length > 80) state.log.length = 80;
  }

  function unlock(state, id) {
    if (state.achievements[id]) return false;
    var achievement = DATA.ACHIEVEMENTS.find(function (item) { return item.id === id; });
    if (!achievement) return false;
    state.achievements[id] = now();
    state.coins += 50;
    state.totals.earned += 50;
    addLog(state, 'Conquista desbloqueada: ' + achievement.name + ' (+50 🪙)', 'achievement');
    return true;
  }

  function checkAchievements(state, pet) {
    var unlocked = [];
    function tryUnlock(id) { if (unlock(state, id)) unlocked.push(id); }

    if (state.totals.feeds > 0) tryUnlock('first_feed');
    if (state.totals.plays > 0) tryUnlock('first_play');
    if (state.totals.baths > 0) tryUnlock('first_bath');
    if (state.totals.feeds >= 25) tryUnlock('feeds_25');
    if (state.totals.feeds >= 100) tryUnlock('feeds_100');
    if (state.totals.games >= 10) tryUnlock('games_10');
    if (state.totals.games >= 50) tryUnlock('games_50');
    if (state.coins >= 1000) tryUnlock('rich');
    if (state.totals.adopted.length >= DATA.SPECIES.length) tryUnlock('collector');
    if (state.streak && state.streak.best >= 7) tryUnlock('streak_7');
    if (state.totals.crafted > 0) tryUnlock('crafter');
    if (state.totals.gifts > 0) tryUnlock('birthday');
    if (state.totals.focus >= 5) tryUnlock('focus_5');
    if (Object.keys(state.stickers || {}).length >= 10) tryUnlock('sticker_10');
    if (state.totals.deals >= 5) tryUnlock('deals_5');
    if (state.totals.moments >= 5) tryUnlock('moment_5');
    if (state.totals.walks >= 5) tryUnlock('walk_5');
    if (state.totals.walks >= 10) tryUnlock('walks_10');
    if (state.totals.battles >= 10) tryUnlock('battle_10');
    if (state.totals.bosses > 0) tryUnlock('boss');
    if (state.totals.fished >= 10) tryUnlock('fish_10');
    if (state.totals.checkins >= 7) tryUnlock('checkin_7');
    if ((state.garden && state.garden.harvested || 0) >= 10) tryUnlock('harvest_10');
    if (state.totals.visits >= 3) tryUnlock('visitor_3');
    var metCompanions = DATA.COMPANIONS.filter(function (companion) {
      var friend = state.companions && state.companions.friends && state.companions.friends[companion.id];
      return friend && friend.visits > 0;
    }).length;
    if (metCompanions >= 3) tryUnlock('friend_3');
    if (state.totals.companionRequests >= 5) tryUnlock('request_5');
    if (state.totals.companionStories >= 3) tryUnlock('story_3');

    if (pet) {
      if (pet.level >= 5) tryUnlock('level_5');
      if (pet.level >= 10) tryUnlock('level_10');
      if (pet.stageIndex >= 4) tryUnlock('stage_adult');
      if (pet.stageIndex >= 5) tryUnlock('stage_elder');
      if (pet.discipline >= 100) tryUnlock('discipline_100');
      if (pet.accessory) tryUnlock('accessory');
      if (pet.hunger >= 90 && pet.happiness >= 90 && pet.energy >= 90 &&
        pet.hygiene >= 90 && pet.health >= 90) tryUnlock('perfect');
    }
    return unlocked;
  }

  function createPet(state, speciesId, name) {
    if (!state || state.pets.length >= MAX_PETS) return { ok: false, msg: 'Limite de 4 bichinhos atingido.' };
    var species = DATA.species(speciesId);
    var cleanName = String(name || '').trim().slice(0, 18) || species.name;
    var pet = {
      id: uid(),
      name: cleanName,
      speciesId: species.id,
      personalityId: pick(DATA.PERSONALITIES).id,
      path: null,
      color: Math.floor(Math.random() * species.colors.length),
      bornAt: now(),
      updatedAt: now(),
      age: 0,
      care: 0,
      risk: 0,
      illness: null,
      stageIndex: 0,
      hunger: 70,
      happiness: 75,
      energy: 85,
      hygiene: 80,
      health: 100,
      discipline: 10,
      weight: 30,
      xp: 0,
      level: 1,
      affection: 0,
      status: 'alive',
      sleeping: false,
      accessory: null,
      criticalAt: null,
      lastBirthday: 0,
      lastActionAt: 0,
      lastTrainAt: 0,
      lastTalkAt: 0,
      lastPetAt: 0,
      message: 'Ovo começando a chocar...'
    };
    state.pets.push(pet);
    state.activePetId = pet.id;
    state.history[pet.id] = [];
    if (state.totals.adopted.indexOf(species.id) === -1) state.totals.adopted.push(species.id);
    unlockSticker(state, species.id, 0);
    addLog(state, 'Ovo de ' + cleanName + ' foi adotado!', 'good');
    checkAchievements(state, pet);
    save(state);
    return { ok: true, msg: cleanName + ' chegou! Cuide bem do ovo.', pet: pet };
  }

  function snapshot(state, pet) {
    if (!state.history[pet.id]) state.history[pet.id] = [];
    var list = state.history[pet.id];
    var last = list[list.length - 1];
    if (last && now() - last.t < 4 * 60 * 1000) return;
    list.push({
      t: now(),
      hunger: Math.round(pet.hunger),
      happiness: Math.round(pet.happiness),
      energy: Math.round(pet.energy),
      hygiene: Math.round(pet.hygiene),
      health: Math.round(pet.health),
      mood: calculateMood(pet)
    });
    if (list.length > 150) list.splice(0, list.length - 150);
  }

  function companionFriend(state, id) {
    if (!state.companions || typeof state.companions !== 'object') state.companions = { day: '', friends: {} };
    if (!state.companions.friends || typeof state.companions.friends !== 'object') state.companions.friends = {};
    var companion = DATA.companion(id);
    if (!companion) return null;
    var friend = state.companions.friends[id];
    if (!friend || typeof friend !== 'object') friend = { affinity: 0, visits: 0, lastDay: '', request: null, stories: {} };
    if (!friend.stories || typeof friend.stories !== 'object') friend.stories = {};
    friend.affinity = Math.floor(num(friend.affinity, 0, 0, 100000));
    friend.visits = savedCounter(friend.visits, 0);
    state.companions.friends[id] = friend;
    return friend;
  }

  function ensureCompanions(state, timestamp) {
    if (!state) return;
    var time = timestamp || now();
    var day = dateKey(new Date(time));
    var needsReset = !state.companions || state.companions.day !== day;
    var friends = (state.companions && state.companions.friends) || {};
    if (!needsReset) {
      needsReset = DATA.COMPANIONS.some(function (companion) {
        var friend = friends[companion.id];
        return !friend || !friend.request || friend.request.day !== day;
      });
    }
    if (!needsReset) return;
    if (!state.companions || typeof state.companions !== 'object') state.companions = { day: '', friends: {} };
    state.companions.day = day;
    var index = DATA.dayIndex(new Date(time));
    DATA.COMPANIONS.forEach(function (companion, offset) {
      var friend = companionFriend(state, companion.id);
      if (!friend) return;
      var request = companion.requests[(index + offset) % companion.requests.length];
      friend.request = { id: request.id, day: day, progress: 0, claimed: false };
    });
  }

  function unlockCompanionStories(state, companion, friend, timestamp) {
    var unlocked = [];
    var time = timestamp || now();
    companion.stories.forEach(function (story) {
      if (friend.affinity < story.minAffinity || friend.stories[story.id]) return;
      friend.stories[story.id] = { unlockedAt: time, readAt: 0 };
      state.totals.companionStories = Math.floor(num(state.totals.companionStories, 0, 0, 1000000) + 1);
      addLog(state, '📖 Nova história: ' + story.title + ' — ' + companion.name, 'achievement');
      unlocked.push(story);
    });
    return unlocked;
  }

  function bumpCompanionRequests(state, key, amount, timestamp) {
    if (!state || !state.totals) return [];
    ensureCompanions(state, timestamp);
    var day = dateKey(new Date(timestamp || now()));
    var completed = [];
    DATA.COMPANIONS.forEach(function (companion) {
      var friend = companionFriend(state, companion.id);
      if (!friend || !friend.request || friend.request.day !== day || friend.request.claimed) return;
      var request = companion.requests.find(function (item) { return item.id === friend.request.id; });
      if (!request || request.key !== key) return;
      friend.request.progress = Math.min(request.target, friend.request.progress + Math.max(0, clamp(amount, 0, 99)));
      if (friend.request.progress < request.target) return;
      friend.request.claimed = true;
      friend.affinity = Math.floor(num(friend.affinity, 0, 0, 100000) + request.affinity);
      state.totals.companionRequests = Math.floor(num(state.totals.companionRequests, 0, 0, 1000000) + 1);
      state.coins += request.coins;
      state.totals.earned += request.coins;
      if (request.item && DATA.item(request.item)) {
        var quantity = Math.floor(num(request.qty, 1, 1, 20));
        state.inventory[request.item] = (state.inventory[request.item] || 0) + quantity;
      }
      var stories = unlockCompanionStories(state, companion, friend, timestamp);
      addMoment(state, 'Pedido de ' + companion.name + ' concluído', request.text + ' +' + request.coins + ' 🪙');
      addLog(state, '✅ Pedido de ' + companion.name + ' concluído: +' + request.coins + ' 🪙', 'good');
      checkAchievements(state, activePet(state));
      completed.push({ companion: companion, request: request, stories: stories });
    });
    return completed;
  }

  function visitCompanion(state, companion, time, notes) {
    ensureCompanions(state, time);
    var friend = companionFriend(state, companion.id);
    var day = dateKey(new Date(time));
    friend.visits += 1;
    friend.lastDay = day;
    var gain = 4 + (friend.visits % 3 === 0 ? 2 : 0);
    friend.affinity = Math.floor(num(friend.affinity, 0, 0, 100000) + gain);
    notes.push('amizade +' + gain);
    if (friend.visits === 1) notes.push('nova amizade');
    var stories = unlockCompanionStories(state, companion, friend, time);
    stories.forEach(function (story) { notes.push('história: ' + story.title); });
    if (friend.request && !friend.request.claimed) {
      var request = companion.requests.find(function (item) { return item.id === friend.request.id; });
      if (request) notes.push('pedido ' + friend.request.progress + '/' + request.target);
    }
    return { friend: friend, stories: stories };
  }

  function readCompanionStory(state, companionId, storyId) {
    if (!state) return null;
    var companion = DATA.companion(companionId);
    if (!companion) return null;
    var story = companion.stories.find(function (item) { return item.id === storyId; });
    if (!story) return null;
    var friend = companionFriend(state, companionId);
    if (!friend || !friend.stories[story.id]) return null;
    var record = friend.stories[story.id];
    var firstRead = !record.readAt;
    if (firstRead) {
      record.readAt = now();
      addMoment(state, 'História: ' + story.title, companion.name + ' contou: ' + story.text);
      addLog(state, '📖 História lida: ' + story.title, 'good');
    }
    return { companion: companion, story: story, firstRead: firstRead };
  }

  function checkVisitors(state, timestamp, roll) {
    var time = timestamp || now();
    if (!state || !activePet(state)) return null;
    if (time - (state.createdAt || time) < 30 * 60 * 1000) return null;
    if (time - (state.lastVisitAt || 0) < 6 * 60 * 60 * 1000) return null;
    var chance = typeof roll === 'number' ? roll : Math.random();
    if (chance > 0.35) return null;
    var visitor = pick(DATA.VISITORS);
    var companion = DATA.companion(visitor.id);
    var gift = visitor.gift || {};
    var notes = [];
    state.lastVisitAt = time;
    state.totals.visits = Math.floor(num(state.totals.visits, 0, 0, 1000000) + 1);
    if (gift.coins) {
      state.coins += gift.coins;
      state.totals.earned += gift.coins;
      notes.push('+' + gift.coins + ' 🪙');
    }
    if (gift.item && DATA.item(gift.item)) {
      var quantity = Math.floor(num(gift.qty, 1, 1, 20));
      state.inventory[gift.item] = (state.inventory[gift.item] || 0) + quantity;
      notes.push(quantity + 'x ' + DATA.item(gift.item).name);
    }
    if (gift.dust) {
      state.stickerDust += gift.dust;
      notes.push('+' + gift.dust + ' pó');
    }
    var sticker = null;
    if (gift.sticker) {
      var missing = DATA.STICKERS.filter(function (item) { return !state.stickers[item.id]; });
      if (missing.length) {
        sticker = pick(missing);
        state.stickers[sticker.id] = 1;
        notes.push(sticker.emoji + ' ' + sticker.name);
      }
    }
    var companionInfo = companion ? visitCompanion(state, companion, time, notes) : null;
    var pet = activePet(state);
    pet.message = visitor.name + ' ' + visitor.msg + '!';
    addMoment(state, 'Visita de ' + visitor.name, notes.join(' • '));
    addLog(state, '👋 ' + visitor.name + ' ' + visitor.msg + ': ' + notes.join(', '), 'good');
    unlock(state, 'visitor_1');
    checkAchievements(state, pet);
    return { visitor: visitor, notes: notes, sticker: sticker, companion: companionInfo };
  }

  function tick(state, timestamp) {
    if (!state) return { evolved: false, stageUp: null, revived: false };
    var time = timestamp || now();
    var elapsed = Math.max(0, time - (state.updatedAt || time));
    ensureCompanions(state, time);
    var events = {
      evolved: false, stageUp: null, evolvedName: null, died: false, criticalName: null, sick: false, sickName: null,
      streak: null, birthday: [], sticker: null, focus: null, visitor: null
    };
    if (!timestamp) events.visitor = checkVisitors(state, time);
    events.streak = checkStreak(state, time);
    events.birthday = checkBirthdays(state, time);
    events.focus = focusTick(state, time);
    ensureDaily(state, time);
    ensureWeekly(state, time);
    ensureRanking(state, time);
    Object.keys(state.buffs || {}).forEach(function (id) {
      if (state.buffs[id] <= time) delete state.buffs[id];
    });
    if (rainGarden(state, time, DATA.eventForDay(new Date(time)))) {
      addLog(state, '🌧️ A chuva regou sua horta!', 'good');
    }
    if (!elapsed) {
      checkAchievements(state, activePet(state));
      return events;
    }

    var speed = Number(state.settings.speed) || 1;
    var minutes = Math.min(elapsed / 60000 * speed, MAX_AGE_MINUTES_PER_TICK);
    var event = DATA.eventForDay(new Date(time));
    state.pets.forEach(function (pet) {
      if (pet.status !== 'alive') {
        if (pet.status === 'critical' && time - (pet.criticalAt || time) > 24 * 60 * 60 * 1000) {
          pet.status = 'gone';
          addLog(state, pet.name + ' não resistiu. Você pode adotar um novo bichinho.', 'bad');
        }
        return;
      }

      var species = speciesOf(pet);
      var item = pet.accessory ? DATA.item(pet.accessory) : null;
      var bonus = (item && item.bonus) || {};
      var warmth = (item && item.warmth) || 0;
      var personality = DATA.personality(pet.personalityId);
      var path = DATA.path(pet.path);
      function decay(key, base, factor) {
        var reduction = (1 - (bonus[key] || 0)) * buffFactor(state, key, time);
        var eventFactor = (event.effect && event.effect[key]) || 1;
        if (event.id === 'neve' && key === 'energy') eventFactor = Math.max(1, eventFactor - warmth);
        var traitFactor = (personality.rates[key] || 1) * (path && path.bonus ? (path.bonus[key] || 1) : 1);
        pet[key] = clamp(pet[key] - base * (species.rate[key] || 1) * factor * reduction * eventFactor * traitFactor * minutes, 0, 100);
      }

      if (pet.sleeping) {
        decay('hunger', 1.6, 0.35);
        decay('happiness', 1.3, 0.2);
        decay('hygiene', 0.9, 0.5);
        decay('discipline', 0.2, 0.5);
        pet.energy = clamp(pet.energy + 5.5 * ((event.effect && event.effect.sleep) || 1) * minutes, 0, 100);
      } else {
        decay('hunger', 1.6, 1);
        decay('happiness', pet.illness ? 1.3 * 1.4 : 1.3, 1);
        decay('energy', 1.1, 1);
        decay('hygiene', 0.9, 1);
        decay('discipline', 0.2, 1);
      }
      pet.weight = clamp(pet.weight - 0.01 * minutes, 10, 200);
      pet.age += minutes;

      var damage = 0;
      if (pet.hunger <= 0) damage += 1.3;
      if (pet.hygiene <= 0) damage += 1.1;
      if (pet.happiness <= 0) damage += 0.5;
      if (pet.energy <= 0) damage += 0.35;
      if (damage > 0) {
        pet.health = clamp(pet.health - damage * minutes, 0, 100);
      } else if (pet.hunger > 45 && pet.hygiene > 45 && pet.happiness > 35) {
        pet.health = clamp(pet.health + 0.35 * minutes, 0, 100);
      }

      if (pet.illness) {
        pet.health = clamp(pet.health - 0.9 * minutes, 0, 100);
        if (pet.hunger > 70 && pet.hygiene > 70) {
          pet.illness.care = (pet.illness.care || 0) + minutes;
          if (pet.illness.care >= 30) {
            addLog(state, pet.name + ' se recuperou de ' + pet.illness.type + ' com bons cuidados!', 'good');
            pet.illness = null;
            pet.message = 'Estou melhor! ✨';
          }
        }
      } else {
        var risk = 0;
        if (pet.hygiene < 15) risk += 0.9;
        if (pet.hunger < 10) risk += 0.6;
        if (pet.happiness < 10) risk += 0.3;
        pet.risk = clamp((pet.risk || 0) + risk * minutes, 0, 40);
        if (pet.risk >= 20) {
          pet.illness = { type: pick(['resfriado', 'indigestão', 'febre']), since: time, care: 0 };
          pet.risk = 0;
          pet.message = 'Ai, estou doente! 🤒';
          addLog(state, pet.name + ' ficou doente: ' + pet.illness.type + '. Use um remédio!', 'bad');
          events.sick = true;
          events.sickName = pet.name;
        }
      }

      if (pet.health <= 0) {
        pet.status = 'critical';
        pet.criticalAt = time;
        pet.sleeping = false;
        pet.message = 'Está muito fraco... precisa de um Elixir da vida!';
        addLog(state, pet.name + ' entrou em estado crítico! Use um elixir para reanimar.', 'bad');
        events.died = true;
        events.criticalName = pet.name;
      }

      var next = pet.stageIndex < DATA.STAGES.length - 1 ? DATA.stage(pet.stageIndex + 1) : null;
      if (next && pet.age >= next.min && pet.care >= next.care && pet.status === 'alive') {
        pet.stageIndex += 1;
        events.sticker = unlockSticker(state, pet.speciesId, pet.stageIndex);
        events.evolved = true;
        events.evolvedName = pet.name;
        events.stageUp = next;
        pet.message = 'Evoluiu para ' + next.name.toLowerCase() + '!';
        addLog(state, pet.name + ' evoluiu para ' + next.name + '!', 'good');
        state.coins += 25 * (pet.stageIndex + 1);
        state.totals.earned += 25 * (pet.stageIndex + 1);
      } else if (next && pet.age >= next.min && pet.care < next.care) {
        pet.message = 'Precisa de mais cuidados para evoluir (' + pet.care + '/' + next.care + ').';
      } else if (!pet.sleeping && pet.health > 40 && time - (pet.lastMessageAt || 0) > 45000) {
        pet.message = statusText(pet);
        pet.lastMessageAt = time;
      }

      pet.level = levelFromXp(pet.xp);
      snapshot(state, pet);
    });

    checkAchievements(state, activePet(state));
    state.updatedAt = time;
    return events;
  }

  function statusText(pet) {
    if (pet.illness) return pick(['Estou doente... 🤒', 'Preciso de remédio!', 'Ai, que mal-estar...']);
    if (pet.hunger < 20) return pick(['Estou com fome! 🍽️', 'Tem algo para comer?', 'Meu estômago roncou...']);
    if (pet.energy < 20) return pick(['Estou cansado... 😴', 'Preciso dormir...', 'Não aguento mais!']);
    if (pet.hygiene < 20) return pick(['Estou sujinho! 🛁', 'Preciso de um banho!', 'Eca, estou imundo!']);
    if (pet.happiness < 25) return pick(['Estou entediado...', 'Brinca comigo? 🥺', 'Ninguém me dá atenção...']);
    if (pet.health < 45) return pick(['Não estou me sentindo bem 🤒', 'Preciso de remédio...']);
    return pick(['Hoje vai ser um bom dia!', 'Estou feliz! ✨', 'Vamos brincar?', 'Que dia lindo!', 'Te adoro! 💜']);
  }

  function addXp(state, pet, amount) {
    var oldLevel = pet.level;
    amount = Math.round(amount * (state.buffs && state.buffs.tea > now() ? 1.25 : 1));
    pet.xp += amount;
    pet.level = levelFromXp(pet.xp);
    if (pet.level > oldLevel) {
      var reward = 20 + pet.level * 5;
      state.coins += reward;
      state.totals.earned += reward;
      addLog(state, pet.name + ' subiu para o nível ' + pet.level + '! (+' + reward + ' 🪙)', 'good');
      pet.message = 'Subi de nível! ' + pet.level + ' 🎉';
    }
  }

  function canAct(pet, result) {
    if (!pet) return false;
    if (pet.status === 'gone') {
      result.msg = pet.name + ' já não está mais aqui.';
      return false;
    }
    if (pet.status === 'critical') {
      result.msg = pet.name + ' está em estado crítico. Use um Elixir da vida!';
      return false;
    }
    return true;
  }

  function useItem(state, itemId, options) {
    var result = { ok: false, msg: 'Item inválido.' };
    if (itemId === 'elixir') return revive(state);
    var pet = activePet(state);
    if (!canAct(pet, result)) return result;
    var item = DATA.item(itemId);
    if (!item) return result;
    if (item.type === 'accessory' && pet.accessory === itemId) {
      result.msg = pet.name + ' já está com ' + item.name + ' ' + item.emoji + '.';
      return result;
    }
    if (!state.inventory[itemId] || state.inventory[itemId] < 1) {
      result.msg = 'Você não tem ' + item.name + '. Compre na loja!';
      return result;
    }
    if (pet.sleeping && (item.type === 'food' || item.type === 'toy')) {
      result.msg = 'Acorde ' + pet.name + ' antes de fazer isso.';
      return result;
    }
    if (pet.hunger >= 100 && item.type === 'food' && item.id !== 'energy') {
      result.msg = pet.name + ' já está satisfeito!';
      return result;
    }
    if (pet.hygiene >= 100 && item.type === 'care' && item.hygiene && !item.health) {
      result.msg = pet.name + ' já está limpo!';
      return result;
    }
    state.inventory[itemId] -= 1;
    if (state.inventory[itemId] <= 0) delete state.inventory[itemId];

    if (item.type === 'accessory') {
      var previousId = pet.accessory;
      pet.accessory = itemId;
      if (previousId && previousId !== itemId) {
        state.inventory[previousId] = (state.inventory[previousId] || 0) + 1;
        var previous = DATA.item(previousId);
        result.msg = pet.name + ' trocou ' + previous.name + ' por ' + item.name + '. ' + previous.name + ' voltou para a bolsa.';
      } else {
        result.msg = pet.name + ' equipou ' + item.name + ' ' + item.emoji;
      }
    } else if (item.type === 'decor') {
      var previousDecor = decorItemFor(state.activeDecor);
      state.activeDecor = item.decor;
      result.msg = 'Quarto decorado com ' + item.name + ' ' + item.emoji;
      if (previousDecor && previousDecor.id !== itemId) {
        state.inventory[previousDecor.id] = (state.inventory[previousDecor.id] || 0) + 1;
        result.msg += ' ' + previousDecor.name + ' voltou para a bolsa.';
      }
    } else {
      var event = DATA.eventForDay(new Date());
      var foodBonus = item.type === 'food' ? ((event.effect && event.effect.food) || 1) : 1;
      ['hunger', 'happiness', 'energy', 'hygiene', 'health', 'discipline'].forEach(function (key) {
        if (item[key]) pet[key] = clamp(pet[key] + item[key] * (key === 'hunger' ? foodBonus : 1), 0, 100);
      });
      if (item.cures && pet.illness) {
        addLog(state, pet.name + ' foi curado de ' + pet.illness.type + '!', 'good');
        pet.illness = null;
      }
      if (item.buff && DATA.BUFFS[item.buff]) {
        var buff = applyBuff(state, item.buff, item.buffMinutes, now());
        addLog(state, buff.name + ' ativo por ' + DATA.BUFFS[item.buff].minutes + ' min.', 'good');
      }
      if (item.weight) pet.weight = clamp(pet.weight + item.weight, 10, 200);
      if (item.type === 'food') {
        pet.hygiene = clamp(pet.hygiene - 3, 0, 100);
        pet.energy = clamp(pet.energy - 1, 0, 100);
        state.totals.feeds += 1;
        bumpQuest(state, 'feed', 1);
        result.msg = pet.name + ' comeu ' + item.name + (item.buff && DATA.BUFFS[item.buff] ? ' • ' + DATA.BUFFS[item.buff].name + ' ativo!' : '') + '.';
        addLog(state, pet.name + ' comeu ' + item.name + '.', 'good');
        pet.message = pick(traitLines(pet, 'feed').concat(['Nhm! Estava com fome!', 'Delicioso! 😋', 'Obrigado pela comida!']));
      } else if (item.type === 'toy') {
        pet.hunger = clamp(pet.hunger - 5, 0, 100);
        state.totals.plays += 1;
        result.msg = pet.name + ' brincou com ' + item.name + '.';
        addLog(state, pet.name + ' brincou com ' + item.name + '.', 'good');
        pet.message = pick(traitLines(pet, 'play').concat(['Que diversão! 🎉', 'Mais uma vez!', 'Estou me divertindo!']));
      } else {
        if (item.hygiene) {
          state.totals.baths += 1;
          bumpQuest(state, 'bath', 1);
        }
        result.msg = pet.name + ' usou ' + item.name + '.';
        if (item.health) addLog(state, pet.name + ' usou ' + item.name + '.', 'good');
        pet.message = pick(['Ahh, que alívio!', 'Estou melhor agora! ✨', 'Valeu!']);
      }
    }

    pet.care += careQuality(pet);
    addXp(state, pet, item.xp || 4);
    if (result.msg === 'Item inválido.') result.msg = item.name + ' usado!';
    result.ok = true;
    checkAchievements(state, pet);
    pet.updatedAt = now();
    return result;
  }

  function freeAction(state, kind) {
    var result = { ok: false, msg: 'Ação indisponível.' };
    var pet = activePet(state);
    if (!canAct(pet, result)) return result;
    var time = now();
    var cooldowns = { train: 30000, talk: 15000, pet: 4000 };

    if (kind === 'sleep') {
      if (pet.status !== 'alive') return result;
      pet.sleeping = !pet.sleeping;
      if (pet.sleeping) {
        pet.message = pick(traitLines(pet, 'sleep').concat(['Boa noite... 💤']));
        addLog(state, pet.name + ' foi dormir.', 'info');
        bumpQuest(state, 'sleep', 1);
        unlock(state, 'sleep');
      } else {
        pet.message = 'Bom dia! ☀️';
        addLog(state, pet.name + ' acordou.', 'info');
      }
      result.ok = true;
      result.msg = pet.sleeping ? pet.name + ' está dormindo. A energia vai subir.' : pet.name + ' acordou!';
      return result;
    }

    if (pet.sleeping) {
      result.msg = pet.name + ' está dormindo. Acorde-o primeiro!';
      return result;
    }

    if (cooldowns[kind] && time - (pet[kind === 'pet' ? 'lastPetAt' : kind === 'train' ? 'lastTrainAt' : 'lastTalkAt'] || 0) < cooldowns[kind]) {
      result.msg = 'Espere um instantinho... ⏳';
      return result;
    }

    if (kind === 'train') {
      pet.discipline = clamp(pet.discipline + 8, 0, 100);
      pet.happiness = clamp(pet.happiness - 7, 0, 100);
      pet.energy = clamp(pet.energy - 6, 0, 100);
      state.totals.trains += 1;
      bumpQuest(state, 'train', 1);
      pet.lastTrainAt = time;
      pet.message = 'Treino concluído! 💪';
      addXp(state, pet, 12);
      result.msg = pet.name + ' treinou! Disciplina +8.';
    } else if (kind === 'pet') {
      pet.happiness = clamp(pet.happiness + 6, 0, 100);
      pet.affection += 1;
      bumpQuest(state, 'pet', 1);
      pet.lastPetAt = time;
        pet.message = pick(traitLines(pet, 'pet').concat(['Hehe, é bom ser mimado! 💜', 'Você é o melhor!', 'Carinho é tudo!']));
      addXp(state, pet, 3);
      result.msg = pet.name + ' adorou o carinho!';
    } else if (kind === 'talk') {
      pet.happiness = clamp(pet.happiness + 5, 0, 100);
      pet.lastTalkAt = time;
      pet.message = pick(traitLines(pet, 'talk').concat(['Oi! Como vai?', 'Conta-me uma história!', 'Amo conversar com você!', 'Que legal você estar aqui!']));
      addXp(state, pet, 3);
      result.msg = pet.message;
    } else {
      return result;
    }

    pet.care += careQuality(pet);
    result.ok = true;
    checkAchievements(state, pet);
    pet.updatedAt = now();
    return result;
  }

  function revive(state) {
    var result = { ok: false, msg: '' };
    var pet = activePet(state);
    if (!pet || pet.status !== 'critical') {
      result.msg = 'Nenhum bichinho está em estado crítico.';
      return result;
    }
    if (!state.inventory.elixir) {
      result.msg = 'Você precisa de um Elixir da vida (🧪).';
      return result;
    }
    state.inventory.elixir -= 1;
    if (state.inventory.elixir <= 0) delete state.inventory.elixir;
    pet.status = 'alive';
    pet.criticalAt = null;
    pet.health = 65;
    pet.energy = Math.max(pet.energy, 35);
    pet.hunger = Math.max(pet.hunger, 35);
    pet.hygiene = Math.max(pet.hygiene, 35);
    pet.message = 'Estou vivo! Obrigado! ✨';
    addXp(state, pet, 25);
    addLog(state, pet.name + ' foi reanimado com um elixir!', 'good');
    unlock(state, 'revive');
    result.ok = true;
    result.msg = pet.name + ' está de volta!';
    return result;
  }

  function buy(state, itemId, quantity) {
    var item = DATA.item(itemId);
    var qty = Math.max(1, Math.min(99, Number(quantity) || 1));
    if (!item) return { ok: false, msg: 'Item inválido.' };
    var cost = item.price * qty;
    if (state.coins < cost) return { ok: false, msg: 'Moedas insuficientes! Você tem ' + state.coins + ' 🪙.' };
    state.coins -= cost;
    state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
    addLog(state, 'Comprou ' + qty + 'x ' + item.name + ' (-' + cost + ' 🪙).', 'info');
    return { ok: true, msg: qty + 'x ' + item.name + ' adicionado ao inventário.' };
  }

  function craft(state, recipeId) {
    var recipe = DATA.RECIPES.find(function (entry) { return entry.id === recipeId; });
    if (!recipe) return { ok: false, msg: 'Receita inválida.' };
    var missing = Object.keys(recipe.ingredients).filter(function (id) {
      return (state.inventory[id] || 0) < recipe.ingredients[id];
    });
    if (missing.length) {
      var names = missing.map(function (id) { return DATA.item(id).name; }).join(', ');
      return { ok: false, msg: 'Faltam ingredientes: ' + names + '.' };
    }
    Object.keys(recipe.ingredients).forEach(function (id) {
      state.inventory[id] -= recipe.ingredients[id];
      if (state.inventory[id] <= 0) delete state.inventory[id];
    });
    state.inventory[recipe.result] = (state.inventory[recipe.result] || 0) + recipe.amount;
    state.totals.crafted += recipe.amount;
    var pet = activePet(state);
    if (pet) addXp(state, pet, recipe.xp || 5);
    addLog(state, 'Criou ' + recipe.amount + 'x ' + recipe.name + ' na oficina.', 'good');
    checkAchievements(state, pet);
    return { ok: true, msg: recipe.name + ' criado! Verifique seu inventário.' };
  }

  function cook(state, dishId) {
    var dish = DATA.DISHES.find(function (entry) { return entry.id === dishId; });
    if (!dish) return { ok: false, msg: 'Prato inválido.' };
    var missing = Object.keys(dish.ingredients).filter(function (id) {
      return (state.inventory[id] || 0) < dish.ingredients[id];
    });
    if (missing.length) {
      var names = missing.map(function (id) { return DATA.item(id).name; }).join(', ');
      return { ok: false, msg: 'Faltam ingredientes: ' + names + '.' };
    }
    Object.keys(dish.ingredients).forEach(function (id) {
      state.inventory[id] -= dish.ingredients[id];
      if (state.inventory[id] <= 0) delete state.inventory[id];
    });
    state.inventory[dish.result] = (state.inventory[dish.result] || 0) + dish.amount;
    state.totals.cooked += dish.amount;
    var pet = activePet(state);
    if (pet) addXp(state, pet, dish.xp || 5);
    addLog(state, 'Cozinhou ' + dish.amount + 'x ' + dish.name + '.', 'good');
    checkAchievements(state, pet);
    return { ok: true, msg: dish.name + ' pronto! Use o prato para ativar o bônus.' };
  }

  function sell(state, itemId, quantity) {
    var item = DATA.item(itemId);
    var qty = Math.max(1, Math.min(99, Number(quantity) || 1));
    if (!item || !state.inventory[itemId]) return { ok: false, msg: 'Você não tem esse item.' };
    var owned = state.inventory[itemId];
    var amount = Math.min(qty, owned);
    var refund = Math.max(1, Math.floor(item.price * 0.5)) * amount;
    state.inventory[itemId] = owned - amount;
    if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
    state.coins += refund;
    addLog(state, 'Vendeu ' + amount + 'x ' + item.name + ' (+' + refund + ' 🪙).', 'info');
    return { ok: true, msg: 'Vendido por ' + refund + ' 🪙.' };
  }

  function unequip(state) {
    var pet = activePet(state);
    if (!pet || !pet.accessory) return { ok: false, msg: 'Nenhum acessório equipado.' };
    var item = DATA.item(pet.accessory);
    state.inventory[pet.accessory] = (state.inventory[pet.accessory] || 0) + 1;
    pet.accessory = null;
    return { ok: true, msg: item.name + ' guardado no inventário.' };
  }

  function removeDecor(state) {
    if (!state.activeDecor) return { ok: false, msg: 'Nenhuma decoração ativa.' };
    var item = decorItemFor(state.activeDecor);
    state.activeDecor = null;
    if (item) state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
    return { ok: true, msg: item ? item.name + ' guardada no inventário.' : 'Decoração removida.' };
  }

  function ensureAdventure(state) {
    if (!state.adventure || typeof state.adventure !== 'object') state.adventure = defaultState().adventure;
    if (!isFinite(state.adventure.walks)) state.adventure.walks = 0;
    if (!isFinite(state.adventure.battles)) state.adventure.battles = 0;
    if (!isFinite(state.adventure.wins)) state.adventure.wins = 0;
    if (!isFinite(state.adventure.bosses)) state.adventure.bosses = 0;
    return state.adventure;
  }

  function goWalk(state, placeId) {
    var pet = activePet(state);
    var place = DATA.walk(placeId);
    if (!pet || pet.status !== 'alive') return { ok: false, msg: 'Seu bichinho precisa de cuidados antes de passear.' };
    if (!place) return { ok: false, msg: 'Esse passeio não existe.' };
    if (pet.level < place.minLevel) return { ok: false, msg: 'Chegue ao nível ' + place.minLevel + ' para ir a ' + place.name + '.' };
    if (pet.energy < place.cost) return { ok: false, msg: 'Muita cansado para passear. Deixe ele dormir! 😴' };
    var adventure = ensureAdventure(state);
    var event = DATA.eventForDay(new Date());
    var walkFactor = (event.effect && event.effect.walk) || 1;
    var roll = ((adventure.walks * 37 + pet.level * 11) % 100) / 100;
    var coins = Math.max(1, Math.round((place.coins[0] + Math.floor(roll * (place.coins[1] - place.coins[0] + 1))) * walkFactor));
    var xpRoll = ((roll * 7 + 0.13) % 1);
    var xp = Math.max(1, Math.round((place.xp[0] + Math.floor(xpRoll * (place.xp[1] - place.xp[0] + 1))) * walkFactor));
    var loot = (adventure.walks + place.minLevel) % 3 === 0
      ? place.loot[(adventure.walks + pet.level) % place.loot.length]
      : null;
    pet.energy = clamp(pet.energy - place.cost, 0, 100);
    pet.happiness = clamp(pet.happiness + 10, 0, 100);
    pet.hunger = clamp(pet.hunger - 5, 0, 100);
    pet.hygiene = clamp(pet.hygiene - (placeId === 'beach' ? 3 : 6), 0, 100);
    pet.care += careQuality(pet);
    state.coins += coins;
    state.totals.earned += coins;
    if (loot) state.inventory[loot] = (state.inventory[loot] || 0) + 1;
    adventure.walks += 1;
    adventure.lastWalk = place.id;
    state.totals.walks += 1;
    bumpQuest(state, 'walk', 1);
    bumpQuest(state, 'earn', coins);
    addXp(state, pet, xp);
    var parts = ['+' + coins + ' 🪙', '+' + xp + ' XP'];
    if (loot) parts.push(DATA.item(loot).emoji + ' ' + DATA.item(loot).name);
    var message = place.emoji + ' Passeio no ' + place.name + ': ' + parts.join(' • ');
    addLog(state, message, 'good');
    checkAchievements(state, pet);
    return { ok: true, msg: message, coins: coins, xp: xp, loot: loot };
  }

  function startBattle(state, enemyId) {
    var pet = activePet(state);
    var enemy = DATA.enemy(enemyId);
    if (!pet || pet.status !== 'alive') return { ok: false, msg: 'Seu bichinho precisa de cuidados antes de lutar.' };
    if (!enemy) return { ok: false, msg: 'Esse inimigo não existe.' };
    var adventure = ensureAdventure(state);
    if (adventure.battle) return { ok: false, msg: 'Termine a batalha atual primeiro.' };
    if (pet.level < enemy.minLevel) return { ok: false, msg: 'Chegue ao nível ' + enemy.minLevel + ' para enfrentar ' + enemy.name + '.' };
    if (pet.energy < 6) return { ok: false, msg: 'Muita cansado para lutar. Deixe ele dormir! 😴' };
    var hp = Math.floor(clamp(35 + pet.level * 8 + pet.health * 0.3, 35, 200));
    adventure.battle = {
      enemyId: enemy.id,
      hp: hp,
      maxHp: hp,
      enemyHp: enemy.hp,
      turn: 1,
      log: [enemy.emoji + ' Um ' + enemy.name + ' apareceu!']
    };
    pet.energy = clamp(pet.energy - 4, 0, 100);
    addLog(state, 'Batalha contra ' + enemy.name + ' começou!', 'info');
    return { ok: true, msg: enemy.emoji + ' ' + enemy.name + ' apareceu! Escolha sua ação.' };
  }

  function battleMove(state, move) {
    var pet = activePet(state);
    var adventure = ensureAdventure(state);
    var battle = adventure.battle;
    if (!pet || !battle) return { ok: false, msg: 'Não há batalha em andamento.' };
    var enemy = DATA.enemy(battle.enemyId);
    if (!enemy) { adventure.battle = null; return { ok: false, msg: 'Batalha inválida.' }; }
    var event = DATA.eventForDay(new Date());
    var damage = 0;
    var enemyDamage = 0;
    if (move === 'item') {
      var healItem = Object.keys(DATA.BATTLE_HEALS).find(function (id) { return (state.inventory[id] || 0) > 0; });
      if (!healItem) return { ok: false, msg: 'Sem itens de cura no inventário.' };
      state.inventory[healItem] -= 1;
      if (state.inventory[healItem] <= 0) delete state.inventory[healItem];
      var heal = DATA.BATTLE_HEALS[healItem];
      var restored = Math.min(heal, battle.maxHp - battle.hp);
      battle.hp += restored;
      battle.log.push(DATA.item(healItem).emoji + ' ' + pet.name + ' usou ' + DATA.item(healItem).name + ' e recuperou ' + restored + ' HP.');
    } else if (move === 'flee') {
      var escaped = (adventure.battles + battle.turn) % 2 === 0;
      if (escaped) {
        pet.energy = clamp(pet.energy - 2, 0, 100);
        adventure.battle = null;
        adventure.battles += 1;
        state.totals.battles += 1;
        battle.log.push('🏃 Você fugiu da batalha.');
        addLog(state, 'Fugiu da batalha contra ' + enemy.name + '.', 'info');
        checkAchievements(state, pet);
        return { ok: true, fled: true, msg: '🏃 Você fugiu com sucesso!' };
      }
      battle.log.push('🚫 Não conseguiu fugir!');
    } else if (move === 'defend') {
      battle.log.push('🛡️ ' + pet.name + ' se defendeu.');
    } else {
      var variance = ((adventure.battles + battle.turn) % 5) - 2;
      var baseDamage = 3 + pet.level * 2 + Math.floor(pet.discipline / 15) + variance - enemy.def;
      damage = Math.max(1, Math.round(baseDamage * ((event.effect && event.effect.battle) || 1)));
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.log.push('⚔️ ' + pet.name + ' causou ' + damage + ' de dano.');
      if (battle.enemyHp <= 0) {
        var coins = enemy.coins + Math.floor(pet.level / 2);
        var xp = enemy.xp + Math.floor(pet.level / 3);
        var loot = (adventure.battles + pet.level) % 2 === 0 ? enemy.loot : null;
        state.coins += coins;
        state.totals.earned += coins;
        if (loot) state.inventory[loot] = (state.inventory[loot] || 0) + 1;
        adventure.battle = null;
        adventure.battles += 1;
        adventure.wins += 1;
        state.totals.battles += 1;
        state.totals.wins += 1;
        if (enemy.boss) {
          adventure.bosses += 1;
          state.totals.bosses += 1;
        }
        pet.happiness = clamp(pet.happiness + 12, 0, 100);
        pet.care += careQuality(pet);
        bumpQuest(state, 'battle', 1);
        bumpQuest(state, 'earn', coins);
        addXp(state, pet, xp);
        var rewardParts = ['+' + coins + ' 🪙', '+' + xp + ' XP'];
        if (loot) rewardParts.push(DATA.item(loot).emoji + ' ' + DATA.item(loot).name);
        var victory = '🏆 Vitória contra ' + enemy.name + ': ' + rewardParts.join(' • ');
        addLog(state, victory, 'good');
        checkAchievements(state, pet);
        return { ok: true, won: true, msg: victory, coins: coins, xp: xp, loot: loot };
      }
    }
    var guard = move === 'defend' ? 0.5 : 1;
    enemyDamage = Math.max(1, Math.round((enemy.atk - Math.floor(pet.level / 3)) * guard));
    battle.hp = Math.max(0, battle.hp - enemyDamage);
    battle.log.push(enemy.emoji + ' ' + enemy.name + ' causou ' + enemyDamage + ' de dano.');
    if (battle.hp <= 0) {
      pet.health = 1;
      pet.status = 'critical';
      pet.criticalAt = now();
      adventure.battle = null;
      adventure.battles += 1;
      state.totals.battles += 1;
      addLog(state, 'Derrota contra ' + enemy.name + '. ' + pet.name + ' ficou crítico!', 'bad');
      return { ok: true, lost: true, msg: '💔 ' + pet.name + ' ficou ferido e precisa de cuidados.' };
    }
    pet.energy = clamp(pet.energy - 2, 0, 100);
    battle.turn += 1;
    if (battle.log.length > 8) battle.log.shift();
    return { ok: true, msg: battle.log[battle.log.length - 1], damage: damage, enemyDamage: enemyDamage, hp: battle.hp, enemyHp: battle.enemyHp };
  }

  function gameReward(state, gameId, score, maxScore) {
    var pet = activePet(state);
    if (!pet) return { ok: false, msg: '' };
    score = clamp(Math.round(score), 0, maxScore);
    var ratio = score / maxScore;
    var event = DATA.eventForDay(new Date());
    var luck = state.buffs && state.buffs.luck > now() ? 1.25 : 1;
    var coins = Math.round((8 + ratio * 42) * ((event.effect && event.effect.coins) || 1) * luck);
    var xp = Math.round(6 + ratio * 24);
    state.coins += coins;
    state.totals.earned += coins;
    state.totals.games += 1;
    ensureDaily(state);
    bumpQuest(state, 'game', 1);
    bumpQuest(state, 'earn', coins);
    pet.happiness = clamp(pet.happiness + 8 + ratio * 12, 0, 100);
    pet.energy = clamp(pet.energy - 8, 0, 100);
    pet.hunger = clamp(pet.hunger - 4, 0, 100);
    pet.care += careQuality(pet);
    addXp(state, pet, xp);
    var game = DATA.GAMES.find(function (item) { return item.id === gameId; });
    addLog(state, 'Minigame ' + (game ? game.name : '') + ': ' + score + '/' + maxScore + ' (+' + coins + ' 🪙).', 'good');
    var loot = null;
    if (gameId === 'fish') {
      var options = DATA.fishForDay(new Date());
      var fish = options[Math.floor(Math.random() * options.length)];
      var amount = Math.max(1, Math.round(ratio * 3));
      state.inventory[fish.itemId] = (state.inventory[fish.itemId] || 0) + amount;
      state.totals.fished += amount;
      loot = { name: fish.name, emoji: fish.emoji, itemId: fish.itemId, amount: amount };
      addLog(state, 'Pesca: ' + amount + 'x ' + fish.name + ' ' + fish.emoji + '.', 'good');
    }
    pet.message = ratio > 0.7 ? 'Ganhei! Somos ótimos juntos! 🏆' : 'Foi divertido! Vamos de novo?';
    checkAchievements(state, pet);
    return {
      ok: true,
      gameId: gameId,
      coins: coins,
      xp: xp,
      loot: loot,
      msg: 'Pontuação ' + score + '/' + maxScore + ' • +' + coins + ' 🪙 • +' + xp + ' XP' + (loot ? ' • +' + loot.amount + 'x ' + loot.name : ''),
      ratio: ratio
    };
  }

  function getAlerts(pet) {
    if (!pet || pet.status !== 'alive') return [];
    var alerts = [];
    if (pet.illness) alerts.push(pet.name + ' está doente: ' + pet.illness.type + '!');
    if (pet.hunger < 20) alerts.push(pet.name + ' está com fome!');
    if (pet.energy < 20) alerts.push(pet.name + ' está cansado!');
    if (pet.hygiene < 20) alerts.push(pet.name + ' precisa de banho!');
    if (pet.happiness < 20) alerts.push(pet.name + ' está triste!');
    if (pet.health < 40) alerts.push(pet.name + ' está doente!');
    return alerts;
  }

  function exportSave(state) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }

  function importSave(code) {
    try {
      return sanitizeSave(JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))));
    } catch (error) {
      return null;
    }
  }

  function autoBackup(state) {
    try {
      var pet = activePet(state);
      var payload = {
        savedAt: now(),
        name: pet ? pet.name : '',
        coins: Math.floor(num(state.coins, 0, 0, 1000000000)),
        code: exportSave(state)
      };
      global.localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readAutoBackupPayload() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(AUTO_BACKUP_KEY);
      if (!raw) return null;
      var payload = JSON.parse(raw);
      if (!payload || typeof payload.code !== 'string' || !payload.code) return null;
      return payload;
    } catch (error) {
      return null;
    }
  }

  function autoBackupInfo() {
    var payload = readAutoBackupPayload();
    if (!payload) return null;
    return {
      savedAt: num(payload.savedAt, 0, 0, Date.now() + 86400000),
      name: String(payload.name || 'Bichinho').slice(0, 18),
      coins: Math.floor(num(payload.coins, 0, 0, 1000000000))
    };
  }

  function loadAutoBackup() {
    var payload = readAutoBackupPayload();
    return payload ? importSave(payload.code) : null;
  }

  function clearAutoBackup() {
    try {
      if (global.localStorage) global.localStorage.removeItem(AUTO_BACKUP_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function statsSummary(state) {
    var keys = ['hunger', 'happiness', 'energy', 'hygiene', 'health'];
    var records = {};
    var sums = {};
    var counts = 0;
    var samples = 0;
    keys.forEach(function (key) {
      records[key] = { max: 0, min: 100, avg: 0 };
      sums[key] = 0;
    });
    Object.keys(state.history || {}).forEach(function (id) {
      (state.history[id] || []).forEach(function (entry) {
        samples += 1;
        keys.forEach(function (key) {
          var value = num(entry[key], 0, 0, 100);
          sums[key] += value;
          records[key].max = Math.max(records[key].max, value);
          records[key].min = Math.min(records[key].min, value);
        });
      });
    });
    counts = samples || 1;
    keys.forEach(function (key) { records[key].avg = Math.round(sums[key] / counts); });
    if (!samples) keys.forEach(function (key) { records[key].min = 0; });
    return {
      records: records,
      samples: samples,
      bestStreak: state.streak ? state.streak.best : 0,
      totals: state.totals
    };
  }

  global.TamaEngine = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_PETS: MAX_PETS,
    defaultState: defaultState,
    load: load,
    save: save,
    saveSlot: saveSlot,
    loadSlot: loadSlot,
    deleteSlot: deleteSlot,
    listSlots: listSlots,
    sanitizeSave: sanitizeSave,
    ensureDaily: ensureDaily,
    ensureGarden: ensureGarden,
    ensureRoutine: ensureRoutine,
    ensureRanking: ensureRanking,
    bumpRanking: bumpRanking,
    cropStatus: cropStatus,
    plantCrop: plantCrop,
    waterCrop: waterCrop,
    harvestCrop: harvestCrop,
    routineEntries: routineEntries,
    nextRoutine: nextRoutine,
    checkStreak: checkStreak,
    dailyCheckin: dailyCheckin,
    checkBirthdays: checkBirthdays,
    unlockSticker: unlockSticker,
    exchangeSticker: exchangeSticker,
    choosePath: choosePath,
    checkVisitors: checkVisitors,
    companionFriend: companionFriend,
    ensureCompanions: ensureCompanions,
    bumpCompanionRequests: bumpCompanionRequests,
    readCompanionStory: readCompanionStory,
    focusStart: focusStart,
    focusStop: focusStop,
    focusTick: focusTick,
    buyDeal: buyDeal,
    addMoment: addMoment,
    goWalk: goWalk,
    startBattle: startBattle,
    battleMove: battleMove,
    bumpQuest: bumpQuest,
    localDateKey: dateKey,
    ensureWeekly: ensureWeekly,
    careQuality: careQuality,
    tick: tick,
    createPet: createPet,
    activePet: activePet,
    useItem: useItem,
    freeAction: freeAction,
    revive: revive,
    buy: buy,
    addXp: addXp,
    craft: craft,
    cook: cook,
    tradeItem: tradeItem,
    activeBuffs: activeBuffs,
    buffFactor: buffFactor,
    duplicateStickers: duplicateStickers,
    sell: sell,
    unequip: unequip,
    removeDecor: removeDecor,
    gameReward: gameReward,
    statsSummary: statsSummary,
    checkAchievements: checkAchievements,
    calculateMood: calculateMood,
    moodOf: moodOf,
    stageOf: stageOf,
    speciesOf: speciesOf,
    displayName: displayName,
    levelFromXp: levelFromXp,
    xpToNext: xpToNext,
    getAlerts: getAlerts,
    addLog: addLog,
    unlock: unlock,
    exportSave: exportSave,
    importSave: importSave,
    autoBackup: autoBackup,
    autoBackupInfo: autoBackupInfo,
    loadAutoBackup: loadAutoBackup,
    clearAutoBackup: clearAutoBackup,
    statusText: statusText
  };
})(window);
