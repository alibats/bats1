
var DATA = {};
// global error handler to show JS errors on-screen (older browsers compatible)
window.onerror = function(msg, url, line, col, err){
  var d = document.getElementById('js-error');
  if(!d){
    d = document.createElement('div');
    d.id = 'js-error';
    d.style.cssText = 'display:block;background:#ffdddd;color:#000;padding:8px;position:fixed;bottom:0;left:0;right:0;z-index:9999;font-family:Tahoma,Arial;font-size:13px;';
    document.body.appendChild(d);
  }else{
    d.style.display = 'block';
  }
  var location = (url || '') + ':' + (line || 0);
  try{ d.innerText = 'Error: ' + msg + ' (' + location + ')'; }catch(e){ d.innerHTML = 'Error: ' + msg + ' (' + location + ')'; }
  return false;
};
// theme storage with fallback
var currentTheme = 'dark';
try{
  if(window.localStorage){
    currentTheme = localStorage.getItem('theme') || 'dark';
  }
}catch(e){ currentTheme = 'dark'; }

if(currentTheme === 'light'){
  document.body.className = 'light';
}

var themeBtn = document.getElementById('themeBtn');
if(themeBtn){
  themeBtn.onclick = function(){
    if(document.body.className === 'light'){
      document.body.className = '';
      try{ if(window.localStorage) localStorage.setItem('theme','dark'); }catch(e){}
    }else{
      document.body.className = 'light';
      try{ if(window.localStorage) localStorage.setItem('theme','light'); }catch(e){}
    }
  };
}

// simple XHR loader (ES5) instead of fetch/Promise
function loadData(){
  var files = ['apps','libraries','themes','fixes','saves'];
  var remaining = files.length;
  var results = {};

  function fileLoaded(name, text){
    try{
      results[name] = JSON.parse(text);
    }catch(e){ results[name] = []; }
    remaining -= 1;
    if(remaining === 0){
      DATA = results;
      showHome();
    }
  }

  for(var i=0;i<files.length;i++){
    (function(f){
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'data/'+f+'.json', true);
      xhr.onreadystatechange = function(){
        if(xhr.readyState === 4){
          if(xhr.status >= 200 && xhr.status < 300){
            fileLoaded(f, xhr.responseText);
          }else{
            fileLoaded(f, '[]');
          }
        }
      };
      try{ xhr.send(); }catch(e){ fileLoaded(f,'[]'); }
    })(files[i]);
  }
}

loadData();

// Feature-detect basic SVG support and toggle fallback image for old browsers (PS3)
function toggleSvgFallback(){
  var img = document.getElementById('outline-png');
  var svg = document.querySelector('.svg-outline');
  var supports = false;
  try{
    supports = !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg','svg').createSVGRect;
  }catch(e){ supports = false; }

  if(supports && svg){
    svg.style.display = 'block';
    if(img) img.style.display = 'none';
  }else{
    if(svg) svg.style.display = 'none';
    if(img) img.style.display = 'block';
  }
}

if(window.addEventListener){ window.addEventListener('load', toggleSvgFallback, false); }else{ window.onload = toggleSvgFallback; }

function showHome(){
  var app = document.getElementById('app');
  app.innerHTML = '';

  var sections = [
    {key:'ps3hen', title:'PS3HEN'},
    {key:'apps', title:'Apps'},
    {key:'libraries', title:'Libraries'},
    {key:'themes', title:'Themes'},
    {key:'fixes', title:'Fixes'},
    {key:'saves', title:'Saves'}
  ];

  for(var i=0;i<sections.length;i++){
    var div = document.createElement('div');
    div.className = 'section-btn';
    div.innerHTML = '<h2>' + sections[i].title + '</h2>';
    div.setAttribute('data-key', sections[i].key);
    div.onclick = function(){
      var key = this.getAttribute('data-key');
      if(key === 'ps3hen'){
        showHENVersions();
      }else{
        showSection(key,1);
      }
    };
    app.appendChild(div);
  }
}

