(function (global) {
  'use strict';

  var E = global.TamaEngine;
  var UI = global.TamaUI;
  var A = global.TamaAudio;
  var Games = global.TamaGames;
  var D = global.TamaData;

  var state = null;
  var currentTab = 'inventory';
  var currentFilter = 'all';
  var slowCounter = 0;
  var themeKey = '';
  var clockDayKey = 0;
  var unlockedCache = [];
  var questCache = [];
  var weeklyCache = [];
  var installPrompt = null;
  var pendingUpdateWorker = null;
  var hadServiceWorkerController = false;
  var refreshingAfterUpdate = false;

  function persist() { E.save(state); }

  function syncUpdateButton(available) {
    var button = document.getElementById('updateBtn');
    if (!button) return;
    button.classList.toggle('has-update', available);
    button.title = available ? 'Atualização disponível' : 'Verificar atualização';
    button.setAttribute('aria-label', button.title);
  }

  function showUpdateAvailable(worker) {
    if (!worker || pendingUpdateWorker === worker) return;
    pendingUpdateWorker = worker;
    var banner = document.getElementById('updateBanner');
    if (banner) banner.hidden = false;
    syncUpdateButton(true);
    UI.toast('Nova versão disponível. Toque em “Atualizar agora”.', 'good');
  }

  function hideUpdateAvailable() {
    pendingUpdateWorker = null;
    var banner = document.getElementById('updateBanner');
    if (banner) banner.hidden = true;
    syncUpdateButton(false);
  }

  function applyUpdate() {
    var worker = pendingUpdateWorker;
    if (!worker) return;
    hideUpdateAvailable();
    UI.closeModal();
    try { global.localStorage.setItem('tamavida.justUpdated', '1'); } catch (e) { /* noop */ }
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  function manualUpdateCheck(button) {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistration) {
      UI.toast('Atualização disponível só no modo app/navegador compatível.', 'info');
      return;
    }
    if (button) { button.disabled = true; button.textContent = '⏳ Verificando...'; }
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (!registration) {
        UI.toast('Service worker não registrado. Abra pelo servidor/app instalado.', 'bad');
        return;
      }
      return registration.update().then(function () {
        if (registration.waiting) {
          showUpdateAvailable(registration.waiting);
          return;
        }
        setTimeout(function () {
          if (!pendingUpdateWorker) UI.toast('Você já está na versão mais recente.', 'info');
        }, 1500);
      });
    }).catch(function () {
      UI.toast('Não foi possível verificar atualização agora.', 'bad');
    }).finally(function () {
      if (button) { button.disabled = false; button.textContent = '⬆️ Verificar atualização'; }
    });
  }

  function checkUpdateQuietly() {
    if (document.visibilityState !== 'visible' || !('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistration) return;
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (registration) return registration.update();
    }).catch(function () { /* noop */ });
  }

  function statsOf(pet) {
    if (!pet) return {};
    return {
      hunger: pet.hunger,
      happiness: pet.happiness,
      energy: pet.energy,
      hygiene: pet.hygiene,
      health: pet.health
    };
  }

  function fmtAway(minutes) {
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    return hours + 'h ' + (minutes % 60) + 'min';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function shopQuantity() {
    var select = document.getElementById('shopQty');
    return Math.max(1, Math.min(99, Number(select && select.value) || 1));
  }

  function confirmPurchase(label, cost, apply) {
    if (state.coins < cost) {
      return afterAction({ ok: false, msg: 'Moedas insuficientes! Você tem ' + state.coins + ' 🪙.' });
    }
    UI.showConfirm(
      '🪙 Confirmar compra?',
      escapeHtml(label) + ' custa ' + cost + ' moedas.',
      '<p>Você tem <b>' + state.coins + ' 🪙</b> e ficará com <b>' + (state.coins - cost) + ' 🪙</b> após a compra.</p>',
      apply,
      'Comprar por ' + cost + ' 🪙'
    );
    A.play('click');
    return { ok: true };
  }

  function exportCsv() {
    var header = ['pet', 'data', 'fome', 'felicidade', 'energia', 'higiene', 'saude'];
    var lines = [header.join(',')];
    Object.keys(state.history || {}).forEach(function (id) {
      var pet = state.pets.find(function (item) { return item.id === id; });
      (state.history[id] || []).forEach(function (entry) {
        lines.push([
          pet ? pet.name : 'Bichinho',
          new Date(entry.t).toLocaleString('pt-BR'),
          entry.hunger, entry.happiness, entry.energy, entry.hygiene, entry.health
        ].map(function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }).join(','));
      });
    });
    try {
      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'tamavida-historico.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast('Histórico exportado em CSV.', 'good');
    } catch (error) {
      UI.toast('Não foi possível exportar o CSV.', 'bad');
    }
  }

  function exportMomentsPng() {
    if (!state.moments.length) {
      UI.toast('Registre um momento antes de exportar.', 'bad');
      return;
    }
    try {
      var width = 640;
      var height = 80 + state.moments.length * 128;
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas indisponível');
      ctx.fillStyle = '#17102b';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f4efff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('📸 Meus momentos TamaVida', 28, 44);
      state.moments.forEach(function (moment, index) {
        var y = 70 + index * 128;
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(24, y, width - 48, 112);
        ctx.font = '36px sans-serif';
        ctx.fillText(moment.mood || '✨', 40, y + 48);
        ctx.fillStyle = '#f4efff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(moment.title.slice(0, 34), 92, y + 36);
        ctx.fillStyle = '#a99fc4';
        ctx.font = '13px sans-serif';
        ctx.fillText(moment.name + ' • ' + new Date(moment.t).toLocaleString('pt-BR'), 92, y + 58);
        ctx.fillStyle = '#f4efff';
        ctx.font = '14px sans-serif';
        ctx.fillText(moment.note.slice(0, 58), 92, y + 86);
      });
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'tamavida-momentos.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      UI.toast('Álbum de momentos exportado!', 'good');
    } catch (error) {
      UI.toast('Não foi possível exportar o PNG.', 'bad');
    }
  }

  function exportShareCard() {
    var pet = E.activePet(state);
    if (!pet) return;
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas indisponível');
      var gradient = ctx.createLinearGradient(0, 0, 640, 360);
      gradient.addColorStop(0, '#3b2470');
      gradient.addColorStop(1, '#17102b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(24, 24, 592, 312);
      ctx.fillStyle = '#f4efff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('🐾 TamaVida', 48, 64);
      ctx.font = '96px sans-serif';
      ctx.fillText(D.species(pet.speciesId).emoji, 48, 184);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(pet.name.slice(0, 18), 180, 142);
      ctx.fillStyle = '#cfc3f0';
      ctx.font = '18px sans-serif';
      ctx.fillText(D.stage(pet.stageIndex).name + ' • Nível ' + pet.level + ' • ' + E.moodOf(pet).label, 180, 174);
      ctx.fillText(E.statusText ? E.statusText(pet) : 'Cuidando todos os dias', 180, 202);
      ctx.fillStyle = '#f4efff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('🔥 ' + state.streak.count + ' dias   🪙 ' + state.coins + '   🏆 ' + Object.keys(state.achievements).length + '/' + D.ACHIEVEMENTS.length + '   📔 ' + Object.keys(state.stickers).length + '/' + D.STICKERS.length, 48, 264);
      ctx.fillStyle = '#a99fc4';
      ctx.font = '15px sans-serif';
      ctx.fillText('Criado com carinho • ' + new Date().toLocaleDateString('pt-BR'), 48, 306);
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'tamavida-cartao.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      UI.toast('Cartão de status exportado!', 'good');
    } catch (error) {
      UI.toast('Não foi possível criar o cartão.', 'bad');
    }
  }

  function saveToSlot(index) {
    if (E.saveSlot(state, index)) persist();
    else UI.toast('Não foi possível salvar neste slot.', 'bad');
  }

  function loadFromSlot(index) {
    var loaded = E.loadSlot(index);
    if (!loaded) {
      UI.toast('Esse slot está vazio.', 'bad');
      return;
    }
    state = loaded;
    unlockedCache = Object.keys(state.achievements);
    questCache = (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; });
    weeklyCache = (state.weekly && state.weekly.quests || []).map(function (quest) { return quest.claimed; });
    A.setEnabled(state.settings.sound);
    A.setMusic(state.settings.music);
    UI.applyTheme(state);
    UI.closeModal();
    refresh();
    scheduleReminders();
    UI.toast('Slot ' + index + ' carregado!', 'good');
  }

  function achievementDiff(before, after) {
    var names = [];
    after.forEach(function (id) {
      if (before.indexOf(id) === -1) {
        var achievement = D.ACHIEVEMENTS.find(function (item) { return item.id === id; });
        if (achievement) names.push(achievement.emoji + ' ' + achievement.name);
      }
    });
    names.forEach(function (name, index) {
      setTimeout(function () { UI.toast('Conquista: ' + name + '! +50 🪙', 'good'); A.play('level'); }, 300 + index * 400);
    });
  }

  function questDiff(before) {
    if (!state.daily || !state.daily.quests) return;
    state.daily.quests.forEach(function (quest, index) {
      if (quest.claimed && !before[index]) {
        setTimeout(function () {
          UI.toast('✅ Missão: ' + quest.name + '! +' + quest.reward + ' 🪙', 'good');
          A.play('coin');
        }, 500 + index * 250);
      }
    });
  }

  function weeklyDiff(before) {
    if (!state.weekly || !state.weekly.quests) return;
    state.weekly.quests.forEach(function (quest, index) {
      if (quest.claimed && !before[index]) {
        setTimeout(function () {
          UI.toast('🗓️ Semanal: ' + quest.name + '! +' + quest.reward + ' 🪙', 'good');
          A.play('coin');
        }, 650 + index * 250);
      }
    });
  }

  function announceStreak(info) {
    if (!info || !info.reward) return;
    setTimeout(function () {
      UI.toast('🔥 ' + info.count + ' dia(s) seguido(s)! +' + info.reward + ' 🪙', 'good');
      A.play('coin');
    }, 900);
  }

  function announceExtraEvents(events) {
    if (!events) return;
    if (events.birthday && events.birthday.length) {
      setTimeout(function () {
        UI.playFx('🎂', 8);
        A.play('happy');
        UI.toast('🎂 Feliz aniversário, ' + events.birthday.join(' e ') + '! Ganhou bolo e moedas.', 'good');
      }, 400);
      refresh();
    }
    if (events.sticker && events.sticker.ok) {
      setTimeout(function () {
        UI.toast((events.sticker.duplicate ? '♻️ ' : '🌟 ') + events.sticker.msg, 'good');
        A.play('coin');
      }, 600);
    }
    if (events.visitor) {
      setTimeout(function () {
        UI.playFx(events.visitor.visitor.emoji, 5);
        UI.toast(events.visitor.visitor.emoji + ' ' + events.visitor.visitor.name + ' ' + events.visitor.visitor.msg + '! ' + events.visitor.notes.join(' • '), 'good');
        A.play('happy');
      }, 1000);
      refresh();
    }
    if (events.focus && events.focus.completed) {
      setTimeout(function () {
          UI.toast('🧠 ' + (events.focus.mode === 'break' ? 'Pausa' : 'Foco' + (events.focus.task ? ': ' + events.focus.task : '')) + ' concluído! +' + events.focus.coins + ' 🪙', 'good');
        A.play('level');
      }, 800);
      refresh();
    }
  }

  function refresh(options) {
    options = options || {};
    UI.render(state, { tab: options.tab || currentTab, filter: options.filter || currentFilter });
    unlockedCache = Object.keys(state.achievements);
    questCache = (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; });
    weeklyCache = (state.weekly && state.weekly.quests || []).map(function (quest) { return quest.claimed; });
    persist();
  }

  function haptic(pattern) {
    try {
      if (navigator.vibrate && state && state.settings && state.settings.vibration !== false && !state.settings.reduceMotion) navigator.vibrate(pattern || 12);
    } catch (e) { /* noop */ }
  }

  function afterAction(result, options) {
    options = options || {};
    if (!result || !result.ok) {
      if (result && result.msg) UI.toast(result.msg, 'bad');
      A.play('error');
      haptic([18, 40, 18]);
      return result;
    }
    if (result.msg) UI.toast(result.msg, options.type || 'good');
    if (options.sound) A.play(options.sound);
    if (options.fx) UI.playFx(options.fx, options.fxCount || 3);
    if (options.actionFx) UI.setActionFx(options.actionFx);
    if (options.haptic) haptic(options.haptic);
    achievementDiff(options.achievementsBefore || unlockedCache, Object.keys(state.achievements));
    questDiff(options.questsBefore || questCache);
    weeklyDiff(options.weeklyBefore || weeklyCache);
    refresh(options);
    return result;
  }

  function rewardOf(fn) {
    return {
      before: Object.keys(state.achievements),
      questsBefore: (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; }),
      weeklyBefore: (state.weekly && state.weekly.quests || []).map(function (quest) { return quest.claimed; }),
      result: fn()
    };
  }

  function perform(action, data) {
    data = data || {};
    var outcome;
    var pet = E.activePet(state);

    if (action === 'free') {
      outcome = rewardOf(function () { return E.freeAction(state, data.kind); });
      var sound = { sleep: 'sleep', train: 'game', pet: 'happy', talk: 'click' }[data.kind];
      var emoji = { pet: '💜', talk: '💬', train: '💪', sleep: '💤' }[data.kind];
      return afterAction(outcome.result, { sound: sound, fx: emoji, fxCount: data.kind === 'pet' ? 4 : 2, haptic: 10, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'daily-checkin') {
      var checkinResult = E.dailyCheckin(state);
      return afterAction(checkinResult, { sound: checkinResult.ok ? 'coin' : 'error', fx: checkinResult.ok ? '🎁' : null, fxCount: 5, haptic: checkinResult.ok ? [12, 30, 12] : 0, type: 'info' });
    }

    if (action === 'plant-crop') {
      var plantResult = E.plantCrop(state, data.crop, data.plot);
      return afterAction(plantResult, { sound: plantResult.ok ? 'coin' : 'error', fx: plantResult.ok ? '🌱' : null, fxCount: 4 });
    }

    if (action === 'water-crop') {
      var waterResult = E.waterCrop(state, data.plot);
      return afterAction(waterResult, { sound: waterResult.ok ? 'happy' : 'error', fx: waterResult.ok ? '💧' : null, fxCount: 4 });
    }

    if (action === 'harvest-crop') {
      var harvestResult = E.harvestCrop(state, data.plot);
      return afterAction(harvestResult, { sound: harvestResult.ok ? 'coin' : 'error', fx: harvestResult.ok ? '🌾' : null, fxCount: 5 });
    }

    if (action === 'use-item') {
      var item = D.item(data.item);
      function applyItem() {
        var itemOutcome = rewardOf(function () { return E.useItem(state, data.item); });
        var itemType = item && item.type;
        return afterAction(itemOutcome.result, {
          sound: itemType === 'food' ? 'eat' : itemType === 'toy' ? 'game' : itemType === 'decor' ? 'level' : 'happy',
          fx: item ? item.emoji : '✨',
          fxCount: itemType === 'decor' ? 6 : 3,
          actionFx: itemType === 'food' ? 'eat' : itemType === 'toy' ? 'play' : null,
          achievementsBefore: itemOutcome.before, questsBefore: itemOutcome.questsBefore,
          weeklyBefore: itemOutcome.weeklyBefore
        });
      }
      if (data.item === 'elixir') {
        var elixirPet = E.activePet(state);
        if (!elixirPet || elixirPet.status !== 'critical') {
          UI.toast('Use o elixir somente em um bichinho em estado crítico.', 'bad');
          A.play('error');
          return { ok: false };
        }
        var elixirName = escapeHtml(elixirPet.name || 'seu bichinho');
        UI.showConfirm(
          '🧪 Usar Elixir da vida?',
          'Gasta 1 unidade para reanimar ' + elixirName + '.',
          '<p>O elixir vai para <b>' + elixirName + '</b>, o bichinho ativo agora. Confira o nome antes de confirmar.</p>',
          applyItem,
          'Reanimar ' + elixirName
        );
        A.play('click');
        return { ok: true };
      }
      return applyItem();
    }

    if (action === 'revive') {
      outcome = rewardOf(function () { return E.revive(state); });
      return afterAction(outcome.result, { sound: 'evolve', fx: '✨', fxCount: 8, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'buy') {
      var buyItem = D.item(data.item);
      if (!buyItem) return afterAction({ ok: false, msg: 'Item inválido.' });
      var buyQty = shopQuantity();
      return confirmPurchase(buyQty + 'x ' + buyItem.name, buyItem.price * buyQty, function () {
        return afterAction(E.buy(state, data.item, buyQty), { sound: 'coin', type: 'info' });
      });
    }

    if (action === 'craft') {
      outcome = rewardOf(function () { return E.craft(state, data.recipe); });
      return afterAction(outcome.result, { sound: 'level', fx: '🛠️', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'cook') {
      outcome = rewardOf(function () { return E.cook(state, data.dish); });
      return afterAction(outcome.result, { sound: 'happy', fx: '🍳', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'buy-deal') {
      var deal = D.dealsForDay().find(function (entry) { return entry.itemId === data.item; });
      var dealItem = deal ? D.item(deal.itemId) : null;
      if (!deal || !dealItem) return afterAction({ ok: false, msg: 'Oferta inválida.' });
      var qtyDeal = shopQuantity();
      return confirmPurchase(qtyDeal + 'x ' + dealItem.name + ' (oferta)', deal.price * qtyDeal, function () {
        return afterAction(E.buyDeal(state, data.item, qtyDeal), { sound: 'coin', type: 'info' });
      });
    }

    if (action === 'go-walk') {
      outcome = rewardOf(function () { return E.goWalk(state, data.place); });
      return afterAction(outcome.result, { sound: 'happy', fx: '🌳', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'start-battle') {
      return afterAction(E.startBattle(state, data.enemy), { sound: 'game', type: 'info' });
    }

    if (action === 'battle-move') {
      outcome = rewardOf(function () { return E.battleMove(state, data.move); });
      return afterAction(outcome.result, { sound: data.move === 'item' ? 'eat' : 'game', fx: data.move === 'flee' ? '🏃' : data.move === 'item' ? '💊' : '⚔️', fxCount: 3, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'focus-start') {
      var taskInput = document.getElementById('focusTask');
      return afterAction(E.focusStart(state, data.minutes, data.mode, taskInput ? taskInput.value : ''), { sound: 'click', type: 'info' });
    }

    if (action === 'focus-stop') {
      return afterAction(E.focusStop(state), { sound: 'click', type: 'info' });
    }

    if (action === 'focus-reset') {
      state.focus = { running: false, mode: 'focus', minutes: 25, task: '', endsAt: 0, remaining: 25 * 60000 };
      refresh();
      UI.toast('Timer de foco zerado.', 'info');
      return { ok: true };
    }

    if (action === 'exchange-sticker') {
      outcome = rewardOf(function () { return E.exchangeSticker(state); });
      return afterAction(outcome.result, { sound: 'coin', fx: '🌟', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'trade-item') {
      outcome = rewardOf(function () { return E.tradeItem(state, data.trade); });
      return afterAction(outcome.result, { sound: 'coin', fx: '🔄', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
    }

    if (action === 'add-moment') {
      UI.showMoment(function (title, note) {
        outcome = rewardOf(function () { return E.addMoment(state, title, note); });
        afterAction(outcome.result, { sound: 'happy', fx: '📸', fxCount: 4, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore });
      });
      return { ok: true };
    }

    if (action === 'export-moments') {
      exportMomentsPng();
      return { ok: true };
    }

    if (action === 'share-card') {
      exportShareCard();
      return { ok: true };
    }

    if (action === 'sell') {
      return afterAction(E.sell(state, data.item), { sound: 'coin', type: 'info' });
    }

    if (action === 'unequip') {
      return afterAction(E.unequip(state), { sound: 'click', type: 'info' });
    }

    if (action === 'remove-decor') {
      return afterAction(E.removeDecor(state), { sound: 'click', type: 'info', fx: '✨', fxCount: 3 });
    }

    if (action === 'switch-pet') {
      if (!state.pets.some(function (item) { return item.id === data.id; })) return null;
      state.activePetId = data.id;
      UI.closeModal();
      refresh();
      UI.toast('Agora você está cuidando de ' + E.activePet(state).name + '.', 'info');
      A.play('click');
      return { ok: true };
    }

    if (action === 'open-adopt') {
      UI.showAdoption(state, function (speciesId, name) {
        var adopted = E.createPet(state, speciesId, name);
        UI.closeModal();
        afterAction(adopted, { sound: 'happy', fx: '🐣', fxCount: 5 });
      });
      return { ok: true };
    }

    if (action === 'open-inventory') {
      currentTab = 'inventory';
      currentFilter = data.filter || 'all';
      refresh({ tab: currentTab, filter: currentFilter });
      var card = document.getElementById('tabsCard');
      if (card) card.scrollIntoView({ behavior: U.scrollBehavior(state), block: 'start' });
      A.play('click');
      return { ok: true };
    }

    if (action === 'open-shop') {
      currentTab = 'shop';
      refresh({ tab: currentTab });
      var card2 = document.getElementById('tabsCard');
      if (card2) card2.scrollIntoView({ behavior: U.scrollBehavior(state), block: 'start' });
      A.play('click');
      return { ok: true };
    }

    if (action === 'go-games' || action === 'open-games') {
      var world = document.getElementById('sectionWorld');
      if (world) world.scrollIntoView({ behavior: U.scrollBehavior(state), block: 'start' });
      A.play('click');
      return { ok: true };
    }

    if (action === 'play-game' || action === 'replay-game') {
      return startGame(data.game);
    }

    if (action === 'care-menu') {
      UI.showCareMenu(state);
      A.play('click');
      return { ok: true };
    }

    if (action === 'open-tutorial') {
      UI.showTutorial(state, function () {
        state.tutorial.done = true;
        persist();
        refresh();
      }, function (step) {
        state.tutorial.step = step;
        persist();
      }, { restart: !!(data && data.restart) });
      A.play('click');
      return { ok: true };
    }

    if (action === 'choose-path') {
      var petForPath = E.activePet(state);
      if (!petForPath || petForPath.stageIndex < 4 || petForPath.path) {
        UI.toast('O caminho já foi escolhido ou ainda não está disponível.', 'info');
        return { ok: false };
      }
      UI.showPathChoice(state, function (pathId) {
        var outcome = rewardOf(function () { return E.choosePath(state, pathId); });
        afterAction(outcome.result, { sound: 'level', fx: '🌟', fxCount: 6, achievementsBefore: outcome.before, questsBefore: outcome.questsBefore, weeklyBefore: outcome.weeklyBefore });
      });
      A.play('click');
      return { ok: true };
    }

    if (action === 'help') {
      UI.showHelp();
      return { ok: true };
    }

    if (action === 'settings') {
      UI.showSettings(state, {
        onChange: function (key, value) {
          if (key === 'sound') { A.setEnabled(value); syncClock(); }
          if (key === 'music') A.setMusic(value);
          if (key === 'ambientSound') syncClock();
          if (key === 'notifications') {
            if (value) requestNotifications();
            else {
              reminderTimers.forEach(function (timer) { clearTimeout(timer); });
              reminderTimers = [];
            }
          }
          if (key === 'reminderMorning' || key === 'reminderEvening' || key.indexOf('routine:') === 0) scheduleReminders();
          if (key === 'theme' || key === 'contrast' || key === 'fontSize' || key === 'reduceMotion' || key === 'visualCues') UI.applyTheme(state);
          if (key === 'theme') syncClock();
          UI.renderTopbar(state);
          persist();
        },
        onSlotSave: saveToSlot,
        onSlotLoad: loadFromSlot,
        onCheckUpdate: manualUpdateCheck
      });
      A.play('click');
      return { ok: true };
    }

    if (action === 'export-save') { UI.showExport(state); persist(); return { ok: true }; }
    if (action === 'export-csv') { exportCsv(); return { ok: true }; }

    if (action === 'import-save') {
      UI.showImport(state, function (imported) {
        state = imported;
        unlockedCache = Object.keys(state.achievements);
        questCache = (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; });
        weeklyCache = (state.weekly && state.weekly.quests || []).map(function (quest) { return quest.claimed; });
        A.setEnabled(state.settings.sound);
        A.setMusic(state.settings.music);
        UI.closeModal();
        refresh();
        scheduleReminders();
        UI.toast('Progresso importado com sucesso!', 'good');
      });
      return { ok: true };
    }

    if (action === 'check-update') {
      manualUpdateCheck(null);
      return { ok: true };
    }

    if (action === 'reset-game') {
      UI.showReset(function () {
        try { global.localStorage.removeItem(E.STORAGE_KEY); } catch (error) { /* noop */ }
        state = E.defaultState();
        A.setMusic(false);
        UI.closeModal();
        refresh();
          UI.showAdoption(state, function (speciesId, name) {
            var adopted = E.createPet(state, speciesId, name);
            UI.closeModal();
            afterAction(adopted, { sound: 'happy', fx: '🐣', fxCount: 5 });
            if (!state.tutorial.done) setTimeout(function () { perform('open-tutorial'); }, 500);
          });
        });
        return { ok: true };
    }

    if (action === 'alert-action') {
      if (data.kind === 'revive') return perform('revive');
      if (data.kind === 'adopt') return perform('open-adopt');
      return perform(data.kind, data);
    }

    return null;
  }

  function startGame(gameId) {
    if (!state || !state.pets.length) return null;
    var pet = E.activePet(state);
    if (pet.status !== 'alive') {
      UI.toast('Seu bichinho precisa de cuidados antes de brincar.', 'bad');
      return null;
    }
    if (pet.energy < 10) {
      UI.toast('Muita cansado para brincar. Deixe ele dormir! 😴', 'bad');
      return null;
    }
    UI.closeModal();
    var started = Games.start(gameId, function (result) {
      var before = Object.keys(state.achievements);
      var questsBefore = (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; });
      var reward = E.gameReward(state, result.gameId, result.score, result.maxScore);
      afterAction(reward, { sound: 'level', fx: '🪙', fxCount: 5, achievementsBefore: before, questsBefore: questsBefore });
      UI.showGameResult(reward);
    });
    if (!started) UI.toast('Não foi possível iniciar o jogo.', 'bad');
    else A.play('game');
    return { ok: started };
  }

  var reminderTimers = [];

  function requestNotifications() {
    if (!('Notification' in global)) {
      UI.toast('Este navegador não suporta notificações.', 'bad');
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          UI.toast('Notificações ativadas!', 'good');
          scheduleReminders();
        } else UI.toast('Permissão negada. Você pode ativar depois nas configurações.', 'bad');
      }).catch(function () { /* noop */ });
    } else if (Notification.permission === 'granted') scheduleReminders();
  }

  function showNotification(title, options) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function (registration) {
        if (registration.showNotification) registration.showNotification(title, options);
        else new Notification(title, options);
      }).catch(function () {
        try { new Notification(title, options); } catch (error) { /* noop */ }
      });
      return;
    }
    try { new Notification(title, options); } catch (error) { /* noop */ }
  }

  function notificationsReady() {
    return !!(state && state.settings.notifications && 'Notification' in global && Notification.permission === 'granted');
  }

  function checkNotifications() {
    if (!notificationsReady()) return;
    var pet = E.activePet(state);
    if (!pet) return;
    var alerts = E.getAlerts(pet);
    if (!alerts.length) return;
    alerts.forEach(function (alert) {
      if (Date.now() - (state.lastAlertAt[alert] || 0) < 20 * 60 * 1000) return;
      state.lastAlertAt[alert] = Date.now();
      showNotification('🐾 TamaVida precisa de você', {
        body: alert,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'tamavida-' + alert.slice(0, 8)
      });
    });
    persist();
  }

  function todayKey() {
    var date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function sendRoutineReminder(entry) {
    if (!notificationsReady()) return;
    var pet = E.activePet(state);
    if (!pet) return;
    var key = 'rotina-' + entry.key + ':' + todayKey();
    if (Date.now() - (state.lastAlertAt[key] || 0) < 20 * 60 * 60 * 1000) return;
    state.lastAlertAt[key] = Date.now();
    var hints = {
      feed: 'Hora de alimentar ' + pet.name + '! 🍗',
      bath: 'Hora do banho de ' + pet.name + '! 🛁',
      play: 'Hora de brincar com ' + pet.name + '! 🎮'
    };
    var alerts = E.getAlerts(pet);
    var hint = hints[entry.key] || 'Hora de cuidar de ' + pet.name + '!';
    var body = alerts.length ? hint + ' ' + alerts.slice(0, 2).join(' • ') : hint;
    showNotification('⏰ Rotina — ' + entry.emoji + ' ' + entry.label + ' (' + entry.time + ')', {
      body: body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'tamavida-rotina-' + entry.key
    });
    persist();
  }

  function scheduleReminders() {
    reminderTimers.forEach(function (timer) { clearTimeout(timer); });
    reminderTimers = [];
    if (!notificationsReady()) return;
    var now = Date.now();
    E.routineEntries(state, now).forEach(function (entry) {
      var target = entry.at <= now ? entry.at + 86400000 : entry.at;
      var timer = setTimeout(function () {
        sendRoutineReminder(entry);
        scheduleReminders();
      }, target - now);
      reminderTimers.push(timer);
    });
  }

  function handleClick(event) {
    var target = event.target.closest('[data-action], [data-scroll], [data-tab]');
    if (!target) return;
    if (target.dataset.scroll) {
      var section = document.getElementById(target.dataset.scroll);
      if (section) section.scrollIntoView({ behavior: U.scrollBehavior(state), block: 'start' });
      $$('.mobile-nav button').forEach(function (button) { button.classList.toggle('active', button === target); });
      return;
    }
    if (target.dataset.tab) {
      currentTab = target.dataset.tab;
      currentFilter = 'all';
      refresh({ tab: currentTab });
      A.play('click');
      return;
    }
    var action = target.dataset.action;
    if (!action) return;
    event.preventDefault();
    A.unlock();
    perform(action, {
      kind: target.dataset.kind,
      item: target.dataset.item,
      game: target.dataset.game,
        id: target.dataset.id,
        filter: target.dataset.filter,
        crop: target.dataset.crop,
        plot: target.dataset.plot,
        recipe: target.dataset.recipe,
        dish: target.dataset.dish,
        trade: target.dataset.trade,

        place: target.dataset.place,
        enemy: target.dataset.enemy,
        move: target.dataset.move,
        mode: target.dataset.mode,
        minutes: target.dataset.minutes,
        restart: target.dataset.restart === 'true'
      });
  }

  function $$(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function handleKeyboard(event) {
    var tag = (event.target && event.target.tagName || '').toLowerCase();
    var editable = ['input', 'textarea', 'select'].indexOf(tag) !== -1 || !!(event.target && event.target.isContentEditable);
    var overlay = document.querySelector('.game-overlay') || document.querySelector('.overlay');
    if (event.key === 'Escape') {
      if (Games.isRunning()) Games.close();
      else if (!(overlay && UI.isModalLocked())) UI.closeModal();
      return;
    }
    if (editable || overlay) return;
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      perform('help');
      return;
    }
    if (event.target && event.target.classList && event.target.classList.contains('tab') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      var tabs = $$('.tab');
      var index = tabs.indexOf(event.target);
      if (index !== -1) {
        var next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        next.focus();
        next.scrollIntoView({ behavior: U.scrollBehavior(state), block: 'nearest', inline: 'nearest' });
        next.click();
      }
      return;
    }
    if (currentTab === 'adventure' && state.adventure && state.adventure.battle) {
      var battleMove = { '1': 'attack', '2': 'defend', '3': 'item', '4': 'flee' }[event.key];
      if (battleMove) {
        event.preventDefault();
        perform('battle-move', { move: battleMove });
        return;
      }
    }
    if (['input', 'textarea', 'select', 'button', 'a'].indexOf(tag) !== -1) return;
    if (event.target && event.target.isContentEditable) return;
    if (event.code === 'Space') {
      event.preventDefault();
      perform('free', { kind: 'pet' });
    } else if (event.key === 'c' || event.key === 'C') {
      perform('open-shop');
    } else if (event.key === 'j' || event.key === 'J') {
      var games = D.GAMES;
      startGame(games[Math.floor(Math.random() * games.length)].id);
    }
  }

  function syncClock() {
    var info = UI.themeInfo(state);
    if (themeKey !== info.key) {
      themeKey = info.key;
      UI.applyTheme(state);
    }
    var day = D.dayIndex(new Date());
    if (clockDayKey && clockDayKey !== day) refresh();
    clockDayKey = day;
    var event = D.eventForDay(new Date());
    var ambient = 'none';
    if (state.settings.sound && state.settings.ambientSound) {
      if (event.id === 'chuva') ambient = 'rain';
      else if (event.id === 'neve') ambient = 'snow';
      else if (info.night) ambient = 'night';
    }
    A.setAmbient(ambient);
  }

  function onTick() {
    if (document.visibilityState !== 'visible') return;
    var events = E.tick(state);
    syncClock();
    announceStreak(events.streak);
    announceExtraEvents(events);
    if (events.sick) {
      A.play('alert');
      UI.playFx('🤒', 4);
      UI.toast('🤒 ' + (events.sickName || E.activePet(state).name) + ' ficou doente. Use um remédio!', 'bad');
      refresh();
    }
    if (events.evolved) {
      A.play('evolve');
      UI.playFx('✨', 8);
      UI.toast('🐣 ' + (events.evolvedName || E.activePet(state).name) + ' evoluiu para ' + events.stageUp.name + '!', 'good');
      refresh();
    }
    if (events.died) {
      A.play('alert');
      UI.toast('🚨 ' + (events.criticalName || 'Seu bichinho') + ' está em estado crítico!', 'bad');
      refresh();
    }
    UI.updateLive(state);
    slowCounter += 1;
    if (slowCounter >= 20) {
      slowCounter = 0;
      UI.renderPicker(state);
      UI.renderAlerts(state);
      UI.renderRight(state);
      if (currentTab === 'diary' || currentTab === 'achievements' || currentTab === 'chart') UI.renderTab(state, currentTab);
      checkNotifications();
      persist();
    }
  }

  function boot() {
    UI.init();
    global.addEventListener('tamavida:sound', function (event) {
      UI.showSoundCue(event.detail && event.detail.name);
    });
    state = E.load() || E.defaultState();
    if (!state.inventory) state.inventory = {};
    if (!state.log) state.log = [];
    unlockedCache = Object.keys(state.achievements || {});
    questCache = (state.daily && state.daily.quests || []).map(function (quest) { return quest.claimed; });
    weeklyCache = (state.weekly && state.weekly.quests || []).map(function (quest) { return quest.claimed; });

    var petBefore = E.activePet(state);
    var statsBefore = statsOf(petBefore);
    var awayMinutes = Math.max(0, Math.floor((Date.now() - (state.updatedAt || Date.now())) / 60000));
    var startupEvents = E.tick(state);
    if (!startupEvents.visitor) startupEvents.visitor = E.checkVisitors(state, Date.now(), 0);
    A.setEnabled(state.settings.sound);
    UI.applyTheme(state);
    themeKey = UI.themeInfo(state).key;
    clockDayKey = D.dayIndex(new Date());
    UI.render(state, { tab: currentTab });
    announceStreak(startupEvents.streak);
    announceExtraEvents(startupEvents);
    try {
      if (global.localStorage.getItem('tamavida.justUpdated')) {
        global.localStorage.removeItem('tamavida.justUpdated');
        setTimeout(function () { UI.toast('Atualizado para ' + D.VERSION + ' 🎉', 'good'); }, 900);
      }
    } catch (e) { /* noop */ }

    if (awayMinutes >= 2 && petBefore && state.pets.length) {
      var notes = [];
      if (startupEvents.sick) notes.push('Seu bichinho ficou doente enquanto você estava fora.');
      if (startupEvents.evolved && startupEvents.stageUp) notes.push('Ele evoluiu para ' + startupEvents.stageUp.name + '!');
      if (startupEvents.died) notes.push('Ele entrou em estado crítico e precisa de um elixir.');
      var awayEvent = D.eventForDay(new Date());
      notes.push('Evento de hoje: ' + awayEvent.emoji + ' ' + awayEvent.name + '.');
      if (startupEvents.visitor) notes.push(startupEvents.visitor.visitor.emoji + ' ' + startupEvents.visitor.visitor.name + ' passou por aqui: ' + startupEvents.visitor.notes.join(' • ') + '.');
      setTimeout(function () {
        UI.showAwaySummary({
          away: fmtAway(awayMinutes),
          before: statsBefore,
          after: statsOf(E.activePet(state)),
          notes: notes
        });
      }, 350);
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyboard);
    document.getElementById('soundBtn').addEventListener('click', function () {
      state.settings.sound = !state.settings.sound;
      A.setEnabled(state.settings.sound);
      if (state.settings.sound) A.play('click');
      UI.renderTopbar(state);
      persist();
      UI.toast(state.settings.sound ? 'Som ativado 🔊' : 'Som desativado 🔇', 'info');
    });
    document.getElementById('settingsBtn').addEventListener('click', function () { perform('settings'); });
    var updateBtn = document.getElementById('updateBtn');
    if (updateBtn) updateBtn.addEventListener('click', function () {
      A.play('click');
      if (pendingUpdateWorker) applyUpdate();
      else manualUpdateCheck(null);
    });
    var updateApplyBtn = document.getElementById('updateApplyBtn');
    if (updateApplyBtn) updateApplyBtn.addEventListener('click', applyUpdate);
    var updateLaterBtn = document.getElementById('updateLaterBtn');
    if (updateLaterBtn) updateLaterBtn.addEventListener('click', hideUpdateAvailable);
    var installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        A.play('click');
        if (installPrompt) {
          installPrompt.prompt();
          if (installPrompt.userChoice && installPrompt.userChoice.then) {
            installPrompt.userChoice.then(function (choice) {
              if (choice && choice.outcome === 'accepted') UI.toast('TamaVida instalado! 🎉', 'good');
              installPrompt = null;
              installBtn.hidden = true;
            });
          } else {
            installPrompt = null;
            installBtn.hidden = true;
          }
          return;
        }
        var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '') && !window.MSStream;
        var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
        if (ios && !standalone) {
          UI.openModal({
            title: '📲 Instalar no iPhone/iPad',
            sub: 'O Safari não mostra o prompt automático.',
            body: '<p>Toque em <b>Compartilhar</b> no Safari e depois em <b>Adicionar à Tela de Início</b>.</p>',
            actions: [{ label: 'Entendi', cls: 'primary' }]
          });
        } else {
          UI.toast('Use o menu do navegador para instalar o app.', 'info');
        }
      });
      var standaloneNow = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
      if (standaloneNow) installBtn.hidden = true;
    }

    global.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      installPrompt = event;
      var button = document.getElementById('installBtn');
      if (button) button.hidden = false;
    });
    global.addEventListener('appinstalled', function () {
      installPrompt = null;
      var button = document.getElementById('installBtn');
      if (button) button.hidden = true;
      UI.toast('TamaVida instalado! 🎉', 'good');
    });

    scheduleReminders();
    setInterval(onTick, 1000);
    setInterval(persist, 10000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        onTick();
        UI.updateLive(state);
        persist();
        checkUpdateQuietly();
      } else {
        persist();
      }
    });
    global.addEventListener('pageshow', checkUpdateQuietly);
    setInterval(checkUpdateQuietly, 10 * 60 * 1000);
    global.addEventListener('beforeunload', persist);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.register('service-worker.js').then(function (registration) {
        if (!registration) return;
        if (registration.waiting && navigator.serviceWorker.controller) showUpdateAvailable(registration.waiting);
        registration.addEventListener('updatefound', function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateAvailable(worker);
          });
        });
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (refreshingAfterUpdate || !hadServiceWorkerController) return;
          refreshingAfterUpdate = true;
          window.location.reload();
        });
        checkUpdateQuietly();
      }).catch(function () { /* noop */ });
    }

    if (!state.pets.length) {
      UI.showAdoption(state, function (speciesId, name) {
        var adopted = E.createPet(state, speciesId, name);
        UI.closeModal();
        afterAction(adopted, { sound: 'happy', fx: '🐣', fxCount: 5 });
        if (!state.tutorial.done) setTimeout(function () { perform('open-tutorial'); }, 500);
      });
    } else if (!state.tutorial.done) {
      setTimeout(function () { perform('open-tutorial'); }, awayMinutes >= 2 ? 1600 : 700);
    }

    var params = new URLSearchParams(location.search);
    var deepAction = params.get('action');
    if (deepAction === 'feed' || deepAction === 'play') {
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* noop */ }
      var runDeepLink = function () {
        if (document.querySelector('.overlay')) {
          setTimeout(runDeepLink, 500);
          return;
        }
        if (deepAction === 'feed') perform('open-inventory', { filter: 'food' });
        if (deepAction === 'play') perform('go-games');
      };
      setTimeout(runDeepLink, 400);
    }
  }

  global.TamaApp = {
    perform: perform,
    startGame: startGame,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
