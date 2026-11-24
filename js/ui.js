(function (global) {
  'use strict';

  var DATA = global.TamaData;
  var E = global.TamaEngine;
  var activeTab = 'inventory';
  var selectedSpecies = DATA.SPECIES[0].id;
  var modalRoot, toastRoot, gameRoot, soundCueRoot;
  var lastCueAt = 0;
  var lastCueName = '';

  var STATS = [
    { key: 'hunger', icon: '🍗', label: 'Fome', color: '#ffb46b' },
    { key: 'happiness', icon: '😄', label: 'Feliz', color: '#ff7bb8' },
    { key: 'energy', icon: '⚡', label: 'Energia', color: '#ffd76b' },
    { key: 'hygiene', icon: '🛁', label: 'Higiene', color: '#6cc6ff' },
    { key: 'health', icon: '❤️', label: 'Saúde', color: '#ff7286' },
    { key: 'discipline', icon: '🎓', label: 'Disciplina', color: '#8b6bff' }
  ];

  var TIPS = [
    ['Fome em queda', 'Alimente com frequência. Comidas muito doces aumentam o peso rapidamente.'],
    ['Humor importa', 'Brincar e fazer carinho aumentam a felicidade e aceleram a evolução.'],
    ['Higiene conta pontos', 'Manter a higiene alta evita que a saúde caia.'],
    ['Cuidados evoluem', 'Além da idade, é preciso acumular cuidados para mudar de fase.'],
    ['Sono recarrega', 'Enquanto dorme, a energia sobe e as outras necessidades caem mais devagar.'],
    ['Moedas fáceis', 'Os minigames rendem moedas e XP mesmo com pontuações medianas.'],
    ['Acessórios úteis', 'Cada acessório reduz a velocidade de queda de um atributo.'],
    ['Elixir salva vidas', 'Se a saúde chegar a zero, use um Elixir da vida para reanimar.']
  ];

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pct(value) { return Math.max(0, Math.min(100, Math.round(value))); }

  function fmtAge(minutes) {
    var total = Math.floor(minutes || 0);
    var days = Math.floor(total / 1440);
    var hours = Math.floor((total % 1440) / 60);
    var mins = total % 60;
    if (days) return days + 'd ' + hours + 'h';
    if (hours) return hours + 'h ' + mins + 'min';
    return mins + ' min';
  }

  function fmtTime(timestamp) {
    var date = new Date(timestamp);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function isBirthdayToday(pet) {
    if (!pet || !pet.bornAt) return false;
    var born = new Date(pet.bornAt);
    var today = new Date();
    return born.getMonth() === today.getMonth() && born.getDate() === today.getDate() &&
      Date.now() - pet.bornAt >= 20 * 60 * 60 * 1000;
  }

  function buildWeather() {
    var layer = document.getElementById('weatherLayer');
    if (!layer || layer.children.length) return;
    var html = '';
    for (var i = 0; i < 36; i += 1) {
      var top = Math.round(-24 + Math.random() * 300);
      var left = Math.round(Math.random() * 100);
      var height = 8 + Math.round(Math.random() * 10);
      var opacity = (0.4 + Math.random() * 0.5).toFixed(2);
      var duration = (0.55 + Math.random() * 0.55).toFixed(2);
      var delay = (Math.random() * 1.6).toFixed(2);
      html += '<i style="top:' + top + 'px;left:' + left + '%;height:' + height + 'px;opacity:' + opacity +
        ';animation-duration:' + duration + 's;animation-delay:-' + delay + 's"></i>';
    }
    for (var s = 0; s < 30; s += 1) {
      var snowTop = Math.round(-24 + Math.random() * 300);
      var snowLeft = Math.round(Math.random() * 100);
      var snowSize = (2 + Math.random() * 3).toFixed(1);
      var snowOpacity = (0.5 + Math.random() * 0.45).toFixed(2);
      var snowDuration = (2.4 + Math.random() * 2.2).toFixed(2);
      var snowDelay = (Math.random() * 4).toFixed(2);
      html += '<b style="top:' + snowTop + 'px;left:' + snowLeft + '%;width:' + snowSize + 'px;height:' + snowSize +
        'px;opacity:' + snowOpacity + ';animation-duration:' + snowDuration + 's;animation-delay:-' + snowDelay + 's"></b>';
    }
    layer.innerHTML = html;
  }

  function init() {
    modalRoot = document.getElementById('modalRoot');
    toastRoot = document.getElementById('toastRoot');
    soundCueRoot = document.getElementById('soundCueRoot');
    gameRoot = document.getElementById('gameRoot');
    buildWeather();
    $$('.tab').forEach(function (button) {
      button.id = 'tab-' + button.dataset.tab;
      button.setAttribute('aria-controls', 'tabPanel');
    });
  }

  function themeInfo(state, time) {
    var mode = (state && state.settings && state.settings.theme) || 'auto';
    var hour = new Date(time || Date.now()).getHours();
    var night = mode === 'night' || (mode === 'auto' && (hour >= 18 || hour < 6));
    return { mode: mode, night: night, key: mode + ':' + (night ? 'night' : 'day') };
  }

  function applyTheme(state) {
    var info = themeInfo(state);
    var night = info.night;
    document.body.dataset.theme = night ? 'night' : 'day';
    var settings = state.settings || {};
    document.body.dataset.contrast = settings.contrast || 'normal';
    document.body.dataset.font = settings.fontSize || 'normal';
    document.body.dataset.motion = settings.reduceMotion ? 'reduce' : 'normal';
    document.body.dataset.cues = settings.visualCues === false ? 'off' : 'on';
    var pill = $('#dayPill');
    if (pill) pill.textContent = night ? '🌙 Noite' : '☀️ Dia';
    var celestial = $('#celestial');
    if (celestial) celestial.textContent = night ? '🌙' : '☀️';
    var screen = $('#screen');
    if (screen) {
      var eventId = DATA.eventForDay(new Date()).id;
      screen.dataset.weather = eventId;
      screen.dataset.event = eventId;
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', night ? '#120d1f' : '#7c5cff');
  }

  function spriteMarkup(pet) {
    var species = E.speciesOf(pet);
    var stage = E.stageOf(pet);
    var mood = pet.status === 'critical' || pet.status === 'gone' || pet.illness || pet.health < 40 ? 'sick' :
      pet.sleeping ? 'sleep' : E.moodOf(pet).id;
    if (stage.id === 'egg') mood = 'egg';
    var item = pet.accessory ? DATA.item(pet.accessory) : null;
    var colorIndex = pet.color % species.colors.length;
    var palette = [0, 1, 2].map(function (offset) { return species.colors[(colorIndex + offset) % species.colors.length]; });
    if (stage.id !== 'egg') {
      var emojiSizes = { baby: '2.2rem', child: '3rem', teen: '3.8rem', adult: '4.6rem', elder: '4.4rem' };
      if (species.id === 'draco') { emojiSizes.adult = '5.6rem'; emojiSizes.elder = '5.4rem'; }
      return '<div class="sprite sprite-emoji sprite-' + species.id + '" style="--c1:' + palette[0] +
        ';--size:' + stage.size + ';--emoji-size:' + emojiSizes[stage.id] + '" ' +
        'data-species="' + species.id + '" data-stage="' + stage.id + '" data-mood="' + mood + '" ' +
        'data-accessory="' + (pet.accessory || '') + '" data-illness="' + (pet.illness ? '1' : '0') + '" id="petSprite">' +
        '<div class="shadow"></div>' +
        '<div class="mood-aura"></div>' +
        '<div class="pet-emoji">' + species.emoji + '</div>' +
        (DATA.path(pet.path) ? '<div class="path-badge">' + DATA.path(pet.path).emoji + '</div>' : '') +
        (item ? '<div class="sprite-accessory">' + item.emoji + '</div>' : '') +
        '</div>';
    }
    return '' +
      '<div class="sprite" style="--c1:' + palette[0] + ';--c2:' + palette[1] +
        ';--c3:' + palette[2] + ';--size:' + stage.size + '" ' +
        'data-species="' + species.id + '" data-stage="' + stage.id + '" data-mood="' + mood + '" ' +
        'data-accessory="' + (pet.accessory || '') + '" data-illness="' + (pet.illness ? '1' : '0') + '" id="petSprite">' +
        '<div class="shadow"></div>' +
        '<div class="mood-aura"></div>' +
        '<div class="creature">' +
          '<div class="tail"></div><div class="tail right"></div>' +
          '<div class="wing left"></div><div class="wing right"></div>' +
          '<div class="ear left"></div><div class="ear right"></div>' +
          '<div class="horn left"></div><div class="horn right"></div>' +
          '<div class="body">' +
            '<div class="belly"></div>' +
            '<div class="snout"></div>' +
            '<div class="eye left"></div><div class="eye right"></div>' +
            '<div class="closed-eye left"></div><div class="closed-eye right"></div>' +
            '<div class="cheek left"></div><div class="cheek right"></div>' +
            '<div class="mouth"></div>' +
            '<div class="egg-shell">✦ · ✦</div>' +
            '<div class="sweat">💧</div>' +
          '</div>' +
          '<div class="foot left"></div><div class="foot right"></div>' +
          (item ? '<div class="sprite-accessory">' + item.emoji + '</div><div class="accessory-glow">✦ ✧ ✦</div>' : '') +
        '</div>' +
      '</div>';
  }

  function renderPicker(state) {
    var mount = $('#petPicker');
    if (!mount) return;
    mount.innerHTML = state.pets.map(function (pet) {
      var species = E.speciesOf(pet);
      var active = pet.id === state.activePetId;
      return '<button class="pet-chip' + (active ? ' active' : '') + '" data-action="switch-pet" data-id="' + pet.id + '" type="button">' +
        '<span class="avatar">' + species.emoji + '</span>' +
        '<span class="pet-chip-info"><b>' + esc(pet.name) + '</b><small>Nv. ' + pet.level + ' • ' + E.stageOf(pet).name + '</small></span>' +
        '<span class="status-dot' + (pet.status !== 'alive' || pet.health < 40 ? ' bad' : '') + '"></span>' +
      '</button>';
    }).join('');
  }

  function renderPet(state) {
    var pet = E.activePet(state);
    var mount = $('#spriteMount');
    if (!mount || !pet) return;
    var stage = E.stageOf(pet);
    var species = E.speciesOf(pet);
    var mood = E.moodOf(pet);
    mount.innerHTML = spriteMarkup(pet);
    $('#petName').textContent = pet.name;
    $('#petSubtitle').textContent = stage.name + ' • ' + species.name + ' • ' + fmtAge(pet.age) +
      (isBirthdayToday(pet) ? ' 🎂 Aniversário!' : '');
    $('#petStatusPill').textContent = pet.status === 'critical' ? '🚨 Crítico' :
      pet.status === 'gone' ? '🕊️ Partiu' : pet.sleeping ? '😴 Dormindo' :
        pet.illness ? '🤒 ' + pet.illness.type : pet.health < 40 ? '🤒 Doente' : mood.emoji + ' ' + mood.label;
    $('#speech').textContent = pet.message || '...';
    $('#screen').classList.toggle('is-sleeping', !!pet.sleeping);
    $('#screen').classList.toggle('is-critical', pet.status === 'critical');
    $('#screen').dataset.decor = state.activeDecor || 'none';
    applyTheme(state);
  }

  function statMarkup(pet) {
    return STATS.map(function (stat) {
      var value = pct(pet[stat.key]);
      return '<div class="stat-row" data-stat="' + stat.key + '">' +
        '<span class="stat-icon">' + stat.icon + '</span>' +
        '<div class="stat-info">' +
          '<div class="stat-label"><span>' + stat.label + '</span></div>' +
          '<div class="bar"><i style="width:' + value + '%;--bar-color:' + stat.color + '"></i></div>' +
        '</div>' +
        '<span class="stat-value" style="color:' + stat.color + '">' + value + '</span>' +
      '</div>';
    }).join('');
  }

  function buffText(state) {
    var buffs = E.activeBuffs(state).map(function (buff) {
      return buff.emoji + ' ' + buff.name + ' ' + buff.remaining + 'min';
    });
    return buffs.length ? ' • ⏱️ ' + buffs.join(' • ') : '';
  }

  function renderStats(state) {
    var pet = E.activePet(state);
    if (!pet) return;
    $('#statsName').textContent = pet.name;
    var personality = DATA.personality(pet.personalityId);
    $('#moodLine').textContent = 'Humor: ' + E.moodOf(pet).label + ' • ' + E.displayName(pet) + ' • ' + personality.emoji + ' ' + personality.name + buffText(state);
    $('#levelBadge').textContent = 'Nv. ' + pet.level;
    $('#statsGrid').innerHTML = statMarkup(pet);
    $('#ageValue').textContent = fmtAge(pet.age);
    $('#weightValue').textContent = Math.round(pet.weight) + ' g';
    $('#affectionValue').textContent = pet.affection;
    $('#disciplineValue').textContent = Math.round(pet.discipline);
    var current = pet.xp - 20 * (pet.level - 1) * (pet.level - 1);
    var need = E.xpToNext(pet.level) - 20 * (pet.level - 1) * (pet.level - 1);
    var progress = need > 0 ? pct(current / need * 100) : 0;
    $('#xpLabel').textContent = Math.max(0, Math.round(current)) + ' / ' + Math.max(0, Math.round(need)) + ' XP';
    $('#xpBar').style.width = progress + '%';
    var pathBtn = $('#pathBtn');
    if (pathBtn) {
      pathBtn.hidden = pet.stageIndex < 4 || !!pet.path;
      var path = DATA.path(pet.path);
      pathBtn.textContent = path ? path.emoji + ' Caminho: ' + path.name : '🌟 Escolher caminho';
      pathBtn.disabled = !!pet.path;
    }
  }

  function renderActions(state) {
    var pet = E.activePet(state);
    if (!pet) return;
    var count = function (id) { return state.inventory[id] || 0; };
    var actions = [
      { icon: '🍗', label: 'Alimentar', action: 'open-inventory', filter: 'food', extra: '<small>' + (count('apple') + count('cookie') + count('sushi') + count('cake') + count('energy')) + ' na bolsa</small>', cls: 'primary' },
      { icon: '🎮', label: 'Brincar', action: 'go-games', extra: '<small>+ moedas e XP</small>', cls: 'primary' },
      { icon: '🛁', label: 'Banho', action: 'open-inventory', filter: 'care', extra: '<small>' + (count('soap') + count('shampoo')) + ' itens</small>' },
      { icon: '🛋️', label: 'Decorar', action: 'open-inventory', filter: 'decor', extra: '<small>' + DATA.ITEMS.filter(function (item) { return item.type === 'decor'; }).reduce(function (total, item) { return total + count(item.id); }, 0) + ' itens</small>' },
      { icon: pet.sleeping ? '☀️' : '😴', label: pet.sleeping ? 'Acordar' : 'Dormir', action: 'free', kind: 'sleep', extra: '<small>recarrega energia</small>' },
      { icon: '💪', label: 'Treinar', action: 'free', kind: 'train', extra: '<small>+ disciplina</small>', disabled: pet.sleeping },
      { icon: '🤗', label: 'Carinho', action: 'free', kind: 'pet', extra: '<small>+ felicidade</small>', disabled: pet.sleeping },
      { icon: '💬', label: 'Conversar', action: 'free', kind: 'talk', extra: '<small>+ humor</small>', disabled: pet.sleeping },
      { icon: '💊', label: 'Cuidar', action: 'care-menu', extra: '<small>saúde e reviver</small>' }
    ];
    $('#actionsGrid').innerHTML = actions.map(function (item) {
      return '<button class="action-btn ' + (item.cls || '') + '" type="button" data-action="' + item.action + '"' +
        (item.filter ? ' data-filter="' + item.filter + '"' : '') +
        (item.kind ? ' data-kind="' + item.kind + '"' : '') +
        (item.disabled || (pet.status !== 'alive' && item.action !== 'care-menu') ? ' disabled' : '') + '>' +
        '<span class="action-emoji">' + item.icon + '</span><span>' + item.label + '</span>' + (item.extra || '') +
      '</button>';
    }).join('');
  }

  function renderAlerts(state) {
    var pet = E.activePet(state);
    var mount = $('#careAlerts');
    if (!mount || !pet) return;
    var alerts = E.getAlerts(pet);
    if (pet.status === 'critical') {
      alerts = [{ text: 'Estado crítico! Reanime com um elixir.', action: 'revive', label: (state.inventory.elixir ? 'Reanimar' : 'Ver elixir') }];
    } else if (pet.status === 'gone') {
      alerts = [{ text: pet.name + ' não está mais aqui. Adote um novo amigo!', action: 'open-adopt', label: 'Adotar' }];
    }
    if (!alerts.length) {
      var next = pet.stageIndex < DATA.STAGES.length - 1 ? DATA.stage(pet.stageIndex + 1) : null;
      alerts = [{ text: next ? 'Tudo em dia! Faltam ' + Math.max(0, next.care - pet.care) + ' cuidados e ' + Math.max(0, Math.ceil(next.min - pet.age)) + ' min para evoluir.' : 'Tudo em dia! Seu bichinho chegou à última fase.', action: '', label: '' }];
    }
    var next = E.nextRoutine(state);
    var quick = null;
    if (!alerts.some(function (alert) { return alert.action; }) && pet.status === 'alive') {
      if (pet.illness || pet.health < 40) quick = { action: 'care-menu', label: 'Cuidar', icon: '💊', text: 'A saúde precisa de atenção agora.' };
      else if (pet.hunger < 20) quick = { action: 'open-inventory', filter: 'food', label: 'Alimentar', icon: '🍗', text: 'Dê um lanche rápido para recuperar a fome.' };
      else if (pet.energy < 20) quick = { action: 'free', kind: 'sleep', label: 'Dormir', icon: '😴', text: 'Um descanso rápido vai recuperar a energia.' };
      else if (pet.hygiene < 20) quick = { action: 'open-inventory', filter: 'care', label: 'Banho', icon: '🛁', text: 'Hora de um banho para ficar limpinho.' };
      else if (pet.happiness < 20) quick = { action: 'free', kind: 'pet', label: 'Carinho', icon: '🤗', text: 'Um carinho rápido melhora o humor.' };
    }
    mount.innerHTML = alerts.map(function (alert) {
      var cls = pet.status === 'critical' ? 'critical' : (alert.action ? '' : ' ok');
      return '<div class="alert-row ' + cls + '">🔔 <span>' + esc(alert.text) + '</span>' +
        (alert.action ? '<button class="alert-action" type="button" data-action="' + alert.action + '">' + esc(alert.label) + '</button>' : '') +
      '</div>';
    }).join('') +
      (quick ? '<div class="alert-row quick">' + quick.icon + ' <span>' + esc(quick.text) + '</span>' +
        '<button class="alert-action" type="button" data-action="' + quick.action + '"' +
        (quick.filter ? ' data-filter="' + quick.filter + '"' : '') +
        (quick.kind ? ' data-kind="' + quick.kind + '"' : '') + '>' + esc(quick.label) + '</button></div>' : '') +
      (next ? '<div class="alert-row routine">🗓️ <span>Próxima rotina: ' + next.emoji + ' ' + next.label + ' às ' + next.time + '</span></div>' : '');
  }

  function itemCard(item, state, pet, mode) {
    var owned = state.inventory[item.id] || 0;
    var tag = { food: 'comida', care: 'cuidado', toy: 'brinquedo', accessory: 'acessório', decor: 'decoração' }[item.type];
    var statLabels = { hunger: 'fome', happiness: 'humor', energy: 'energia', hygiene: 'higiene', health: 'saúde', discipline: 'disciplina' };
    var effects = [];
    Object.keys(statLabels).forEach(function (key) {
      if (item[key]) effects.push('+' + item[key] + ' ' + statLabels[key]);
    });
    if (item.bonus) {
      Object.keys(item.bonus).forEach(function (key) {
        if (statLabels[key]) effects.push('-' + Math.round(item.bonus[key] * 100) + '% queda de ' + statLabels[key]);
      });
    }
    if (item.warmth) effects.push('-' + Math.round(item.warmth * 100) + '% gasto de energia no frio');
    var buyDisabled = state.coins < item.price;
    var equipped = pet && ((pet.accessory === item.id) || (item.type === 'decor' && state.activeDecor === item.decor));

    if (mode === 'shop') {
      return '<div class="item-card">' +
        '<span class="item-emoji">' + item.emoji + '</span>' +
        '<span class="item-tag">' + tag + '</span>' +
        '<span class="item-name">' + esc(item.name) + '</span>' +
        '<span class="item-desc">' + esc(item.desc) + (effects.length ? '<br><b>' + effects.join(' · ') + '</b>' : '') + '</span>' +
        '<button class="item-buy" type="button" data-action="buy" data-item="' + item.id + '"' + (buyDisabled ? ' disabled' : '') + '>🪙 ' + item.price + ' • Comprar</button>' +
      '</div>';
    }

    var useLabel = item.id === 'elixir' ? 'Reanimar' : item.type === 'food' ? 'Comer' : item.type === 'toy' ? 'Brincar' : item.type === 'accessory' ? 'Equipar' : item.type === 'decor' ? 'Decorar' : 'Usar';
    var useDisabled = !pet || (item.id === 'elixir' ? pet.status !== 'critical' : pet.status !== 'alive');
    var buttons = '<button type="button" data-action="use-item" data-item="' + item.id + '"' + (useDisabled ? ' disabled' : '') + '>' + useLabel + '</button>' +
      '<button type="button" data-action="sell" data-item="' + item.id + '">Vender</button>';
    if (equipped) {
      buttons = item.type === 'decor'
        ? '<button type="button" data-action="remove-decor">Remover</button>'
        : '<button type="button" data-action="unequip">Desequipar</button>';
    }
    return '<div class="item-card' + (equipped ? ' equipped' : '') + '">' +
      '<span class="item-qty">' + owned + '</span>' +
      '<span class="item-emoji">' + item.emoji + '</span>' +
      '<span class="item-tag">' + tag + (equipped ? ' • equipado' : '') + '</span>' +
      '<span class="item-name">' + esc(item.name) + '</span>' +
      '<span class="item-desc">' + esc(item.desc) + (effects.length ? '<br><b>' + effects.join(' · ') + '</b>' : '') + '</span>' +
      '<div class="item-actions">' + buttons + '</div>' +
    '</div>';
  }

  function inventoryMarkup(state, pet, filter) {
    filter = filter || 'all';
    var filters = [
      { id: 'all', label: 'Tudo' },
      { id: 'food', label: '🍗 Comida' },
      { id: 'care', label: '🧴 Cuidado' },
      { id: 'toy', label: '🎲 Brinquedos' },
      { id: 'accessory', label: '🎩 Acessórios' },
      { id: 'decor', label: '🛋️ Decoração' }
    ];
    var chips = '<div class="filter-chips" role="group" aria-label="Filtrar inventário">' + filters.map(function (entry) {
      var active = entry.id === filter;
      return '<button class="filter-chip' + (active ? ' active' : '') + '" type="button" data-action="open-inventory" data-filter="' + entry.id + '" aria-pressed="' + active + '">' + entry.label + '</button>';
    }).join('') + '</div>';
    var items = DATA.ITEMS.filter(function (item) { return filter === 'all' || item.type === filter; });
    var owned = items.filter(function (item) {
      return (state.inventory[item.id] || 0) > 0 || (item.type === 'decor' && state.activeDecor === item.decor);
    });
    if (!owned.length) {
      return chips + '<div class="empty-state"><span class="empty-emoji">🎒</span>Nenhum item dessa categoria. Visite a loja para comprar!</div>';
    }
    return chips + '<div class="item-grid">' + owned.map(function (item) { return itemCard(item, state, pet, 'inventory'); }).join('') + '</div>';
  }

  function shopMarkup(state, pet) {
    var today = new Date().toISOString().slice(0, 10);
    var deals = DATA.dealsForDay().map(function (deal) {
      var item = DATA.item(deal.itemId);
      var bought = state.deals && state.deals.date === today ? (state.deals.bought[deal.itemId] || 0) : 0;
      var left = Math.max(0, deal.stock - bought);
      return '<div class="deal-card"><span class="deal-badge">-' + deal.discount + '%</span>' +
        '<span class="deal-emoji">' + item.emoji + '</span><b>' + esc(item.name) + '</b>' +
        '<small>🪙 ' + deal.price + ' • restam ' + left + '</small>' +
        '<button class="mini-btn" type="button" data-action="buy-deal" data-item="' + deal.itemId + '"' + (left ? '' : ' disabled') + '>Comprar</button></div>';
    }).join('');
    return '<div class="deals-row">' + deals + '</div>' +
      '<div class="shop-toolbar" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
      '<span class="muted">Comprar quantidade:</span>' +
      '<select id="shopQty" aria-label="Quantidade" style="border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-2);color:var(--text);padding:5px 8px">' +
        '<option value="1">1</option><option value="5">5</option><option value="10">10</option>' +
      '</select>' +
      '<span class="muted">Saldo: <b style="color:var(--yellow)">🪙 ' + state.coins + '</b></span>' +
      '</div>' +
      '<div class="item-grid">' + DATA.ITEMS.map(function (item) { return itemCard(item, state, pet, 'shop'); }).join('') + '</div>';
  }

  function achievementsMarkup(state) {
    var unlocked = Object.keys(state.achievements).length;
    return '<p class="muted" style="margin-bottom:12px">' + unlocked + ' de ' + DATA.ACHIEVEMENTS.length + ' desbloqueadas • cada conquista dá +50 🪙</p>' +
      '<div class="achievement-grid">' + DATA.ACHIEVEMENTS.map(function (achievement) {
        var done = !!state.achievements[achievement.id];
        return '<div class="achievement' + (done ? ' unlocked' : '') + '" title="' + esc(achievement.desc) + '">' +
          '<span class="ach-emoji">' + achievement.emoji + '</span>' +
          '<span><b>' + esc(achievement.name) + '</b><small>' + esc(achievement.desc) + '</small></span>' +
        '</div>';
      }).join('') + '</div>';
  }

  function diaryMarkup(state) {
    if (!state.log.length) return '<div class="empty-state"><span class="empty-emoji">📖</span>Seu diário está vazio.</div>';
    return '<div class="log-list">' + state.log.map(function (entry) {
      return '<div class="log-row ' + esc(entry.type) + '"><time>' + fmtTime(entry.t) + '</time><span>' + esc(entry.text) + '</span></div>';
    }).join('') + '</div>';
  }

  function chartMarkup(state, pet) {
    var summary = E.statsSummary(state);
    var labels = { hunger: '🍗 Fome', happiness: '😊 Feliz', energy: '⚡ Energia', hygiene: '🛁 Higiene', health: '💚 Saúde' };
    var cards = Object.keys(labels).map(function (key) {
      var rec = summary.records[key];
      return '<div class="record-card"><span>' + labels[key] + '</span><b>↑' + rec.max + ' • ↓' + rec.min + '</b><small>média ' + rec.avg + '</small></div>';
    }).join('');
    return '<div class="stats-records">' + cards +
      '<div class="record-card"><span>🔥 Melhor sequência</span><b>' + summary.bestStreak + ' dia(s)</b><small>recorde</small></div>' +
      '<div class="record-card"><span>🎮 Records</span><b>' + summary.totals.games + ' jogos</b><small>' + summary.totals.feeds + ' refeições</small></div>' +
      '<div class="record-card"><span>🧭 Aventuras</span><b>' + summary.totals.walks + ' passeios</b><small>' + summary.totals.wins + '/' + summary.totals.battles + ' vitórias</small></div>' +
      '</div>' +
      '<div class="data-actions"><button class="ghost-btn" type="button" data-action="export-csv">📊 Exportar CSV</button></div>' +
      '<div class="chart-wrap"><canvas id="historyChart"></canvas></div>' +
      '<div class="chart-legend">' +
        '<span><i style="background:#ffb46b"></i>Fome</span>' +
        '<span><i style="background:#ff7bb8"></i>Feliz</span>' +
        '<span><i style="background:#ffd76b"></i>Energia</span>' +
        '<span><i style="background:#6cc6ff"></i>Higiene</span>' +
        '<span><i style="background:#ff7286"></i>Saúde</span>' +
      '</div>' +
      '<p class="muted" style="margin-top:8px">Registros automáticos a cada 4 minutos. Histórico de ' + ((state.history[pet.id] || []).length) + ' pontos.</p>';
  }

  function fmtTimer(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function focusMarkup(state) {
    var focus = state.focus || { running: false, mode: 'focus', minutes: 25, task: '', endsAt: 0, remaining: 1500000 };
    var remaining = focus.running ? Math.max(0, focus.endsAt - Date.now()) : focus.remaining;
    var total = focus.minutes * 60000;
    var progress = Math.min(100, Math.max(0, (1 - remaining / total) * 100));
    var label = focus.mode === 'break' ? 'Pausa' : 'Foco';
    var today = new Date();
    var key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var todayMinutes = (state.focusLog && state.focusLog[key]) || 0;
    return '<div class="card-header"><div><h2>🧠 Modo foco</h2><p class="muted">Hoje: ' + todayMinutes + ' min focados</p></div>' +
      '<span class="focus-mode">' + label + '</span></div>' +
      '<input class="focus-task" id="focusTask" type="text" maxlength="60" placeholder="O que você vai focar?" value="' + esc(focus.task || '') + '" aria-label="Tarefa do foco"' + (focus.running ? ' disabled' : '') + '>' +
      '<div class="focus-time" id="focusTime">' + fmtTimer(remaining) + '</div>' +
      '<div class="bar focus-bar"><i id="focusBar" style="width:' + progress + '%"></i></div>' +
      '<div class="focus-actions">' +
        '<button class="mini-btn" type="button" data-action="focus-start" data-mode="focus" data-minutes="25">25 min</button>' +
        '<button class="mini-btn" type="button" data-action="focus-start" data-mode="focus" data-minutes="15">15 min</button>' +
        '<button class="mini-btn" type="button" data-action="focus-start" data-mode="break" data-minutes="5">Pausa 5</button>' +
        (focus.running
          ? '<button class="mini-btn" type="button" data-action="focus-stop">⏸️ Pausar</button>'
          : '<button class="mini-btn" type="button" data-action="focus-reset">🔄 Zerar</button>') +
      '</div>';
  }

  function renderFocus(state) {
    var mount = $('#focusCard');
    if (!mount) return;
    var existing = $('#focusTask');
    if (existing && state.focus && !state.focus.running) state.focus.task = existing.value.slice(0, 60);
    mount.innerHTML = focusMarkup(state);
  }

  function updateFocus(state) {
    var focus = state.focus;
    if (!focus) return;
    var remaining = focus.running ? Math.max(0, focus.endsAt - Date.now()) : focus.remaining;
    var node = $('#focusTime');
    var bar = $('#focusBar');
    if (node) node.textContent = fmtTimer(remaining);
    if (bar) bar.style.width = Math.min(100, Math.max(0, (1 - remaining / (focus.minutes * 60000)) * 100)) + '%';
  }

  function craftMarkup(state) {
    return '<p class="muted">Combine itens do inventário para criar algo novo. Você ganha XP por receita.</p>' +
      '<div class="recipe-list">' + DATA.RECIPES.map(function (recipe) {
        var ingredients = Object.keys(recipe.ingredients).map(function (id) {
          var owned = state.inventory[id] || 0;
          var need = recipe.ingredients[id];
          return '<span class="ingredient' + (owned >= need ? '' : ' missing') + '">' +
            esc(DATA.item(id).emoji) + ' ' + esc(DATA.item(id).name) + ' <b>' + owned + '/' + need + '</b></span>';
        }).join('');
        var canCraft = Object.keys(recipe.ingredients).every(function (id) {
          return (state.inventory[id] || 0) >= recipe.ingredients[id];
        });
        return '<div class="recipe-card"><div class="recipe-head"><span class="recipe-emoji">' + esc(recipe.emoji) + '</span>' +
          '<div><b>' + esc(recipe.name) + '</b><small>' + esc(recipe.desc) + '</small></div></div>' +
          '<div class="ingredients">' + ingredients + '</div>' +
          '<button class="mini-btn" type="button" data-action="craft" data-recipe="' + recipe.id + '"' + (canCraft ? '' : ' disabled') + '>🛠️ Criar</button>' +
        '</div>';
      }).join('') + '</div>';
  }

  function kitchenMarkup(state) {
    var buffs = E.activeBuffs(state);
    var buffLine = buffs.length
      ? buffs.map(function (buff) { return '<span class="buff-chip">' + esc(buff.emoji) + ' ' + esc(buff.name) + ' ' + buff.remaining + 'min</span>'; }).join('')
      : '<span class="buff-chip empty">Sem buffs ativos</span>';
    return '<p class="muted">Cozinhe com a horta e a loja. Use o prato para ativar o bônus por tempo limitado.</p>' +
      '<div class="buff-row">' + buffLine + '</div>' +
      '<div class="recipe-list">' + DATA.DISHES.map(function (dish) {
        var buff = DATA.BUFFS[dish.result] || DATA.BUFFS[dish.id];
        var ingredients = Object.keys(dish.ingredients).map(function (id) {
          var owned = state.inventory[id] || 0;
          var need = dish.ingredients[id];
          return '<span class="ingredient' + (owned >= need ? '' : ' missing') + '">' +
            esc(DATA.item(id).emoji) + ' ' + esc(DATA.item(id).name) + ' <b>' + owned + '/' + need + '</b></span>';
        }).join('');
        var canCook = Object.keys(dish.ingredients).every(function (id) {
          return (state.inventory[id] || 0) >= dish.ingredients[id];
        });
        return '<div class="recipe-card"><div class="recipe-head"><span class="recipe-emoji">' + esc(dish.emoji) + '</span>' +
          '<div><b>' + esc(dish.name) + '</b><small>' + esc(buff ? buff.desc : dish.desc) + '</small></div></div>' +
          '<div class="ingredients">' + ingredients + '</div>' +
          '<button class="mini-btn" type="button" data-action="cook" data-dish="' + dish.id + '"' + (canCook ? '' : ' disabled') + '>🍳 Cozinhar ' + dish.amount + 'x</button>' +
        '</div>';
      }).join('') + '</div>';
  }

  function tradeMarkup(state) {
    var duplicates = E.duplicateStickers(state);
    return '<div class="album-header"><b>🔄 Mercado de trocas</b>' +
      '<span>✨ ' + state.stickerDust + ' pó • 🃏 ' + duplicates + ' duplicatas</span></div>' +
      '<p class="muted">Use pó de figurinha e figurinhas repetidas para pegar itens úteis. Suas figurinhas únicas ficam no álbum.</p>' +
      '<div class="recipe-list">' + DATA.TRADES.map(function (offer) {
        var item = DATA.item(offer.result);
        var canTrade = state.stickerDust >= offer.dust && duplicates >= offer.duplicates;
        return '<div class="recipe-card"><div class="recipe-head"><span class="recipe-emoji">' + esc(offer.emoji) + '</span>' +
          '<div><b>' + esc(offer.name) + '</b><small>' + esc(offer.desc) + '</small></div></div>' +
          '<div class="ingredients"><span class="ingredient">✨ ' + offer.dust + ' pó</span>' +
          '<span class="ingredient">🃏 ' + offer.duplicates + ' duplicatas</span>' +
          '<span class="ingredient">' + item.emoji + ' ' + offer.amount + 'x ' + esc(item.name) + '</span></div>' +
          '<button class="mini-btn" type="button" data-action="trade-item" data-trade="' + offer.id + '"' + (canTrade ? '' : ' disabled') + '>🔁 Trocar</button>' +
        '</div>';
      }).join('') + '</div>';
  }

  function stickerMarkup(state) {
    var owned = Object.keys(state.stickers || {}).length;
    return '<div class="album-header"><b>' + owned + '/' + DATA.STICKERS.length + ' figurinhas</b>' +
      '<span>✨ ' + state.stickerDust + ' pó • 🃏 ' + E.duplicateStickers(state) + ' duplicatas</span>' +
      '<button class="mini-btn" type="button" data-action="exchange-sticker"' + (state.stickerDust < 3 ? ' disabled' : '') + '>🔁 Trocar (3)</button>' +
      '<button class="ghost-btn" type="button" data-tab="trades">🔄 Mercado</button></div>' +
      '<div class="sticker-grid">' + DATA.STICKERS.map(function (sticker) {
        var count = state.stickers[sticker.id] || 0;
        return '<div class="sticker' + (count ? ' owned' : '') + (sticker.rare ? ' rare' : '') + '" title="' + esc(sticker.name) + '">' +
          '<span class="sticker-art' + (count ? '' : ' locked') + '">' + sticker.stageEmoji +
            (count ? '<i class="sticker-species">' + sticker.emoji + '</i>' : '') +
          '</span>' +
          '<small>' + (count ? esc(sticker.stageName) : esc(sticker.stageName) + ' 🔒') + '</small>' +
          (count > 1 ? '<b>x' + count + '</b>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  function momentsMarkup(state) {
    var button = '<div class="data-actions"><button class="ghost-btn" type="button" data-action="add-moment">📸 Registrar momento</button>' +
      '<button class="ghost-btn" type="button" data-action="export-moments">⬇️ Exportar PNG</button></div>';
    if (!state.moments.length) {
      return button + '<div class="empty-state"><span class="empty-emoji">📸</span>Nenhum momento registrado ainda.</div>';
    }
    return button + '<div class="moment-grid">' + state.moments.map(function (moment, index) {
      return '<div class="moment-card"><canvas width="160" height="110" data-moment="' + index + '"></canvas>' +
        '<b>' + esc(moment.title) + '</b><small>' + esc(moment.name) + ' • ' + fmtTime(moment.t) + '</small>' +
        '<p>' + esc(moment.note) + '</p></div>';
    }).join('') + '</div>';
  }

  function adventureMarkup(state) {
    var pet = E.activePet(state);
    var adventure = state.adventure || { walks: 0, battles: 0, wins: 0, battle: null };
    var header = '<div class="adventure-header"><div><b>🧭 Aventura</b>' +
      '<small>Passeie para achar tesouros ou enfrente inimigos em batalhas por turnos.</small></div>' +
      '<span>🚶 ' + adventure.walks + ' • ⚔️ ' + adventure.battles + ' • 🏆 ' + adventure.wins + '</span></div>';

    if (adventure.battle) {
      var battle = adventure.battle;
      var enemy = DATA.enemy(battle.enemyId);
      if (!enemy) return header + '<div class="empty-state">Batalha inválida.</div>';
      var myPct = Math.max(0, Math.min(100, Math.round(battle.hp / battle.maxHp * 100)));
      var enemyPct = Math.max(0, Math.min(100, Math.round(battle.enemyHp / enemy.hp * 100)));
      return header +
        '<div class="battle-arena">' +
          '<div class="battle-row"><span class="battle-emoji">' + esc(DATA.species(pet.speciesId).emoji) + '</span>' +
            '<div class="battle-fighter"><b>' + esc(pet.name) + '</b>' +
              '<div class="hp-bar"><i style="width:' + myPct + '%"></i></div>' +
              '<small>' + battle.hp + '/' + battle.maxHp + ' HP • nível ' + pet.level + '</small></div></div>' +
          '<div class="battle-vs">⚔️ VS</div>' +
          '<div class="battle-row enemy"><span class="battle-emoji">' + esc(enemy.emoji) + '</span>' +
            '<div class="battle-fighter"><b>' + esc(enemy.name) + '</b>' +
              '<div class="hp-bar"><i style="width:' + enemyPct + '%"></i></div>' +
              '<small>' + battle.enemyHp + '/' + enemy.hp + ' HP • atk ' + enemy.atk + '</small></div></div>' +
          '<div class="battle-log">' + battle.log.map(function (line) {
            return '<div>' + esc(line) + '</div>';
          }).join('') + '</div>' +
          '<div class="battle-actions">' +
            '<button class="mini-btn primary" type="button" data-action="battle-move" data-move="attack">⚔️ Atacar <kbd>1</kbd></button>' +
            '<button class="mini-btn" type="button" data-action="battle-move" data-move="defend">🛡️ Defender <kbd>2</kbd></button>' +
            '<button class="mini-btn" type="button" data-action="battle-move" data-move="item"' +
              (['medicine', 'bandage', 'milk', 'apple'].some(function (id) { return (state.inventory[id] || 0) > 0; }) ? '' : ' disabled') +
              '>💊 Usar item <kbd>3</kbd></button>' +
            '<button class="mini-btn ghost" type="button" data-action="battle-move" data-move="flee">🏃 Fugir <kbd>4</kbd></button>' +
          '</div>' +
        '</div>';
    }

    var walks = DATA.WALKS.map(function (place) {
      var locked = pet.level < place.minLevel;
      var tired = pet.energy < place.cost;
      var hint = locked ? '🔒 Nível ' + place.minLevel : tired ? '😴 Precisa de ' + place.cost + ' ⚡' : place.hint;
      return '<div class="adventure-card"><div class="adventure-head"><span class="adventure-emoji">' + esc(place.emoji) + '</span>' +
        '<div><b>' + esc(place.name) + '</b><small>' + esc(place.desc) + '</small></div></div>' +
        '<span class="adventure-hint">' + esc(hint) + '</span>' +
        '<button class="mini-btn" type="button" data-action="go-walk" data-place="' + place.id + '"' +
          (locked || tired || pet.status !== 'alive' ? ' disabled' : '') + '>🚶 Passear</button></div>';
    }).join('');

    var enemies = DATA.ENEMIES.map(function (enemy) {
      var locked = pet.level < enemy.minLevel;
      var tired = pet.energy < 6;
      var hint = locked ? '🔒 Nível ' + enemy.minLevel : tired ? '😴 Precisa de 6 ⚡' : enemy.desc;
      return '<div class="adventure-card' + (enemy.boss ? ' boss' : '') + '"><div class="adventure-head"><span class="adventure-emoji">' + esc(enemy.emoji) + '</span>' +
        '<div><b>' + esc(enemy.name) + '</b><small>' + esc(hint) + '</small></div></div>' +
        '<span class="adventure-hint">' + enemy.hp + ' HP • 🪙 ' + enemy.coins + ' • ⭐ ' + enemy.xp + '</span>' +
        '<button class="mini-btn" type="button" data-action="start-battle" data-enemy="' + enemy.id + '"' +
          (locked || tired || pet.status !== 'alive' ? ' disabled' : '') + '>⚔️ Enfrentar</button></div>';
    }).join('');

    return header +
      '<div class="adventure-section"><h3>🚶 Passeios</h3><div class="adventure-grid">' + walks + '</div></div>' +
      '<div class="adventure-section"><h3>⚔️ Batalhas</h3><div class="adventure-grid">' + enemies + '</div></div>';
  }

  function drawMomentCanvas(canvas, moment) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var gradient = ctx.createLinearGradient(0, 0, 160, 110);
    gradient.addColorStop(0, '#3a2a68');
    gradient.addColorStop(1, '#17102b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 160, 110);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.arc(128, 24, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, 82, 160, 28);
    ctx.font = '42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(moment.mood || '✨', 80, 66);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#f4efff';
    ctx.fillText(moment.name.slice(0, 16), 80, 102);
    ctx.textAlign = 'left';
  }

  function fmtWait(ms) {
    var minutes = Math.max(1, Math.ceil(ms / 60000));
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return rest ? hours + 'h ' + rest + 'min' : hours + 'h';
  }

  function gardenMarkup(state) {
    var garden = E.ensureGarden(state);
    var time = Date.now();
    var plots = garden.plots.map(function (plot, index) {
      var status = E.cropStatus(plot, time);
      if (!status) {
        return '<div class="garden-plot empty"><div class="plot-head"><b>Vaga ' + (index + 1) + '</b><small>Livre</small></div>' +
          '<div class="seed-list">' + DATA.CROPS.map(function (crop) {
            return '<button class="mini-btn seed-btn" type="button" data-action="plant-crop" data-crop="' + crop.id + '" data-plot="' + index + '">' +
              crop.emoji + ' ' + crop.name + '<small>' + crop.cost + ' 🪙 · ' + crop.minutes + 'min</small></button>';
          }).join('') + '</div></div>';
      }
      var crop = status.crop;
      var pct = Math.round(status.progress * 100);
      var stage = status.ready ? 'ready' : status.progress < 0.34 ? 'seed' : 'sprout';
      var stageEmoji = stage === 'ready' ? crop.emoji : stage === 'seed' ? '🌰' : '🌱';
      return '<div class="garden-plot stage-' + stage + (status.ready ? ' ready' : '') + '">' +
        '<div class="plot-head"><b>' + crop.emoji + ' ' + crop.name + '</b><small>' + (status.ready ? 'Pronta!' : fmtWait(status.remaining)) + '</small></div>' +
        '<div class="plot-emoji">' + stageEmoji + '</div>' +
        '<div class="plot-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="plot-foot"><span class="plot-badge">' + (status.watered ? '💧 regada' : '🌱 crescendo') + '</span><small>' + pct + '%</small></div>' +
        '<div class="plot-actions">' +
          (!status.ready && !status.watered ? '<button class="mini-btn" type="button" data-action="water-crop" data-plot="' + index + '">💧 Regar</button>' : '') +
          (status.ready ? '<button class="mini-btn primary" type="button" data-action="harvest-crop" data-plot="' + index + '">🌾 Colher +' + crop.amount + '</button>' : '') +
        '</div></div>';
    }).join('');
    return '<div class="panel-head"><div><h3>🌱 Sua horta</h3><p class="muted">Plante, regue e colha itens com o tempo real. Regar reduz pela metade o tempo de crescimento; chuva rega automaticamente.</p></div>' +
      '<span class="pill">🌾 ' + garden.harvested + ' colheitas</span></div>' +
      '<div class="garden-grid">' + plots + '</div>';
  }

  function rankingMarkup(state) {
    var ranking = E.ensureRanking(state);
    var meta = {
      feed: { label: 'Alimentar', emoji: '🍗' }, game: { label: 'Minigames', emoji: '🎮' },
      bath: { label: 'Banhos', emoji: '🛁' }, sleep: { label: 'Sonhos', emoji: '😴' },
      train: { label: 'Treinos', emoji: '💪' }, pet: { label: 'Carinhos', emoji: '🤗' },
      walk: { label: 'Passeios', emoji: '🌳' }, battle: { label: 'Batalhas', emoji: '⚔️' },
      focus: { label: 'Foco (min)', emoji: '🧠' }, checkin: { label: 'Check-ins', emoji: '🎁' }
    };
    var rows = DATA.RANKING_KEYS.map(function (key) {
      return { key: key, label: meta[key].label, emoji: meta[key].emoji, score: ranking.scores[key] || 0, best: ranking.best[key] || 0 };
    }).sort(function (a, b) { return b.score - a.score; });
    var max = Math.max(1, rows[0].score);
    var total = rows.reduce(function (sum, row) { return sum + row.score; }, 0);
    var tier = total >= 500 ? 'Lenda 🏆' : total >= 250 ? 'Ouro 🥇' : total >= 100 ? 'Prata 🥈' : 'Bronze 🥉';
    var medals = ['🥇', '🥈', '🥉'];
    var podium = rows.slice(0, 3).map(function (row, index) {
      return '<div class="podium-card place-' + (index + 1) + '"><span class="podium-medal">' + medals[index] + '</span>' +
        '<b>' + row.emoji + ' ' + row.label + '</b><small>' + row.score + ' pts</small></div>';
    }).join('');
    return '<div class="panel-head"><div><h3>🏅 Ranking semanal</h3><p class="muted">Pontos ganhos nesta semana. Os recordes permanecem mesmo quando a semana reinicia.</p></div>' +
      '<span class="pill">' + tier + ' · ' + total + ' pts</span></div>' +
      '<div class="rank-podium">' + podium + '</div>' +
      '<ol class="rank-list">' + rows.map(function (row, index) {
        var pct = Math.round(row.score / max * 100);
        return '<li class="rank-row"><span class="rank-pos">' + (index + 1) + 'º</span><div class="rank-main"><div class="rank-title"><b>' + row.emoji + ' ' + row.label + '</b><span>' + row.score + ' pts' + (row.score >= row.best && row.score > 0 ? ' · recorde' : '') + '</span></div>' +
          '<div class="rank-bar"><i style="width:' + pct + '%"></i></div></div><small>Recorde: ' + row.best + '</small></li>';
      }).join('') + '</ol>';
  }

  function renderTab(state, tab, filter) {
    var pet = E.activePet(state);
    if (!pet) return;
    if (tab) activeTab = tab;
    $$('.tab').forEach(function (button) {
      var active = button.dataset.tab === activeTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    var panel = $('#tabPanel');
    if (!panel) return;
    panel.setAttribute('aria-labelledby', 'tab-' + activeTab);
    if (activeTab === 'inventory') panel.innerHTML = inventoryMarkup(state, pet, filter || 'all');
    else if (activeTab === 'shop') panel.innerHTML = shopMarkup(state, pet);
    else if (activeTab === 'craft') panel.innerHTML = craftMarkup(state);
    else if (activeTab === 'kitchen') panel.innerHTML = kitchenMarkup(state);
    else if (activeTab === 'trades') panel.innerHTML = tradeMarkup(state);
    else if (activeTab === 'stickers') panel.innerHTML = stickerMarkup(state);
    else if (activeTab === 'adventure') panel.innerHTML = adventureMarkup(state);
    else if (activeTab === 'garden') panel.innerHTML = gardenMarkup(state);
    else if (activeTab === 'ranking') panel.innerHTML = rankingMarkup(state);
    else if (activeTab === 'moments') {
      panel.innerHTML = momentsMarkup(state);
      $$('canvas[data-moment]', panel).forEach(function (canvas) {
        drawMomentCanvas(canvas, state.moments[Number(canvas.dataset.moment)]);
      });
    }
    else if (activeTab === 'achievements') panel.innerHTML = achievementsMarkup(state);
    else if (activeTab === 'diary') panel.innerHTML = diaryMarkup(state);
    else if (activeTab === 'chart') {
      panel.innerHTML = chartMarkup(state, pet);
      drawChart((state.history[pet.id] || []).slice(-40));
    }
  }

  function drawChart(history) {
    var canvas = document.getElementById('historyChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var rect = canvas.parentNode.getBoundingClientRect();
    var dpr = global.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);
    var w = rect.width, h = rect.height;
    var pad = 18;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(180,150,255,.14)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i += 1) {
      var y = pad + (h - pad * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#999';
    ctx.font = '10px sans-serif';
    ctx.fillText('100', 2, pad + 3);
    ctx.fillText('0', 6, h - pad + 3);

    if (history.length < 2) {
      ctx.fillStyle = ctx.fillStyle || '#999';
      ctx.textAlign = 'center';
      ctx.fillText('Volte em alguns minutos para ver o histórico ✨', w / 2, h / 2);
      ctx.textAlign = 'left';
      return;
    }

    var series = [
      { key: 'hunger', color: '#ffb46b' },
      { key: 'happiness', color: '#ff7bb8' },
      { key: 'energy', color: '#ffd76b' },
      { key: 'hygiene', color: '#6cc6ff' },
      { key: 'health', color: '#ff7286' }
    ];
    series.forEach(function (line) {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      history.forEach(function (point, index) {
        var x = pad + (w - pad * 2) * (index / (history.length - 1));
        var y = pad + (h - pad * 2) * (1 - point[line.key] / 100);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  function renderDaily(state) {
    var mount = $('#dailyCard');
    if (!mount) return;
    E.ensureDaily(state);
    var event = DATA.eventForDay(new Date());
    var quests = state.daily.quests;
    var done = quests.filter(function (quest) { return quest.claimed; }).length;
    var streak = state.streak ? state.streak.count : 0;
    var forecast = ['Amanhã', 'Depois', '3º dia'].map(function (label, index) {
      var date = new Date();
      date.setDate(date.getDate() + index + 1);
      var upcoming = DATA.eventForDay(date);
      return '<div class="forecast-day"><small>' + label + '</small><span>' + upcoming.emoji + '</span><b>' + esc(upcoming.name) + '</b></div>';
    }).join('');
    var checkinItem = state.daily.checkin ? DATA.item(state.daily.checkin.itemId) : null;
    var checkin = checkinItem
      ? '<div class="checkin-done"><span>🎁 Check-in de hoje</span><b>' + checkinItem.emoji + ' ' + esc(checkinItem.name) + '</b><small>Voltou amanhã para outro item.</small></div>'
      : '<button class="checkin-btn" type="button" data-action="daily-checkin"><span>🎁 Check-in diário</span><small>Ganhe 1 item surpresa</small></button>';
    mount.innerHTML = '<div class="card-header"><div><h2>📅 Desafios de hoje</h2><p class="muted">' + done + '/' + quests.length + ' concluídos • 🔥 ' + streak + ' dia(s) seguido(s)</p></div><span class="streak-badge" title="Sequência de dias">🔥 ' + streak + '</span></div>' +
      checkin +
      '<div class="daily-event"><span>' + event.emoji + '</span><div><b>' + esc(event.name) + '</b><small>' + esc(event.desc) + '</small></div></div>' +
      '<div class="forecast"><span class="forecast-title">🔭 Próximos dias</span><div class="forecast-days">' + forecast + '</div></div>' +
      quests.map(function (quest) {
        var progress = pct(quest.progress / quest.target * 100);
        return '<div class="daily-quest' + (quest.claimed ? ' done' : '') + '">' +
          '<div class="goal-title"><span>' + quest.emoji + ' ' + esc(quest.name) + (quest.weather ? '<em class="quest-tag">clima</em>' : '') + '</span><b>' + (quest.claimed ? '✅ +' + quest.reward : quest.progress + '/' + quest.target) + '</b></div>' +
          '<div class="bar"><i style="width:' + progress + '%;--bar-color:' + (quest.claimed ? 'var(--green)' : 'var(--yellow)') + '"></i></div>' +
        '</div>';
      }).join('');
  }

  function renderWeekly(state) {
    var host = $('#weeklyCard');
    if (!host) return;
    var weekly = state.weekly && state.weekly.quests ? state.weekly : { week: DATA.weekKey(new Date()), quests: DATA.questsForWeek(new Date()) };
    var calendar = state.careCalendar || {};
    var weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    var days = [];
    for (var offset = 6; offset >= 0; offset -= 1) {
      var date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      var key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      var entry = calendar[key] || {};
      var total = ['feed', 'bath', 'sleep', 'game', 'train', 'pet'].reduce(function (sum, action) { return sum + (entry[action] || 0); }, 0);
      var level = total === 0 ? '' : total < 5 ? ' low' : total < 12 ? ' mid' : ' high';
      days.push('<div class="care-day' + level + '" title="' + key + ': ' + total + ' cuidado(s)"><b>' + weekDays[date.getDay()] + '</b><small>' + date.getDate() + '</small></div>');
    }
    host.innerHTML = '<div class="card-head"><span><b>🗓️ Missões da semana</b><small> Renovam toda segunda-feira</small></span><span class="badge">🧭 ' + esc(weekly.week) + '</span></div>' +
      '<div class="weekly-list">' + weekly.quests.map(function (quest) {
        var progress = pct(quest.progress / quest.target * 100);
        return '<div class="daily-quest' + (quest.claimed ? ' done' : '') + '">' +
          '<div class="quest-line"><span>' + quest.emoji + ' ' + esc(quest.name) + '</span><b>' + (quest.claimed ? '✅' : Math.floor(quest.progress) + '/' + quest.target) + '</b></div>' +
          '<div class="bar"><i style="width:' + progress + '%;--bar-color:' + (quest.claimed ? 'var(--green)' : 'var(--primary)') + '"></i></div>' +
          '<small>+' + quest.reward + ' 🪙</small></div>';
      }).join('') + '</div>' +
      '<div class="calendar-head">📅 Últimos 7 dias de cuidado</div>' +
      '<div class="care-calendar">' + days.join('') + '</div>';
  }

  function renderRight(state) {
    var pet = E.activePet(state);
    if (!pet) return;
    renderDaily(state);
    renderWeekly(state);
    renderFocus(state);

    $('#gamesList').innerHTML = DATA.GAMES.map(function (game) {
      return '<button class="game-row" type="button" data-action="play-game" data-game="' + game.id + '"' + (pet.status !== 'alive' ? ' disabled' : '') + '>' +
        '<span class="game-emoji">' + game.emoji + '</span>' +
        '<span><b>' + esc(game.name) + '</b><small>' + esc(game.desc) + '</small></span>' +
        '<span class="play-arrow">▶</span>' +
      '</button>';
    }).join('');

    var next = pet.stageIndex < DATA.STAGES.length - 1 ? DATA.stage(pet.stageIndex + 1) : null;
    var goals = [];
    if (next) {
      goals.push({ title: 'Evoluir para ' + next.name + ' • cuidados', now: pet.care, max: next.care, color: 'var(--green)', text: Math.floor(pet.care) + '/' + next.care });
      goals.push({ title: 'Evoluir • idade', now: Math.min(pet.age, next.min), max: next.min, color: 'var(--primary)', text: fmtAge(pet.age) + '/' + fmtAge(next.min) });
    } else {
      goals.push({ title: 'Última fase alcançada!', now: 1, max: 1, color: 'var(--yellow)', text: '100%' });
    }
    goals.push({ title: 'Próximo nível', now: pet.xp - 20 * (pet.level - 1) * (pet.level - 1), max: Math.max(1, E.xpToNext(pet.level) - 20 * (pet.level - 1) * (pet.level - 1)), color: 'var(--pink)', text: 'Nv. ' + pet.level });
    goals.push({ title: 'Conquistas', now: Object.keys(state.achievements).length, max: DATA.ACHIEVEMENTS.length, color: 'var(--yellow)', text: Object.keys(state.achievements).length + '/' + DATA.ACHIEVEMENTS.length });
    $('#goalsList').innerHTML = goals.map(function (goal) {
      var value = pct(goal.now / goal.max * 100);
      return '<div class="goal-row"><div class="goal-title"><span>' + esc(goal.title) + '</span><b>' + esc(goal.text) + '</b></div>' +
        '<div class="bar"><i style="width:' + value + '%;--bar-color:' + goal.color + '"></i></div></div>';
    }).join('');

    $('#collectionCount').textContent = state.totals.adopted.length + '/' + DATA.SPECIES.length;
    $('#collectionGrid').innerHTML = DATA.SPECIES.map(function (species) {
      var owned = state.totals.adopted.indexOf(species.id) !== -1;
      return '<div class="collection-item' + (owned ? ' owned' : '') + '" title="' + esc(species.name) + '">' + species.emoji + '</div>';
    }).join('');

    var lowest = STATS.slice(0, 5).map(function (stat) { return { label: stat.label, value: pet[stat.key], tip: TIPS.find(function (tip) { return tip[0].indexOf(stat.label.slice(0, 4)) !== -1; }) }; })
      .sort(function (a, b) { return a.value - b.value; })[0];
    var pendingQuests = (state.daily.quests || []).filter(function (quest) { return !quest.claimed; }).length;
    var tip;
    if (pet.illness) tip = ['Está doente!', 'Use uma bandagem ou mantenha fome e higiene altas para curar mais rápido.'];
    else if (pet.status === 'critical') tip = ['Estado crítico!', 'Use um Elixir da vida na loja para reanimar seu bichinho.'];
    else if (pendingQuests) tip = ['Missões pendentes', 'Você tem ' + pendingQuests + ' desafio(s) de hoje para concluir.'];
    else if (state.streak && state.streak.count % 3 === 0) tip = ['Sequência forte!', 'Volte amanhã para manter o ritmo e ganhar mais moedas.'];
    else tip = lowest && lowest.value < 45 ? lowest.tip : TIPS[Math.floor(Date.now() / 60000) % TIPS.length];
    if (!tip) tip = TIPS[0];
    $('#tipCard').innerHTML = '<b>💡 ' + esc(tip[0]) + '</b>' + esc(tip[1]) +
      '<button class="ghost-btn tip-tutorial" type="button" data-action="open-tutorial">❓ Rever tutorial</button>';
  }

  function renderTopbar(state) {
    $('#coinCount').textContent = state.coins;
    $('#speedPill').textContent = '⏩ x' + state.settings.speed + ' (' + (DATA.SPEED_LABELS[state.settings.speed] || '') + ')';
    $('#soundBtn').textContent = state.settings.sound ? '🔊' : '🔇';
    var battery = E.activePet(state) ? Math.round(E.activePet(state).energy / 25) : 4;
    $('#batteryIcon').textContent = battery > 3 ? '🔋' : battery > 1 ? '🪫' : '⚠️';
    var hour = new Date();
    $('#deviceClock').textContent = String(hour.getHours()).padStart(2, '0') + ':' + String(hour.getMinutes()).padStart(2, '0');
  }

  function render(state, options) {
    if (!state || !state.pets.length) return;
    options = options || {};
    applyTheme(state);
    renderTopbar(state);
    renderPicker(state);
    renderPet(state);
    renderStats(state);
    renderActions(state);
    renderAlerts(state);
    renderTab(state, options.tab, options.filter);
    renderRight(state);
  }

  function updateLive(state) {
    var pet = E.activePet(state);
    if (!pet) return;
    STATS.forEach(function (stat) {
      var row = document.querySelector('[data-stat="' + stat.key + '"]');
      if (!row) return;
      var value = pct(pet[stat.key]);
      var bar = row.querySelector('.bar i');
      var label = row.querySelector('.stat-value');
      if (bar) bar.style.width = value + '%';
      if (label) label.textContent = value;
    });
    var mood = E.moodOf(pet);
    var personality = DATA.personality(pet.personalityId);
    $('#moodLine').textContent = 'Humor: ' + mood.label + ' • ' + E.displayName(pet) + ' • ' + personality.emoji + ' ' + personality.name + buffText(state);
    $('#levelBadge').textContent = 'Nv. ' + pet.level;
    $('#ageValue').textContent = fmtAge(pet.age);
    $('#weightValue').textContent = Math.round(pet.weight) + ' g';
    $('#affectionValue').textContent = pet.affection;
    $('#disciplineValue').textContent = Math.round(pet.discipline);
    var current = pet.xp - 20 * (pet.level - 1) * (pet.level - 1);
    var need = Math.max(1, E.xpToNext(pet.level) - 20 * (pet.level - 1) * (pet.level - 1));
    $('#xpLabel').textContent = Math.max(0, Math.round(current)) + ' / ' + Math.round(need) + ' XP';
    $('#xpBar').style.width = pct(current / need * 100) + '%';
    $('#coinCount').textContent = state.coins;
    $('#petSubtitle').textContent = E.stageOf(pet).name + ' • ' + E.speciesOf(pet).name + ' • ' + fmtAge(pet.age) +
      (isBirthdayToday(pet) ? ' 🎂 Aniversário!' : '');
    $('#petStatusPill').textContent = pet.status === 'critical' ? '🚨 Crítico' :
      pet.status === 'gone' ? '🕊️ Partiu' : pet.sleeping ? '😴 Dormindo' :
        pet.illness ? '🤒 ' + pet.illness.type : pet.health < 40 ? '🤒 Doente' : mood.emoji + ' ' + mood.label;
    var speech = $('#speech');
    if (speech && speech.textContent !== pet.message) speech.textContent = pet.message;
    var sprite = document.getElementById('petSprite');
    if (sprite) {
      var stage = E.stageOf(pet);
      var nextMood = stage.id === 'egg' ? 'egg' : (pet.status === 'critical' || pet.illness || pet.health < 40 ? 'sick' : pet.sleeping ? 'sleep' : mood.id);
      if (sprite.dataset.mood !== nextMood) sprite.dataset.mood = nextMood;
      var illnessFlag = pet.illness ? '1' : '0';
      if (sprite.dataset.illness !== illnessFlag) sprite.dataset.illness = illnessFlag;
      if (sprite.dataset.stage !== stage.id) renderPet(state);
    }
    $('#screen').classList.toggle('is-sleeping', !!pet.sleeping);
    $('#screen').classList.toggle('is-critical', pet.status === 'critical');
    renderTopbar(state);
    updateFocus(state);
  }

  function playFx(emoji, count) {
    var layer = document.getElementById('fxLayer');
    if (!layer) return;
    var total = count || 1;
    for (var i = 0; i < total; i += 1) {
      var node = document.createElement('span');
      node.className = 'fx-item';
      node.textContent = emoji;
      node.style.left = (25 + Math.random() * 50) + '%';
      node.style.top = (35 + Math.random() * 25) + '%';
      node.style.animationDelay = (i * 90) + 'ms';
      layer.appendChild(node);
      (function (element) { setTimeout(function () { element.remove(); }, 1600 + i * 90); })(node);
    }
  }

  function setActionFx(kind) {
    var sprite = document.getElementById('petSprite');
    if (!sprite) return;
    sprite.dataset.action = kind;
    setTimeout(function () { if (sprite.parentNode) delete sprite.dataset.action; }, kind === 'eat' ? 1500 : 1300);
  }

  function toast(message, type) {
    if (!toastRoot) return;
    var node = document.createElement('div');
    node.className = 'toast ' + (type || '');
    node.textContent = message;
    toastRoot.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { node.remove(); }, 320);
    }, 3000);
  }

  var SOUND_CUES = {
    click: ['👆', 'Toque'], eat: ['🍽️', 'Comendo'], happy: ['😄', 'Feliz'],
    sad: ['😢', 'Triste'], coin: ['🪙', 'Moedas'], level: ['⭐', 'Nível!'],
    evolve: ['✨', 'Evolução'], sleep: ['😴', 'Dormindo'], game: ['🎮', 'Jogando'],
    error: ['⚠️', 'Atenção'], alert: ['🔔', 'Alerta']
  };

  function showSoundCue(name) {
    if (!soundCueRoot || document.body.dataset.cues === 'off') return;
    var time = Date.now();
    if (name === lastCueName && time - lastCueAt < 220) return;
    lastCueAt = time;
    lastCueName = name;
    var cue = SOUND_CUES[name] || SOUND_CUES.click;
    var node = document.createElement('div');
    node.className = 'sound-cue';
    node.innerHTML = '<span>' + cue[0] + '</span><b>' + esc(cue[1]) + '</b>';
    soundCueRoot.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { node.remove(); }, 300);
    }, 850);
  }

  function openModal(config) {
    if (!modalRoot) return;
    if (modalRoot._trap) document.removeEventListener('keydown', modalRoot._trap);
    modalRoot._restoreFocus = document.activeElement;
    config = config || {};
    modalRoot.innerHTML = '<div class="overlay"><div class="modal" role="dialog" aria-modal="true">' +
      '<h2>' + (config.title || '') + '</h2>' +
      (config.sub ? '<p class="modal-sub">' + config.sub + '</p>' : '') +
      '<div class="modal-body">' + (config.body || '') + '</div>' +
      '<div class="modal-actions">' + (config.actions || []).map(function (action, index) {
        return '<button class="btn ' + (action.cls || '') + '" data-modal-action="' + index + '" type="' + (action.type || 'button') + '">' + action.label + '</button>';
      }).join('') + '</div>' +
      '</div></div>';
    var overlay = $('.overlay', modalRoot);
    var modal = $('.modal', modalRoot);
    $$('[data-modal-action]', modalRoot).forEach(function (button) {
      button.addEventListener('click', function () {
        var action = config.actions[Number(button.dataset.modalAction)];
        if (!action) return;
        var keep = action.onClick && action.onClick(modal);
        if (!keep && action.close !== false) closeModal();
      });
    });
    if (!config.locked) {
      overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
    }
    if (config.onMount) config.onMount(modal);
    modalRoot._trap = function (event) {
      if (event.key !== 'Tab') return;
      var focusables = $$('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', modal);
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', modalRoot._trap);
    var firstInput = $('input, textarea, select', modal);
    var initialFocus = (!config.noAutofocus && firstInput) ? firstInput : $('.btn.primary', modal) || $('.btn', modal);
    if (initialFocus) setTimeout(function () { initialFocus.focus(); }, 60);
  }

  function closeModal() {
    if (!modalRoot) return;
    if (modalRoot._trap) {
      document.removeEventListener('keydown', modalRoot._trap);
      modalRoot._trap = null;
    }
    modalRoot.innerHTML = '';
    var restore = modalRoot._restoreFocus;
    if (restore && document.contains(restore) && restore.focus) restore.focus();
    modalRoot._restoreFocus = null;
  }

  function showAdoption(state, onAdopt) {
    if (state.pets.length >= E.MAX_PETS) {
      openModal({ title: 'Limite de bichinhos', sub: 'Você já tem 4 bichinhos. Escolha um na lista para trocar.', actions: [{ label: 'Fechar', cls: 'primary' }] });
      return;
    }
    selectedSpecies = DATA.SPECIES[0].id;
    openModal({
      title: '🥚 Adote um novo bichinho',
      sub: 'Escolha a espécie e dê um nome. Cada espécie tem características próprias!',
      body: '<div class="species-grid">' + DATA.SPECIES.map(function (species) {
        return '<button class="species-card' + (species.id === selectedSpecies ? ' selected' : '') + '" type="button" data-species="' + species.id + '">' +
          '<span class="species-head"><span class="species-emoji">' + species.emoji + '</span><b>' + esc(species.name) + '</b></span>' +
          '<small>' + esc(species.description) + '</small>' +
          '<span class="rate-line">Fome ' + species.rate.hunger + ' • Feliz ' + species.rate.happiness + ' • Sono ' + species.rate.energy + '</span>' +
        '</button>';
      }).join('') + '</div>' +
      '<div class="field"><label for="petNameInput">Nome do bichinho</label><input id="petNameInput" maxlength="18" placeholder="Ex.: Pipoca" autocomplete="off"></div>',
      actions: [
        { label: 'Cancelar', cls: 'ghost', onClick: function () { if (!state.pets.length) location.reload(); } },
        { label: 'Adotar ovo 🐣', cls: 'primary', onClick: function (modal) {
          var name = $('#petNameInput', modal).value;
          if (onAdopt) onAdopt(selectedSpecies, name);
          return false;
        } }
      ],
      locked: state.pets.length === 0,
      noAutofocus: state.pets.length === 0,
      onMount: function (modal) {
        $$('.species-card', modal).forEach(function (button) {
          button.addEventListener('click', function () {
            selectedSpecies = button.dataset.species;
            $$('.species-card', modal).forEach(function (item) { item.classList.toggle('selected', item === button); });
          });
        });
      }
    });
  }

  function showConfirm(title, sub, body, onConfirm, confirmLabel) {
    openModal({
      title: title,
      sub: sub,
      body: body,
      actions: [
        { label: 'Cancelar', cls: 'ghost' },
        { label: confirmLabel || 'Confirmar', cls: 'primary', onClick: function () { if (onConfirm) onConfirm(); } }
      ]
    });
  }

  function showPathChoice(state, onChoose) {
    var pet = E.activePet(state);
    openModal({
      title: '🌟 Escolha o caminho',
      sub: pet ? pet.name + ' cresceu! Escolha como ele vai se destacar a partir de agora.' : '',
      body: '<div class="path-options">' + DATA.PATHS.map(function (path) {
        return '<button class="path-option" type="button" data-path="' + path.id + '">' +
          '<span class="path-emoji">' + path.emoji + '</span>' +
          '<b>' + esc(path.name) + '</b>' +
          '<small>' + esc(path.desc) + '</small>' +
          '<span class="path-reward">+' + path.coins + ' 🪙 • +' + path.xp + ' XP</span>' +
          '</button>';
      }).join('') + '</div>',
      actions: [{ label: 'Agora não', cls: 'ghost' }],
      onMount: function (modal) {
        $$('[data-path]', modal).forEach(function (button) {
          button.addEventListener('click', function () {
            if (onChoose) onChoose(button.dataset.path);
            closeModal();
          });
        });
      }
    });
  }

  function showHelp() {
    openModal({
      title: '❓ Ajuda rápida',
      sub: 'Atalhos e dicas do TamaVida',
      body: '<div class="help-grid">' +
        '<div class="help-row"><span><kbd>Espaço</kbd></span><span>Fazer carinho</span></div>' +
        '<div class="help-row"><span><kbd>C</kbd></span><span>Abrir loja</span></div>' +
        '<div class="help-row"><span><kbd>J</kbd></span><span>Minigame aleatório</span></div>' +
        '<div class="help-row"><span><kbd>?</kbd></span><span>Abrir esta ajuda</span></div>' +
        '<div class="help-row"><span><kbd>Esc</kbd></span><span>Fechar janela/minigame</span></div>' +
        '<div class="help-row"><span><kbd>←</kbd> <kbd>→</kbd></span><span>Navegar entre abas</span></div>' +
        '</div>' +
        '<p class="muted" style="margin-top:12px">Dica: use 📲 para instalar o app e jogar offline. Feche e abra o app para aplicar atualizações.</p>',
      actions: [{ label: 'Fechar', cls: 'primary' }]
    });
  }

  function showSettings(state, handlers) {
    E.ensureRoutine(state);
    var speed = Number(state.settings.speed) || 3;
    var theme = state.settings.theme || 'auto';
    var rows = [
      { key: 'sound', icon: '🔊', title: 'Efeitos sonoros', sub: 'Sons de ações e conquistas' },
      { key: 'music', icon: '🎵', title: 'Música ambiente', sub: 'Melodia suave em segundo plano' },
      { key: 'ambientSound', icon: '🌦️', title: 'Sons do clima', sub: 'Chuva, neve e noite em segundo plano' },
      { key: 'notifications', icon: '🔔', title: 'Notificações', sub: 'Avisos quando precisar de cuidados' },
      { key: 'reduceMotion', icon: '🎞️', title: 'Reduzir movimento', sub: 'Desliga animações e transições' },
      { key: 'visualCues', icon: '👁️', title: 'Avisos visuais de som', sub: 'Mostra um sinal quando há efeito sonoro' }
    ];
    openModal({
      title: '⚙️ Configurações',
      sub: 'Personalize sua experiência. As mudanças são salvas automaticamente.',
      body: rows.map(function (row) {
        return '<div class="settings-row"><div><b>' + row.icon + ' ' + row.title + '</b><small>' + row.sub + '</small></div>' +
          '<button class="switch' + (state.settings[row.key] ? ' on' : '') + '" type="button" data-toggle="' + row.key + '" aria-label="' + row.title + '"><i></i></button></div>';
      }).join('') +
      '<div class="settings-section"><b>🗓️ Rotina de cuidados</b><small>Avisos contextuais nos horários escolhidos</small>' +
      DATA.ROUTINE_OPTIONS.map(function (option) {
        return '<div class="settings-row"><div><b>' + option.emoji + ' ' + option.label + '</b><small>Horário do lembrete</small></div>' +
          '<input type="time" data-routine="' + option.key + '" value="' + esc(state.routine[option.key]) + '" aria-label="Horário de ' + option.label + '"></div>';
      }).join('') + '</div>' +
      '<div class="settings-row"><div><b>⏩ Velocidade do tempo</b><small>Acelera o envelhecimento e as necessidades</small></div>' +
      '<select id="speedSelect" style="border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-2);color:var(--text);padding:6px">' +
        [1, 3, 10].map(function (value) { return '<option value="' + value + '"' + (value === speed ? ' selected' : '') + '>' + value + 'x — ' + DATA.SPEED_LABELS[value] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="settings-row"><div><b>🎨 Tema</b><small>Escolha o visual da interface</small></div>' +
      '<select id="themeSelect" style="border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-2);color:var(--text);padding:6px">' +
        [['auto', 'Automático'], ['day', 'Dia'], ['night', 'Noite']].map(function (pair) { return '<option value="' + pair[0] + '"' + (pair[0] === theme ? ' selected' : '') + '>' + pair[1] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="settings-row"><div><b>🌗 Contraste</b><small>Deixa textos e botões mais nítidos</small></div>' +
      '<select id="contrastSelect" style="border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-2);color:var(--text);padding:6px">' +
        Object.keys(DATA.CONTRAST_LABELS).map(function (key) { return '<option value="' + key + '"' + (key === state.settings.contrast ? ' selected' : '') + '>' + DATA.CONTRAST_LABELS[key] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="settings-row"><div><b>🔠 Tamanho do texto</b><small>Aumenta a leitura nos painéis</small></div>' +
      '<select id="fontSelect" style="border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-2);color:var(--text);padding:6px">' +
        Object.keys(DATA.FONT_LABELS).map(function (key) { return '<option value="' + key + '"' + (key === state.settings.fontSize ? ' selected' : '') + '>' + DATA.FONT_LABELS[key] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="slots-section"><b>💾 Slots de salvamento</b><small>Armazene até 3 progressos separados neste dispositivo.</small>' +
        '<div class="slot-list">' + E.listSlots().map(function (slot) {
          return '<div class="slot-row"><span><b>Slot ' + slot.index + '</b><small>' + esc(slot.name) + ' • 🪙 ' + slot.coins + (slot.savedAt ? ' • ' + fmtTime(slot.savedAt) : '') + '</small></span>' +
            '<button class="mini-btn" type="button" data-slot-save="' + slot.index + '">Salvar</button>' +
            '<button class="mini-btn" type="button" data-slot-load="' + slot.index + '"' + (slot.savedAt ? '' : ' disabled') + '>Carregar</button></div>';
        }).join('') + '</div></div>' +
      '<p class="muted" style="margin-top:12px">Atalhos: <b>Espaço</b> faz carinho, <b>C</b> abre a loja, <b>J</b> inicia um minigame, <b>Esc</b> fecha janelas.</p>',
      actions: [{ label: 'Pronto', cls: 'primary' }],
      onMount: function (modal) {
        $$('[data-toggle]', modal).forEach(function (button) {
          button.addEventListener('click', function () {
            var key = button.dataset.toggle;
            state.settings[key] = !state.settings[key];
            button.classList.toggle('on', state.settings[key]);
            if (handlers && handlers.onChange) handlers.onChange(key, state.settings[key]);
          });
        });
        $$('[data-routine]', modal).forEach(function (input) {
          input.addEventListener('change', function (event) {
            var key = event.target.dataset.routine;
            state.routine[key] = event.target.value;
            if (handlers && handlers.onChange) handlers.onChange('routine:' + key, state.routine[key]);
          });
        });
        $('#speedSelect', modal).addEventListener('change', function (event) {
          state.settings.speed = Number(event.target.value);
          if (handlers && handlers.onChange) handlers.onChange('speed', state.settings.speed);
        });
        $('#themeSelect', modal).addEventListener('change', function (event) {
          state.settings.theme = event.target.value;
          if (handlers && handlers.onChange) handlers.onChange('theme', state.settings.theme);
        });
        $('#contrastSelect', modal).addEventListener('change', function (event) {
          state.settings.contrast = event.target.value;
          if (handlers && handlers.onChange) handlers.onChange('contrast', state.settings.contrast);
        });
        $('#fontSelect', modal).addEventListener('change', function (event) {
          state.settings.fontSize = event.target.value;
          if (handlers && handlers.onChange) handlers.onChange('fontSize', state.settings.fontSize);
        });
        $$('[data-slot-save]', modal).forEach(function (button) {
          button.addEventListener('click', function () {
            if (handlers && handlers.onSlotSave) handlers.onSlotSave(Number(button.dataset.slotSave));
            toast('Progresso salvo no slot ' + button.dataset.slotSave + '.', 'good');
            closeModal();
          });
        });
        $$('[data-slot-load]', modal).forEach(function (button) {
          button.addEventListener('click', function () {
            if (handlers && handlers.onSlotLoad) handlers.onSlotLoad(Number(button.dataset.slotLoad));
            closeModal();
          });
        });
      }
    });
  }

  function showCareMenu(state) {
    var pet = E.activePet(state);
    var medicines = state.inventory.medicine || 0;
    var bandages = state.inventory.bandage || 0;
    var elixirs = state.inventory.elixir || 0;
    openModal({
      title: '💊 Saúde e cuidados',
      sub: pet.name + ' • saúde ' + Math.round(pet.health) + '/100',
      body: pet.status === 'critical'
        ? '<p class="muted">Seu bichinho está em estado crítico. Um Elixir da vida traz ele de volta.</p>'
        : '<p class="muted">Use itens de cuidado para manter a saúde em alta. Um banho ajuda muito!</p>' +
          '<div class="item-grid" style="margin-top:12px">' + DATA.ITEMS.filter(function (item) { return item.type === 'care'; }).map(function (item) { return itemCard(item, state, pet, 'inventory'); }).join('') + '</div>',
      actions: [
        { label: 'Fechar', cls: 'ghost' },
        { label: '🧪 Reanimar (' + elixirs + ')', cls: 'primary', onClick: function () { global.TamaApp.perform('revive'); return false; } }
      ].concat(pet.status === 'critical' ? [] : [
        { label: '💊 Remédio (' + medicines + ')', onClick: function () { global.TamaApp.perform('use-item', { item: 'medicine' }); return false; } },
        { label: '🩹 Bandagem (' + bandages + ')', onClick: function () { global.TamaApp.perform('use-item', { item: 'bandage' }); return false; } }
      ])
    });
  }

  function showGameResult(reward) {
    var ratio = reward.ratio || 0;
    var emoji = ratio >= 0.8 ? '🏆' : ratio >= 0.5 ? '🎉' : '🙂';
    var title = ratio >= 0.8 ? 'Excelente!' : ratio >= 0.5 ? 'Muito bem!' : 'Foi divertido!';
    openModal({
      title: emoji + ' ' + title,
      sub: 'Seu bichinho adorou brincar com você.',
      body: '<div class="game-result" style="color:var(--text)">' +
        '<div class="result-emoji">' + emoji + '</div>' +
        '<div class="result-rewards"><span>🎯 ' + esc(reward.msg.split(' • ')[0]) + '</span><span>🪙 +' + reward.coins + '</span><span>⭐ +' + reward.xp + ' XP</span></div>' +
        '</div>',
      actions: [
        { label: 'Fechar', cls: 'ghost' },
        { label: 'Jogar de novo', cls: 'primary', onClick: function () { return global.TamaApp.startGame(reward.gameId); } }
      ]
    });
  }

  function showAwaySummary(info) {
    var labels = { hunger: '🍗 Fome', happiness: '😄 Feliz', energy: '⚡ Energia', hygiene: '🛁 Higiene', health: '❤️ Saúde' };
    var rows = Object.keys(labels).map(function (key) {
      var delta = Math.round((info.after[key] || 0) - (info.before[key] || 0));
      var color = delta < 0 ? 'var(--red)' : delta > 0 ? 'var(--green)' : 'var(--muted)';
      return '<div class="summary-row"><span>' + labels[key] + '</span><b style="color:' + color + '">' +
        (delta > 0 ? '+' : '') + delta + '</b></div>';
    }).join('');
    var notes = (info.notes || []).map(function (note) { return '<p class="muted">• ' + esc(note) + '</p>'; }).join('');
    openModal({
      title: '👋 Você voltou!',
      sub: 'Seu bichinho cuidou de si mesmo enquanto você esteve fora por ' + esc(info.away) + '.',
      body: '<div class="summary-grid">' + rows + '</div>' + notes +
        '<p class="muted" style="margin-top:10px">Dica: alimente e brinque para recuperar o humor.</p>',
      actions: [{ label: 'Vamos cuidar dele!', cls: 'primary' }]
    });
  }

  function showExport(state) {
    var code = E.exportSave(state);
    openModal({
      title: '📤 Exportar progresso',
      sub: 'Copie o código abaixo e guarde em local seguro. Você pode importá-lo em outro dispositivo.',
      body: '<div class="field"><label for="saveCode">Código do progresso</label><textarea id="saveCode" readonly>' + esc(code) + '</textarea></div>',
      actions: [
        { label: 'Fechar', cls: 'ghost' },
        { label: '📋 Copiar', cls: 'primary', onClick: function (modal) {
          var area = $('#saveCode', modal);
          area.select();
          try { document.execCommand('copy'); toast('Código copiado!', 'good'); }
          catch (error) { toast('Selecione e copie manualmente.', 'bad'); }
          return false;
        } }
      ]
    });
  }

  function showImport(state, onImport) {
    openModal({
      title: '📥 Importar progresso',
      sub: 'Cole o código exportado anteriormente. Isso substitui o progresso atual deste dispositivo.',
      body: '<div class="field"><label for="importCode">Código do progresso</label><textarea id="importCode" placeholder="Cole aqui o código..."></textarea></div>',
      actions: [
        { label: 'Cancelar', cls: 'ghost' },
        { label: 'Importar', cls: 'primary', onClick: function (modal) {
          var code = $('#importCode', modal).value;
          var imported = E.importSave(code);
          if (!imported) { toast('Código inválido!', 'bad'); return false; }
          onImport(imported);
          return false;
        } }
      ]
    });
  }

  function showReset(onConfirm) {
    openModal({
      title: '🗑️ Recomeçar do zero?',
      sub: 'Todos os bichinhos, conquistas, moedas e itens serão apagados permanentemente.',
      actions: [
        { label: 'Cancelar', cls: 'primary' },
        { label: 'Sim, apagar tudo', cls: 'danger', onClick: onConfirm }
      ]
    });
  }

  function showMoment(onSave) {
    openModal({
      title: '📸 Registrar momento',
      sub: 'Guarde uma lembrança com o nome do seu bichinho.',
      body: '<div class="form-row"><label for="momentTitle">Título</label>' +
        '<input id="momentTitle" maxlength="40" placeholder="Ex.: Primeiro pulo!" value="Momento especial"></div>' +
        '<div class="form-row"><label for="momentNote">Legenda</label>' +
        '<textarea id="momentNote" maxlength="160" rows="3" placeholder="Como foi esse momento?"></textarea></div>',
      actions: [
        { label: 'Cancelar', cls: 'ghost' },
        { label: 'Salvar', cls: 'primary', onClick: function (modal) {
          var title = $('#momentTitle', modal).value;
          var note = $('#momentNote', modal).value;
          if (onSave) onSave(title, note);
        } }
      ]
    });
  }

  function showTutorial(state, onComplete, onProgress) {
    var total = DATA.TUTORIAL.length;
    var step = Math.min(Math.max(0, (state.tutorial && state.tutorial.step) || 0), total - 1);
    function renderStep() {
      var item = DATA.TUTORIAL[step];
      var dots = DATA.TUTORIAL.map(function (_, index) {
        return '<i class="' + (index === step ? 'active' : index < step ? 'done' : '') + '"></i>';
      }).join('');
      if (onProgress) onProgress(step);
      openModal({
        title: item.emoji + ' ' + item.title,
        sub: 'Passo ' + (step + 1) + ' de ' + total,
        body: '<p class="tutorial-text">' + esc(item.text) + '</p><div class="tutorial-dots">' + dots + '</div>',
        locked: true,
        noAutofocus: true,
        actions: [
          { label: 'Pular', cls: 'ghost', close: false, onClick: function () {
            if (onComplete) onComplete(true);
            closeModal();
            return true;
          } },
          { label: 'Voltar', cls: 'ghost', close: false, onClick: function () {
            if (step > 0) { step -= 1; renderStep(); }
            return true;
          } },
          { label: step === total - 1 ? 'Começar!' : 'Próximo', cls: 'primary', close: false, onClick: function () {
            if (step === total - 1) {
              if (onComplete) onComplete(false);
              closeModal();
              return true;
            }
            step += 1;
            renderStep();
            return true;
          } }
        ],
        onMount: function (modal) {
          var button = $('.btn.primary', modal);
          if (button) button.focus();
        }
      });
    }
    renderStep();
  }

  global.TamaUI = {
    init: init,
    render: render,
    updateLive: updateLive,
    renderTab: renderTab,
    renderPet: renderPet,
    renderTopbar: renderTopbar,
    renderFocus: renderFocus,
    updateFocus: updateFocus,
    renderAlerts: renderAlerts,
    applyTheme: applyTheme,
    themeInfo: themeInfo,
    toast: toast,
    showSoundCue: showSoundCue,
    openModal: openModal,
    closeModal: closeModal,
    showAdoption: showAdoption,
    showSettings: showSettings,
    showConfirm: showConfirm,
    showPathChoice: showPathChoice,
    showCareMenu: showCareMenu,
    showGameResult: showGameResult,
    showAwaySummary: showAwaySummary,
    showTutorial: showTutorial,
    showMoment: showMoment,
    drawMomentCanvas: drawMomentCanvas,
    showHelp: showHelp,
    showExport: showExport,
    showImport: showImport,
    showReset: showReset,
    playFx: playFx,
    setActionFx: setActionFx,
    drawChart: drawChart,
    fmtAge: fmtAge
  };
})(window);
