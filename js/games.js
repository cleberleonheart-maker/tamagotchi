(function (global) {
  'use strict';

  var root = null;
  var current = null;
  var gameId = null;
  var onFinish = null;
  var endAt = 0;
  var tickTimer = null;
  var rafId = null;
  var generation = 0;
  var cleanup = [];
  var keyHandler = null;

  var FOODS = ['🍎', '🍪', '🍣', '🍰', '🍇', '🍓', '🥕', '🧋', '🥮', '🍈', '🍦', '🍧'];

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function alive(token) {
    return current && token === generation;
  }

  function addCleanup(fn) { cleanup.push(fn); }

  function close(score, maxScore) {
    if (!current) return;
    generation += 1;
    current = null;
    keyHandler = null;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    cleanup.forEach(function (fn) { try { fn(); } catch (error) { /* noop */ } });
    cleanup = [];
    document.removeEventListener('keydown', onKey);
    if (root) root.innerHTML = '';
    var callback = onFinish;
    onFinish = null;
    if (callback && gameId && typeof score === 'number') {
      callback({ gameId: gameId, score: score, maxScore: maxScore });
    }
    gameId = null;
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
    else if (keyHandler) keyHandler(event);
  }

  function shell(title, instructions, maxSeconds) {
    root.innerHTML = '';
    current = el('div', 'game-overlay');
    current.innerHTML =
      '<div class="game-hud">' +
        '<button class="game-close" type="button" aria-label="Fechar">✕</button>' +
        '<h2>' + title + '</h2>' +
        '<div class="game-score">' +
          '<span class="score-chip" id="gameScore" aria-live="polite">0 pontos</span>' +
          '<span class="score-chip" id="gameTime" aria-live="off">' + maxSeconds + 's</span>' +
        '</div>' +
      '</div>' +
      '<div class="game-timer" role="progressbar" aria-label="Tempo restante" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="gameTimerBar"></i></div>' +
      '<p class="game-instructions" role="status">' + instructions + '</p>' +
      '<div class="game-arena" id="gameArena" tabindex="-1" aria-label="Área do jogo"></div>';
    root.appendChild(current);
    current.querySelector('.game-close').addEventListener('click', function () { close(); });
    document.addEventListener('keydown', onKey);
    return {
      arena: current.querySelector('#gameArena'),
      score: current.querySelector('#gameScore'),
      time: current.querySelector('#gameTime'),
      bar: current.querySelector('#gameTimerBar')
    };
  }

  function startTimer(parts, seconds, maxScore, getScore) {
    var duration = seconds * 1000;
    endAt = Date.now() + duration;
    tickTimer = setInterval(function () {
      var left = Math.max(0, endAt - Date.now());
      parts.time.textContent = Math.ceil(left / 1000) + 's';
      var ratio = left / duration * 100;
      parts.bar.style.width = ratio + '%';
      var progress = parts.bar.parentNode;
      if (progress && progress.setAttribute) progress.setAttribute('aria-valuenow', Math.round(ratio));
      if (left <= 0) close(getScore(), maxScore);
    }, 100);
  }

  function setScore(parts, score) {
    parts.score.textContent = score + ' pontos';
  }

  function playCatch(token, parts) {
    var falling = [];
    var spawned = 0;
    var maxSpawn = 22;
    var score = 0;
    var keyIndex = 0;
    parts.arena.style.cursor = 'crosshair';

    function updateSelection() {
      falling.forEach(function (item, index) {
        item.node.classList.toggle('selected', index === keyIndex);
      });
    }

    function grab(item) {
      if (!alive(token) || item.dead) return;
      item.dead = true;
      score += 1;
      setScore(parts, score);
      item.node.remove();
      if (global.TamaAudio) global.TamaAudio.play('eat');
    }

    keyHandler = function (event) {
      if (!alive(token)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!falling.length) return;
        keyIndex = (keyIndex + (event.key === 'ArrowRight' ? 1 : -1) + falling.length) % falling.length;
        updateSelection();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (falling[keyIndex]) grab(falling[keyIndex]);
      }
    };

    function spawn() {
      if (!alive(token) || spawned >= maxSpawn) return;
      spawned += 1;
      var node = el('button', 'catch-target', FOODS[Math.floor(Math.random() * FOODS.length)]);
      node.type = 'button';
      node.setAttribute('aria-label', 'Pegar comida');
      var width = parts.arena.clientWidth || 320;
      var x = Math.max(4, Math.random() * Math.max(4, width - 68));
      var speed = 95 + Math.random() * 95 + spawned * 2;
      node.style.left = x + 'px';
      node.style.top = '-64px';
      var item = { node: node, y: -64, speed: speed, dead: false };
      node.addEventListener('click', function () { grab(item); });
      parts.arena.appendChild(node);
      falling.push(item);
    }

    var spawnTimer = setInterval(spawn, 780);
    addCleanup(function () { clearInterval(spawnTimer); });

    var lastFrame = performance.now();
    function frame(time) {
      if (!alive(token)) return;
      var dt = Math.min(0.05, (time - lastFrame) / 1000);
      lastFrame = time;
      var floor = parts.arena.clientHeight;
      falling.forEach(function (item) {
        if (item.dead) return;
        item.y += item.speed * dt;
        item.node.style.top = item.y + 'px';
        if (item.y > floor - 12) {
          item.dead = true;
          item.node.remove();
        }
      });
      falling = falling.filter(function (item) { return !item.dead; });
      if (keyIndex >= falling.length) keyIndex = 0;
      updateSelection();
      rafId = requestAnimationFrame(frame);
    }
    spawn();
    rafId = requestAnimationFrame(frame);
    startTimer(parts, 20, 16, function () { return Math.min(score, 16); });
  }

  function playTap(token, parts) {
    var grid = el('div', 'tap-grid');
    parts.arena.appendChild(grid);
    var holes = [];
    for (var i = 0; i < 9; i += 1) {
      var hole = el('div', 'tap-hole');
      hole.dataset.key = i + 1;
      grid.appendChild(hole);
      holes.push({ node: hole, busy: false, timer: null });
    }
    var score = 0;
    keyHandler = function (event) {
      if (!alive(token) || !/^[1-9]$/.test(event.key)) return;
      event.preventDefault();
      var target = holes[Number(event.key) - 1].node.querySelector('.tap-target');
      if (target) target.click();
    };
    var spawnTimer = setInterval(function () {
      if (!alive(token)) return;
      var free = holes.filter(function (hole) { return !hole.busy; });
      if (!free.length) return;
      var hole = free[Math.floor(Math.random() * free.length)];
      hole.busy = true;
      var button = el('button', 'tap-target', Math.random() > 0.25 ? '💜' : '⭐');
      button.type = 'button';
      button.setAttribute('aria-label', 'Tocar coração');
      hole.node.appendChild(button);
      function remove() {
        if (!alive(token)) return;
        clearTimeout(hole.timer);
        hole.timer = null;
        hole.busy = false;
        if (button.parentNode) button.remove();
      }
      button.addEventListener('click', function () {
        if (!alive(token) || !hole.busy) return;
        score += 1;
        setScore(parts, score);
        if (global.TamaAudio) global.TamaAudio.play('game');
        remove();
      });
      hole.timer = setTimeout(remove, 950);
    }, 460);
    addCleanup(function () {
      clearInterval(spawnTimer);
      holes.forEach(function (hole) { clearTimeout(hole.timer); });
    });
    startTimer(parts, 20, 20, function () { return Math.min(score, 20); });
  }

  function playMemory(token, parts) {
    var colors = [
      { color: '#ff6b9e', label: 'Rosa' },
      { color: '#57d9a3', label: 'Verde' },
      { color: '#6da8ff', label: 'Azul' },
      { color: '#ffd166', label: 'Amarelo' }
    ];
    var grid = el('div', 'memory-grid');
    parts.arena.appendChild(grid);
    var buttons = colors.map(function (entry, index) {
      var button = el('button', 'memory-btn');
      button.type = 'button';
      button.style.background = entry.color;
      button.setAttribute('aria-label', (index + 1) + ' — ' + entry.label);
      grid.appendChild(button);
      return button;
    });

    var status = el('p', 'game-instructions', 'Observe a sequência...');
    parts.arena.appendChild(status);
    var sequence = [];
    var round = 0;
    var inputIndex = 0;
    var accepting = false;
    var timeouts = [];
    var score = 0;
    keyHandler = function (event) {
      if (!alive(token) || !/^[1-4]$/.test(event.key)) return;
      event.preventDefault();
      buttons[Number(event.key) - 1].click();
    };

    function later(fn, delay) {
      var id = setTimeout(function () {
        timeouts = timeouts.filter(function (item) { return item !== id; });
        if (alive(token)) fn();
      }, delay);
      timeouts.push(id);
    }

    function light(index) {
      return new Promise(function (resolve) {
        buttons[index].classList.add('lit');
        if (global.TamaAudio) global.TamaAudio.play('click');
        later(function () {
          buttons[index].classList.remove('lit');
          later(resolve, 220);
        }, 480);
      });
    }

    function showSequence() {
      accepting = false;
      status.textContent = 'Observe a sequência...';
      var chain = Promise.resolve();
      sequence.forEach(function (index) {
        chain = chain.then(function () { return light(index); });
      });
      chain.then(function () {
        if (!alive(token)) return;
        accepting = true;
        inputIndex = 0;
        status.textContent = 'Agora repita!';
      });
    }

    function nextRound() {
      round += 1;
      if (round > 6 || sequence.length >= 7) {
        close(score, 24);
        return;
      }
      sequence.push(Math.floor(Math.random() * 4));
      score = (round - 1) * 4;
      setScore(parts, score);
      showSequence();
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        if (!alive(token) || !accepting) return;
        if (index === sequence[inputIndex]) {
          button.classList.add('lit');
          later(function () { button.classList.remove('lit'); }, 180);
          inputIndex += 1;
          if (inputIndex >= sequence.length) {
            accepting = false;
            score = round * 4;
            setScore(parts, score);
            status.textContent = 'Correto! Próxima rodada...';
            if (global.TamaAudio) global.TamaAudio.play('happy');
            later(nextRound, 700);
          }
        } else {
          accepting = false;
          button.classList.add('wrong');
          status.textContent = 'Errou! Fim de jogo.';
          if (global.TamaAudio) global.TamaAudio.play('error');
          later(function () { close(score, 24); }, 700);
        }
      });
    });

    addCleanup(function () { timeouts.forEach(clearTimeout); timeouts = []; });
    startTimer(parts, 45, 24, function () { return Math.min(score, 24); });
    later(nextRound, 600);
  }

  function playFish(token, parts) {
    var score = 0;
    var spawned = 0;
    var maxSpawn = 18;
    var fish = (global.TamaData && global.TamaData.fishForDay ? global.TamaData.fishForDay(new Date()) : [{ emoji: '🐟', name: 'Peixe' }]);
    var targets = [];
    var timers = [];
    parts.arena.classList.add('fish-arena');
    parts.arena.style.cursor = 'crosshair';

    function updateKeys() {
      targets.forEach(function (target, index) {
        target.node.dataset.key = String(index + 1);
      });
    }

    function remove(target) {
      if (target.dead) return;
      target.dead = true;
      if (target.timer) clearTimeout(target.timer);
      target.node.remove();
      targets = targets.filter(function (item) { return item !== target; });
      updateKeys();
    }

    function catchFish(target) {
      if (!alive(token) || target.dead) return;
      score += 1;
      setScore(parts, score);
      remove(target);
      if (global.TamaAudio) global.TamaAudio.play('eat');
    }

    function spawn() {
      if (!alive(token) || spawned >= maxSpawn) return;
      spawned += 1;
      var kind = fish[Math.floor(Math.random() * fish.length)];
      var node = el('button', 'fish-target', esc(kind.emoji) + '<i class="fish-key"></i>');
      node.type = 'button';
      node.setAttribute('aria-label', 'Pescar ' + kind.name);
      var width = parts.arena.clientWidth || 320;
      var height = parts.arena.clientHeight || 260;
      node.style.left = Math.max(6, Math.random() * Math.max(6, width - 78)) + 'px';
      node.style.top = Math.max(12, Math.random() * Math.max(12, height - 78)) + 'px';
      var target = { node: node, dead: false, timer: null };
      node.addEventListener('click', function () { catchFish(target); });
      parts.arena.appendChild(node);
      targets.push(target);
      updateKeys();
      target.timer = setTimeout(function () { remove(target); }, 1500);
      timers.push(target.timer);
    }

    keyHandler = function (event) {
      if (!alive(token)) return;
      var index = Number(event.key) - 1;
      if (index >= 0 && index < targets.length) {
        event.preventDefault();
        catchFish(targets[index]);
      }
    };

    var spawnTimer = setInterval(spawn, 700);
    addCleanup(function () {
      clearInterval(spawnTimer);
      timers.forEach(clearTimeout);
      timers = [];
    });
    spawn();
    startTimer(parts, 20, maxSpawn, function () { return Math.min(score, maxSpawn); });
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function start(id, callback) {
    if (current) return false;
    root = document.getElementById('gameRoot');
    if (!root) return false;
    var definition = (global.TamaData && global.TamaData.GAMES || []).find(function (game) { return game.id === id; });
    if (!definition) return false;
    gameId = id;
    onFinish = typeof callback === 'function' ? callback : null;
    generation += 1;
    var token = generation;
    var hints = {
      catch: ' Mouse/toque: clique nas comidas. Teclado: ← → para escolher, Enter para pegar.',
      tap: ' Mouse/toque: toque nos corações. Teclado: teclas 1 a 9.',
      memory: ' Mouse/toque: clique nas cores. Teclado: teclas 1 a 4.',
      fish: ' Mouse/toque: clique nos peixes. Teclado: teclas 1 a 5.'
    };
    var parts = shell(definition.emoji + ' ' + definition.name, definition.desc + (hints[id] || ''), id === 'memory' ? 45 : 20);
    if (id === 'catch') playCatch(token, parts);
    else if (id === 'tap') playTap(token, parts);
    else if (id === 'memory') playMemory(token, parts);
    else if (id === 'fish') playFish(token, parts);
    else { close(); return false; }
    if (parts.arena.focus) parts.arena.focus();
    return true;
  }

  global.TamaGames = { start: start, close: close, isRunning: function () { return !!current; } };
})(window);