function showSection(type,page){
  var app = document.getElementById('app');
  var itemsRaw = (DATA[type] || []);
  // For saves, group individual save entries by game (game_name + title_id)
  if(type === 'saves'){
    var map = {};
    var games = [];
    for(var si=0; si<itemsRaw.length; si++){
      var s = itemsRaw[si];
      var keyName = (s.game_name || s.title || s.title_id || 'Unknown');
      var key = keyName + '||' + (s.title_id || '');
      if(!map[key]){
        map[key] = {
          game_name: s.game_name || s.title || 'No title',
          title_id: s.title_id || '',
          image_url: s.image_url || s.image || '',
          description: s.description || '',
          regions: []
        };
        games.push(map[key]);
      }
      map[key].regions.push({
        region: s.region || '',
        title_id: s.title_id || '',
        description: s.description || '',
        download_url: s.download_url || s.download || '#'
      });
    }
    itemsRaw = games;
  }
  var perPage = 10;

  app.innerHTML = '<button class="btn back" onclick="showHome()">Back</button>';

  // If themes or saves section, render search (and category filter for themes)
  if(type === 'themes' || type === 'saves'){
    var controls = document.createElement('div');
    controls.className = 'controls';

    if(type === 'themes'){
      var categories = itemsRaw.map(function(i){ return i.category || 'Uncategorized'; });
      categories = categories.filter(function(v,i,a){ return a.indexOf(v)===i; });
      var opts = '';
      for(var ci=0;ci<categories.length;ci++){
        var c = categories[ci];
        opts += '<option value="'+ c +'">'+ c +'</option>';
      }
      controls.innerHTML =
        '<input id="searchInput" placeholder="Search title...">' +
        '<select id="filterCategory"><option value="">All categories</option>' +
        opts +
        '</select>';
    }else{
      controls.innerHTML = '<input id="searchInput" placeholder="Search game or title id...">';
    }

    app.appendChild(controls);

    // attach handlers to re-render on change (use classic handlers for compatibility)
    var searchEl = document.getElementById('searchInput');
    var filterEl = document.getElementById('filterCategory');
    if(searchEl) searchEl.onkeyup = function(){ showSection(type,1); };
    if(filterEl) filterEl.onchange = function(){ showSection(type,1); };
  }

  app.innerHTML += '<div class="grid" id="grid"></div>';

  var grid = document.getElementById('grid');

  // read current filters
  var filtered = itemsRaw.slice();
  if(type === 'themes'){
    var qEl = document.getElementById('searchInput');
    var fEl = document.getElementById('filterCategory');
    var q = (qEl && (qEl.value || '')) ? (qEl.value || '').toLowerCase() : '';
    var cat = (fEl && (fEl.value || '')) ? (fEl.value || '') : '';

    if(q){
      filtered = filtered.filter(function(it){
        var title = (it.title || it.name || it.slug || '').toLowerCase();
        return title.indexOf(q) !== -1;
      });
    }

    if(cat){
      filtered = filtered.filter(function(it){ return (it.category || 'Uncategorized') === cat; });
    }
  }

  var start = (page-1)*perPage;
  var end = start + perPage;
  var totalPages = filtered.length ? Math.ceil(filtered.length / perPage) : 1;

  for(var i=start;i<end && i<filtered.length;i++){
    var item = filtered[i];
    var title = item.title || item.name || item.game_name || item.slug || 'No title';
    var image = item.image_url || item.image || '';

    var card = document.createElement('div');
    card.className = 'card';
    var imgHtml = (image) ? ('<img src="'+ image +'">') : '';
    var cardContent = '<div class="card-content"><div class="card-title">'+ title +'</div>';
    // For saves, we don't show download on the card; downloads appear in details (regions)
    if(type !== 'saves'){
      var downloadLink = (item.download_url || item.download || item.downloadUrl || '#');
      cardContent += '<a class="btn download" href="'+ downloadLink +'" onclick="event.stopPropagation();">Download</a>';
    }
    cardContent += '</div>';
    card.innerHTML = imgHtml + cardContent;
    card.onclick = (function(obj,t){ return function(){ showDetails(obj,t); }; })(item,type);
    grid.appendChild(card);
  }

  var pag = document.createElement('div');
  pag.className = 'pagination';

  // Previous button
  if(page > 1){
    var prev = document.createElement('button');
    prev.className = 'nav';
    prev.innerText = 'Previous';
    prev.onclick = function(){ showSection(type, page-1); };
    pag.appendChild(prev);
  }

  // Current page (disabled look)
  var cur = document.createElement('button');
  cur.className = 'current';
  cur.innerText = page; cur.disabled = true; pag.appendChild(cur);

  // Last page button (if more than one page)
  if(totalPages > 1){
    if(page !== totalPages){
      var last = document.createElement('button');
      last.innerText = totalPages;
      last.onclick = (function(t){ return function(){ showSection(type, t); }; })(totalPages);
      pag.appendChild(last);
    }else{
      var lastDisabled = document.createElement('button');
      lastDisabled.innerText = totalPages; lastDisabled.disabled = true; lastDisabled.className = 'disabled'; pag.appendChild(lastDisabled);
    }
  }

  // Next button
  if(page < totalPages){
    var next = document.createElement('button');
    next.className = 'nav';
    next.innerText = 'Next';
    next.onclick = function(){ showSection(type, page+1); };
    pag.appendChild(next);
  }

  app.appendChild(pag);
}

