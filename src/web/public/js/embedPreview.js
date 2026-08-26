(function () {
  const form = document.getElementById('embed-form');
  const fieldsContainer = document.getElementById('fields-container');
  const addFieldBtn = document.getElementById('add-field');
  const preview = document.getElementById('preview');

  // New rows start numbering after however many the server already rendered,
  // so their mention-target IDs never collide with the existing ones.
  let nextFieldIndex = fieldsContainer.querySelectorAll('.field-row').length;

  function roleOptionsHtml() {
    return (window.QUELLUM_ROLES || []).map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
  }

  function mentionToolsHtml(targetId) {
    const guildId = window.QUELLUM_GUILD_ID || '';
    return `
      <div class="mention-tools">
        <select id="roleSel_${targetId}">
          <option value="">Insert role…</option>
          ${roleOptionsHtml()}
        </select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="insertRoleMention('${targetId}','roleSel_${targetId}')">+ Role</button>
        <input type="text" id="userInput_${targetId}" placeholder="username" style="width:110px;">
        <button type="button" class="btn btn-ghost btn-sm" onclick="insertUserMention('${targetId}','userInput_${targetId}','${guildId}')">+ User</button>
      </div>
    `;
  }

  function fieldRowTemplate() {
    const targetId = `fieldValue_${nextFieldIndex++}`;
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <div><label style="margin:0 0 4px;">Name</label><input type="text" name="fieldName[]"></div>
      <div>
        <label style="margin:0 0 4px;">Value</label>
        <input type="text" name="fieldValue[]" id="${targetId}">
        ${mentionToolsHtml(targetId)}
      </div>
      <div><label style="margin:0 0 4px;">Inline</label>
        <select name="fieldInline[]"><option value="false">No</option><option value="true">Yes</option></select>
      </div>
      <div><button type="button" class="btn btn-ghost btn-sm remove-field" style="margin-top:20px;">✕</button></div>
    `;
    return row;
  }

  addFieldBtn.addEventListener('click', () => {
    fieldsContainer.appendChild(fieldRowTemplate());
  });

  fieldsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-field')) {
      e.target.closest('.field-row').remove();
      renderPreview();
    }
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPreview() {
    const data = new FormData(form);
    preview.innerHTML = '';
    preview.style.borderLeftColor = data.get('color') || '#5865F2';

    const authorName = data.get('authorName');
    const authorIconUrl = data.get('authorIconUrl');
    if (authorName) {
      const row = el('div', 'author');
      if (authorIconUrl) {
        const img = document.createElement('img');
        img.src = authorIconUrl;
        img.alt = '';
        row.appendChild(img);
      }
      row.appendChild(document.createTextNode(authorName));
      preview.appendChild(row);
    }

    const thumbnailUrl = data.get('thumbnailUrl');
    if (thumbnailUrl) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = thumbnailUrl;
      img.alt = '';
      preview.appendChild(img);
    }

    const title = data.get('title');
    if (title) preview.appendChild(el('div', 'title', title));

    const description = data.get('description');
    if (description) preview.appendChild(el('div', 'desc', description));

    const names = data.getAll('fieldName[]');
    const values = data.getAll('fieldValue[]');
    const inlines = data.getAll('fieldInline[]');
    const rows = names.map((n, i) => ({ name: n, value: values[i], inline: inlines[i] === 'true' })).filter((f) => f.name || f.value);
    if (rows.length) {
      const wrap = el('div', 'fields' + (rows.some((f) => f.inline) ? ' has-inline' : ''));
      rows.forEach((f) => {
        const fieldEl = el('div', 'field');
        fieldEl.appendChild(el('div', 'field-name', f.name));
        fieldEl.appendChild(el('div', 'field-value', f.value));
        wrap.appendChild(fieldEl);
      });
      preview.appendChild(wrap);
    }

    const imageUrl = data.get('imageUrl');
    if (imageUrl) {
      const img = document.createElement('img');
      img.className = 'image';
      img.src = imageUrl;
      img.alt = '';
      preview.appendChild(img);
    }

    const footerText = data.get('footerText');
    const footerIconUrl = data.get('footerIconUrl');
    if (footerText) {
      const row = el('div', 'footer');
      if (footerIconUrl) {
        const img = document.createElement('img');
        img.src = footerIconUrl;
        img.alt = '';
        row.appendChild(img);
      }
      row.appendChild(document.createTextNode(footerText));
      preview.appendChild(row);
    }

    if (!preview.childElementCount) {
      preview.appendChild(el('div', 'desc', 'Nothing to preview yet — fill in a title or description.'));
    }
  }

  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);
  fieldsContainer.addEventListener('input', renderPreview);
  renderPreview();
})();