function showDetails(item,type){
  var app = document.getElementById('app');
  var title = item.title || item.name || item.game_name;
  var image = item.image_url || item.image || '';
  var desc = item.description || 'No description';

  app.innerHTML = '<button class="btn back" onclick="showSection(\''+type+'\',1)">Back</button>';

  var html = '<div class="detail">';
  if(type === 'themes' && image) html += '<img src="'+ image +'">';
  html += '<h2>'+ title +'</h2>';
  html += '<p class="desc">'+ desc +'</p>';

  if(type === 'saves'){
    // Some data sets group regions; others are single save entries.
    if(Array.isArray(item.regions) && item.regions.length){
      html += '<h3 class="detail-heading">Regions</h3>';
      for(var i=0;i<item.regions.length;i++){
        var r = item.regions[i];
        html += '<div class="region">';
        html += '<p><strong>Region:</strong> '+ (r.region || '') +'</p>';
        html += '<p><strong>Title ID:</strong> '+ (r.title_id || '') +'</p>';
        html += '<p>'+ (r.description || '') +'</p>';
        html += '<a class="btn" href="'+ (r.download_url || '#') +'">Download</a>';
        html += '</div>';
      }
    }else{
      var link = item.download_url || item.download || item.downloadUrl || '#';
      html += '<a class="btn" href="'+ link +'">Download</a>';
    }
  }else{
    var link = item.download_url || item.download || item.downloadUrl || '#';
    html += '<a class="btn" href="'+ link +'">Download</a>';
  }

  html += '</div>';

  app.innerHTML += html;
}

function showHENVersions(){
  var app = document.getElementById('app');
  app.innerHTML = '<button class="btn back" onclick="showHome()">Back</button>';

  var henVersions = [
    {name:'AUTO HEN 4.88', path:'hen/henauto488-main/'},
    {name:'AUTO HEN 4.89', path:'hen/Hen489-main/'},
    {name:'AUTO HEN 4.90', path:'hen/Hen490-main/'},
    {name:'AUTO HEN 4.91', path:'hen/HEN491-main/'},
    {name:'AUTO HEN 4.92', path:'hen/HEN492-main/'},
    {name:'AUTO HEN 4.93', path:'hen/AUTOHEN4.93-main/'}
  ];

  var html = '<h2>PS3HEN Versions</h2><div class="grid">';
  for(var i=0;i<henVersions.length;i++){
    var v = henVersions[i];
    html += '<div class="card" onclick="showHENContent(\'' + v.path + '\',\'' + v.name + '\')">';
    html += '<div class="card-content">';
    html += '<div class="card-title">' + v.name + '</div>';
    html += '<a class="btn" href="' + v.path + 'index.html" target="_blank" onclick="event.stopPropagation();">Open</a>';
    html += '</div></div>';
  }
  html += '</div>';

  app.innerHTML += html;
}

function showHENContent(path, name){
  var app = document.getElementById('app');
  app.innerHTML = '<button class="btn back" onclick="showHENVersions()">Back</button>';
  app.innerHTML += '<h2>' + name + '</h2>';
  
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path + 'index.html', true);
  xhr.onreadystatechange = function(){
    if(xhr.readyState === 4){
      if(xhr.status >= 200 && xhr.status < 300){
        var iframe = document.createElement('iframe');
        iframe.setAttribute('style','width:100%;height:800px;border:1px solid #374151;margin-top:15px;');
        iframe.setAttribute('src', path + 'index.html');
        app.appendChild(iframe);
      }else{
        app.innerHTML += '<p>Could not load content from ' + path + '</p>';
      }
    }
  };
  try{ xhr.send(); }catch(e){ app.innerHTML += '<p>Error loading: ' + path + '</p>'; }
}
